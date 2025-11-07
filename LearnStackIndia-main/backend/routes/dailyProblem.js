// backend/routes/dailyProblem.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const DailyProblem = require('../models/DailyProblem');

// --- OneCompiler API Config ---
const oneCompilerAxios = axios.create({
    baseURL: 'https://onecompiler-apis.p.rapidapi.com/api/v1/run',
    headers: {
        'X-RapidAPI-Host': 'onecompiler-apis.p.rapidapi.com',
        'X-RapidAPI-Key': process.env.ONECOMPILER_API_KEY,
        'Content-Type': 'application/json'
    }
});

// 1. GET: Fetch the active daily problem for a subject
// ... (no changes to this route) ...
router.get('/active/:subjectName', auth, async (req, res) => {
    try {
        const subjectName = req.params.subjectName;
        const problem = await DailyProblem.findOne({
            subject: subjectName,
            isActive: true
        }).select('_id title subject');

        res.json({ success: true, problem: problem || null });
    } catch (error) {
        console.error('Error fetching active daily problem:', error);
        res.status(500).json({ message: 'Error fetching daily problem' });
    }
});

// 2. GET: Fetch details of a specific problem
// ... (no changes to this route) ...
router.get('/details/:problemId', auth, async (req, res) => {
    try {
        const problem = await DailyProblem.findById(req.params.problemId)
            .select('-testCases -createdBy');

        if (!problem) {
            return res.status(404).json({ message: 'Problem not found.' });
        }
        
        const user = await User.findById(req.user.id).select('dailyProblemAttempts');
        const attempt = user.dailyProblemAttempts.find(a => a.problemId.equals(problem._id));

        let solutionCode = null;
        if (attempt && attempt.isLocked && !attempt.passed) {
            solutionCode = problem.solutionCode;
        }
        if (attempt && attempt.passed) {
             solutionCode = problem.solutionCode;
        }
        
        const problemData = problem.toObject();
        if (solutionCode) {
            problemData.solutionCode = solutionCode;
        } else {
            delete problemData.solutionCode;
        }

        res.json({ success: true, problem: problemData });
    } catch (error) {
        console.error('Error fetching problem details:', error);
        res.status(500).json({ message: 'Error fetching problem details' });
    }
});

// 3. GET: Fetch the user's attempt status for a problem
// ... (no changes to this route) ...
router.get('/my-attempt/:problemId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('dailyProblemAttempts');
        const attempt = user.dailyProblemAttempts.find(a => a.problemId.equals(req.params.problemId));

        if (!attempt) {
            return res.json({
                success: true,
                attempt: {
                    runCount: 0,
                    isLocked: false,
                    passed: false,
                    mentorFeedback: null,
                    pointsAwarded: 0 // Send 0 instead of false
                }
            });
        }
        res.json({ success: true, attempt });
    } catch (error) {
        console.error('Error fetching user attempt:', error);
        res.status(500).json({ message: 'Error fetching user attempt' });
    }
});


