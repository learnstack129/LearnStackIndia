// backend/routes/dailyProblem.js
const express = require('express');
const axios = require('axios'); // Make sure you have axios installed (npm install axios)
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const DailyProblem = require('../models/DailyProblem');

// --- OneCompiler API Config ---
// The API key is read from your Vercel Environment Variables
const oneCompilerAxios = axios.create({
    baseURL: 'https://onecompiler-apis.p.rapidapi.com/api/v1/run',
    headers: {
        'X-RapidAPI-Host': 'onecompiler-apis.p.rapidapi.com',
        'X-RapidAPI-Key': process.env.ONECOMPILER_API_KEY,
        'Content-Type': 'application/json'
    }
});

// 1. GET: Fetch the active daily problem for a subject
// (Called by dashboard.html)
router.get('/active/:subjectName', auth, async (req, res) => {
    try {
        const subjectName = req.params.subjectName;
        const problem = await DailyProblem.findOne({
            subject: subjectName,
            isActive: true
        }).select('_id title subject'); // Only send minimal data

        res.json({ success: true, problem: problem || null });
    } catch (error) {
        console.error('Error fetching active daily problem:', error);
        res.status(500).json({ message: 'Error fetching daily problem' });
    }
});

// 2. GET: Fetch details of a specific problem
// (Called by daily_problem.html on load)
router.get('/details/:problemId', auth, async (req, res) => {
    try {
        const problem = await DailyProblem.findById(req.params.problemId)
            .select('-testCases -createdBy'); // Hide test cases

        if (!problem) {
            return res.status(404).json({ message: 'Problem not found.' });
        }
        
        // Find user's attempt to see if we should send the solution
        const user = await User.findById(req.user.id).select('dailyProblemAttempts');
        const attempt = user.dailyProblemAttempts.find(a => a.problemId.equals(problem._id));

        let solutionCode = null;
        if (attempt && attempt.isLocked && !attempt.passed) {
            solutionCode = problem.solutionCode; // Send solution if locked and failed
        }
        if (attempt && attempt.passed) {
             solutionCode = problem.solutionCode; // Send solution if passed
        }
        
        const problemData = problem.toObject();
        // Only send the solution if the user is allowed to see it
        if (solutionCode) {
            problemData.solutionCode = solutionCode;
        } else {
            delete problemData.solutionCode; // Hide solution
        }

        res.json({ success: true, problem: problemData });
    } catch (error) {
        console.error('Error fetching problem details:', error);
        res.status(500).json({ message: 'Error fetching problem details' });
    }
});

// 3. GET: Fetch the user's attempt status for a problem
// (Called by daily_problem.html on load)
router.get('/my-attempt/:problemId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('dailyProblemAttempts');
        const attempt = user.dailyProblemAttempts.find(a => a.problemId.equals(req.params.problemId));

        if (!attempt) {
            // No attempt yet, return default state
            return res.json({
                success: true,
                attempt: {
                    runCount: 0,
                    isLocked: false,
                    passed: false,
                    mentorFeedback: null
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
// This route contacts OneCompiler, waits for ALL results, and saves.
router.post('/submit', auth, async (req, res) => {
    try {
        const { problemId, submittedCode } = req.body;
        const user = await User.findById(req.user.id);
        const problem = await DailyProblem.findById(problemId);

        if (!user || !problem) {
            return res.status(404).json({ message: 'User or problem not found.' });
        }

        const attempt = user.findOrCreateDailyAttempt(problem._id);

        // Check 1: Locked or Passed
        if (attempt.isLocked) return res.status(403).json({ message: 'You have no more attempts for this problem.' });
        if (attempt.passed) return res.status(403).json({ message: 'You have already solved this problem.' });

        // Check 2: Run Limit
        if (attempt.runCount >= 2) {
            attempt.isLocked = true;
            user.markModified('dailyProblemAttempts');
            await user.save();
            return res.status(403).json({ message: 'Run limit (2) exceeded. Problem is now locked.' });
        }

        // --- Execute Code for each test case ---
        let passedCount = 0;
        let resultsString = "";
        let executionError = null;

        for (const [index, testCase] of problem.testCases.entries()) {
            try {
                const response = await oneCompilerAxios.post('', {
                    language: problem.language,
                    stdin: testCase.input || "",
                    files: [{ name: "index.js", content: submittedCode }] // Use a standard name
                });

                // Check for compilation or runtime errors
                if (response.data.exception || response.data.stderr) {
                    executionError = `Test Case ${index + 1} Error: ${response.data.exception || response.data.stderr}`;
                    resultsString += `${executionError}\n`;
                    break; // Stop on first error
                }
                
                const output = (response.data.stdout || "").trim();
                const expected = (testCase.expectedOutput || "").trim();

                if (output === expected) {
                    passedCount++;
                    resultsString += `Test Case ${index + 1}: Passed\n`;
                } else {
                    resultsString += `Test Case ${index + 1}: Failed\n  Expected: "${expected}"\n  Got: "${output}"\n`;
                    break; // Stop on first failure
                }

            } catch (apiError) {
                console.error("OneCompiler API Error:", apiError.response ? apiError.response.data : apiError.message);
                executionError = "Error connecting to code execution service.";
                resultsString = executionError;
                break; // Stop if the API fails
            }
        }
        // --- End Test Case Loop ---

        // --- Update User Attempt ---
        attempt.runCount += 1; // Increment run count
        
        if (executionError) {
            attempt.lastResults = resultsString; // Save the error message
        } else {
            attempt.lastResults = `[${passedCount} / ${problem.testCases.length} Test Cases Passed]\n\n${resultsString}`;
        }
        
        attempt.lastSubmittedCode = submittedCode;
        attempt.passed = (!executionError && passedCount === problem.testCases.length);

        // Check 3: Award Points (on first-ever run)
        if (attempt.runCount === 1 && !attempt.pointsAwarded) {
            user.stats.rank.points = (user.stats.rank.points || 0) + problem.pointsForAttempt;
            attempt.pointsAwarded = true;
            user.markModified('stats.rank');
        }
        
        let solutionCode = null;

        // Check 4: Lock Logic
        if (attempt.passed) {
            attempt.isLocked = true;
        } else if (attempt.runCount >= 2) {
            attempt.isLocked = true;
            solutionCode = problem.solutionCode; // Send solution on final fail
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
                solutionCode: solutionCode // Only non-null if locked & failed
            }
        });

    } catch (error) {
        console.error('Error in /submit:', error.message);
        res.status(500).json({ message: error.message || 'Error running code.' });
    }
});


module.exports = router;