// 4. POST: Submit code (Synchronous Flow)
// --- *** THIS ENTIRE ROUTE IS MODIFIED *** ---
router.post('/submit', auth, async (req, res) => {
    try {
        const { problemId, submittedCode } = req.body;
        const user = await User.findById(req.user.id);
        const problem = await DailyProblem.findById(problemId);

        if (!user || !problem) {
            return res.status(404).json({ message: 'User or problem not found.' });
        }

        const attempt = user.findOrCreateDailyAttempt(problem._id);

        // Check 1: Locked or Passed (but allow resubmit if passed? No, let's keep it locked)
        if (attempt.isLocked) return res.status(403).json({ message: 'You have no more attempts for this problem.' });
        if (attempt.passed) return res.status(403).json({ message: 'You have already solved this problem.' });

        // Check 2: Run Limit
        if (attempt.runCount >= 2) {
            attempt.isLocked = true;
            // --- Point logic for failure will be handled below ---
            user.markModified('dailyProblemAttempts');
            await user.save();
            return res.status(403).json({ message: 'Run limit (2) exceeded. Problem is now locked.' });
        }

        // --- Execute Code for each test case ---
        let passedCount = 0;
        let resultsString = "";
        let executionError = null;

        // FIX: Determine the correct filename based on language
        let fileName;
        switch (problem.language.toLowerCase()) {
            case 'c': fileName = 'main.c'; break;
            case 'cpp': fileName = 'main.cpp'; break;
            case 'python': fileName = 'main.py'; break;
            case 'java': fileName = 'Main.java'; break;
            case 'javascript': default: fileName = 'index.js';
        }

        for (const [index, testCase] of problem.testCases.entries()) {
            try {
                const response = await oneCompilerAxios.post('', {
                    language: problem.language,
                    stdin: testCase.input || "",
                    files: [{ name: fileName, content: submittedCode }] // Use dynamic fileName
                });

                if (response.data.exception || response.data.stderr) {
                    let errorMsg = response.data.exception || response.data.stderr;
                    if (errorMsg.includes('is the same as output file')) {
                         errorMsg = "Compilation Error: A file naming conflict occurred.";
                    }
                    executionError = `Test Case ${index + 1} Error: ${errorMsg}`;
                    resultsString += `${executionError}\n`;
                    break;
                }
                
                const output = (response.data.stdout || "").trim();
                const expected = (testCase.expectedOutput || "").trim();

                if (output === expected) {
                    passedCount++;
                    resultsString += `Test Case ${index + 1}: Passed\n`;
                } else {
                    resultsString += `Test Case ${index + 1}: Failed\n  Expected: "${expected}"\n  Got: "${output}"\n`;
                    break;
                }

            } catch (apiError) {
                console.error("OneCompiler API Error:", apiError.response ? apiError.response.data : apiError.message);
                executionError = "Error connecting to code execution service.";
                resultsString = executionError;
                break;
static-top            }
        }
        // --- End Test Case Loop ---

        // --- Update User Attempt ---
        attempt.runCount += 1; // Increment run count
        
        if (executionError) {
            attempt.lastResults = resultsString;
        } else {
            attempt.lastResults = `[${passedCount} / ${problem.testCases.length} Test Cases Passed]\n\n${resultsString}`;
        }
        
        attempt.lastSubmittedCode = submittedCode;
        attempt.passed = (!executionError && passedCount === problem.testCases.length);
        
        let solutionCode = null;
        let pointsToAward = 0;

        // --- New Lock and Point Logic ---
        if (attempt.passed) {
            attempt.isLocked = true; // Lock on pass
            solutionCode = problem.solutionCode; // Send solution
            
            if (attempt.runCount === 1 && attempt.pointsAwarded === 0) {
                // Passed on 1st attempt
                pointsToAward = problem.pointsFirstAttempt || 20;
            } else if (attempt.runCount === 2 && attempt.pointsAwarded === 0) {
                // Passed on 2nd attempt
                pointsToAward = problem.pointsSecondAttempt || 15;
            }

        } else if (attempt.runCount >= 2) {
            // Failed 2nd attempt, now locked
            attempt.isLocked = true;
            solutionCode = problem.solutionCode; // Send solution on final fail

            if (attempt.pointsAwarded === 0) {
                // Award failure points
                pointsToAward = problem.pointsOnFailure || 10;
            }
        }
        
        // --- Award points if any are due ---
        if (pointsToAward > 0) {
            // 1. Add to main rank points
            user.stats.rank.points = (user.stats.rank.points || 0) + pointsToAward;
            
            // 2. Add to new daily problem points total
            user.stats.dailyProblemPoints = (user.stats.dailyProblemPoints || 0) + pointsToAward;
            
            // 3. Store points awarded for this specific attempt
            attempt.pointsAwarded = pointsToAward;
            
            // 4. Mark stats as modified
            user.markModified('stats.rank');
            user.markModified('stats.dailyProblemPoints');
            console.log(`[DailyProblem] Awarded ${pointsToAward} points to ${user.username}`);
        }
        
        user.markModified('dailyProblemAttempts');
        await user.save();
        
        // Return the final state
        res.json({
            success: true,
            finalState: {
                passed: attempt.passed,
                isLocked: attempt.isLocked,
                runCount: attempt.runCount,
                lastResults: attempt.lastResults,
                solutionCode: solutionCode,
                pointsAwarded: attempt.pointsAwarded // Send back points awarded
            }
        });

    } catch (error) {
        console.error('Error in /submit:', error.message);
        res.status(500).json({ message: error.message || 'Error running code.' });
    }
});


module.exports = router;
