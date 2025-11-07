// backend/routes/mentor.js
const express = require('express');
const mentorAuth = require('../middleware/mentorAuth');

const mongoose = require('mongoose');


const router = express.Router();

// --- Test Management ---

// GET: Fetch all tests created by the logged-in mentor
router.get('/tests', mentorAuth, async (req, res) => {
    const Test = require('../models/Test');
    try {
        const tests = await Test.find({ createdBy: req.user.id })
            .populate('questions', 'text timeLimit') // Populates text/timeLimit for the list
            .sort({ createdAt: -1 });
            
        res.json({ success: true, tests });
    } catch (error) {
        console.error("Error fetching mentor's tests:", error);
        res.status(500).json({ message: "Error fetching tests" });
    }
});

// POST: Create a new test
router.post('/tests', mentorAuth, async (req, res) => {
    const Test = require('../models/Test');
    try {
        const { title, password } = req.body;
        if (!title || !password) {
            return res.status(400).json({ message: 'Title and password are required' });
        }

        const newTest = new Test({
            title,
            password,
            createdBy: req.user.id
        });
        
        await newTest.save();
        res.status(201).json({ success: true, message: 'Test created successfully', test: newTest });
    } catch (error) {
        console.error("Error creating test:", error);
        res.status(500).json({ message: 'Error creating test' });
    }
});

// DELETE: Delete a test and all associated data
router.delete('/tests/:testId', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    const Question = require('../models/Question'); // <-- ADD HERE
    const User = require('../models/User'); // <-- ADD HERE
    try {
        const { testId } = req.params;

        // 1. Find the test and ensure the mentor owns it
        const test = await Test.findOne({ _id: testId, createdBy: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you do not own this test' });
        }

        const questionIds = test.questions;

        // 2. Delete the Test itself
        await Test.deleteOne({ _id: test._id });

        // 3. Delete all associated Questions
        if (questionIds && questionIds.length > 0) {
            await Question.deleteMany({ _id: { $in: questionIds } });
        }

        // 4. Pull all associated testAttempts from all users
        await User.updateMany(
            { 'testAttempts.testId': testId },
            { $pull: { testAttempts: { testId: testId } } }
        );
        
        console.log(`[Test Delete] Mentor ${req.user.id} deleted test ${testId}. Associated questions and attempts removed.`);
        res.json({ success: true, message: `Test "${test.title}" deleted successfully.` });

    } catch (error) {
        console.error("Error deleting test:", error);
        res.status(500).json({ message: 'Error deleting test' });
    }
});

// POST: Add a new question (MCQ or Short Answer) and link it to a test
router.post('/tests/:testId/questions', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    const Question = require('../models/Question'); // <-- ADD HERE
    try {
        const { testId } = req.params;
        const {
            text,
            questionType, // 'mcq' or 'short_answer'
            options,
            correctAnswerIndex,
            shortAnswers,
            timeLimit 
        } = req.body;

        // Find the test and check if mentor owns it
        const test = await Test.findOne({ _id: testId, createdBy: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you do not own this test' });
        }
        
        // Prepare data for the new question model
        const questionData = {
            text,
            questionType,
            timeLimit,
            createdBy: req.user.id,
            options: (questionType === 'mcq') ? options : undefined,
            correctAnswerIndex: (questionType === 'mcq') ? correctAnswerIndex : undefined,
            shortAnswers: (questionType === 'short_answer') ? shortAnswers : undefined
        };

        // Create new question
        // The pre-save hook in Question.js will handle validation
        const newQuestion = new Question(questionData);
        await newQuestion.save(); // This will trigger the validation hook
        
        // Add question to test
        test.questions.push(newQuestion._id);
        await test.save();
        
        // --- MODIFICATION: Return the fully populated question ---
        // We do this so the frontend can immediately add it to the list
        const populatedQuestion = {
             _id: newQuestion._id,
             text: newQuestion.text,
             timeLimit: newQuestion.timeLimit
        };

        res.status(201).json({ 
            success: true, 
            message: 'Question added to test', 
            question: populatedQuestion // Send back the populated question
        });

    } catch (error) {
        console.error("Error adding question:", error);
         if (error.name === 'ValidationError') {
             // Send validation errors from the model's pre-save hook
             return res.status(400).json({ message: `Validation Error: ${error.message}` });
         }
        res.status(500).json({ message: 'Error adding question' });
    }
});

// --- NEW ROUTE: GET a single question's full details for editing ---
router.get('/questions/:questionId', mentorAuth, async (req, res) => {
    const Question = require('../models/Question');
    try {
        const { questionId } = req.params;
        
        const question = await Question.findOne({
            _id: questionId,
            createdBy: req.user.id // Ensure mentor owns this question
        });

        if (!question) {
            return res.status(404).json({ message: 'Question not found or access denied' });
        }
        
        res.json({ success: true, question });

    } catch (error) {
        console.error("Error fetching question details:", error);
        res.status(500).json({ message: 'Error fetching question details' });
    }
});

// --- NEW ROUTE: UPDATE a single question ---
router.put('/questions/:questionId', mentorAuth, async (req, res) => {
    const Question = require('../models/Question');
    try {
        const { questionId } = req.params;
        const {
            text,
            questionType,
            options,
            correctAnswerIndex,
            shortAnswers,
            timeLimit 
        } = req.body;

        // Find the question and check ownership
        const question = await Question.findOne({
            _id: questionId,
            createdBy: req.user.id
        });

        if (!question) {
            return res.status(404).json({ message: 'Question not found or access denied' });
        }
        
        // Update fields
        question.text = text;
        question.questionType = questionType;
        question.timeLimit = timeLimit;

        if (questionType === 'mcq') {
            question.options = options;
            question.correctAnswerIndex = correctAnswerIndex;
            question.shortAnswers = undefined;
        } else if (questionType === 'short_answer') {
            question.shortAnswers = shortAnswers;
            question.options = undefined;
            question.correctAnswerIndex = undefined;
        }

        // The pre-save hook in Question.js will run and validate
        await question.save(); 
        
        // --- MODIFICATION: Return the updated, populated question text/time ---
        const populatedQuestion = {
             _id: question._id,
             text: question.text,
             timeLimit: question.timeLimit
        };

        res.json({ 
            success: true, 
            message: 'Question updated successfully',
            question: populatedQuestion // Send back updated data for the list
        });

    } catch (error) {
        console.error("Error updating question:", error);
         if (error.name === 'ValidationError') {
             return res.status(400).json({ message: `Validation Error: ${error.message}` });
         }
        res.status(500).json({ message: 'Error updating question' });
    }
});

// --- NEW ROUTE: DELETE a single question (from Test and Question collection) ---
router.delete('/tests/:testId/questions/:questionId', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    const Question = require('../models/Question'); // <-- ADD HERE
    try {
        const { testId, questionId } = req.params;

        // 1. Find the question and check ownership
        const question = await Question.findOne({
            _id: questionId,
            createdBy: req.user.id
        });
        if (!question) {
             return res.status(404).json({ message: 'Question not found or access denied' });
        }

        // 2. Find the test and check ownership
        const test = await Test.findOne({
            _id: testId,
            createdBy: req.user.id
        });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or access denied' });
        }

        // 3. Delete the question from the Question collection
        await Question.deleteOne({ _id: questionId });
        
        // 4. Pull the question's ID from the test's 'questions' array
        await Test.updateOne(
            { _id: testId },
            { $pull: { questions: questionId } }
        );

        res.json({ success: true, message: 'Question deleted successfully' });

    } catch (error) {
        console.error("Error deleting question:", error);
        res.status(500).json({ message: 'Error deleting question' });
    }
});


// POST: Toggle a test's active status
router.post('/tests/:testId/toggle', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    try {
        const { testId } = req.params;

        // Find the test and check if mentor owns it
        const test = await Test.findOne({ _id: testId, createdBy: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you do not own this test' });
        }
        
        // Flip the active status
        test.isActive = !test.isActive;
        await test.save();
        
        const message = test.isActive ? `Test "${test.title}" is now Active.` : `Test "${test.title}" is now a Draft.`;
        console.log(`[Test Toggle] Mentor ${req.user.id} set test ${testId} to ${test.isActive}`);
        
        res.json({ success: true, message: message, test: test });

    } catch (error) {
        console.error("Error toggling test status:", error);
         if (error.name === 'ValidationError') {
             return res.status(400).json({ message: `Validation Error: ${error.message}` });
         }
        res.status(500).json({ message: 'Error toggling test status' });
    }
});

// --- User Monitoring & Control ---

// GET: Get all user attempts for a specific test (for monitoring)
router.get('/tests/:testId/attempts', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    const User = require('../models/User'); // <-- ADD HERE
     try {
        const { testId } = req.params;
        
        // Ensure mentor owns this test
        const test = await Test.findOne({ _id: testId, createdBy: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you do not own this test' });
        }
        
        // Find users who have an attempt for this test
        const usersWithAttempts = await User.find({ 'testAttempts.testId': testId })
            .select('username profile.avatar testAttempts');
            
        // Filter attempts to only return info for the relevant test
        const attempts = usersWithAttempts.map(user => {
            const attempt = user.testAttempts.find(a => a.testId.toString() === testId);
            return {
                userId: user._id,
                username: user.username,
                avatar: user.profile.avatar,
                attemptId: attempt._id, // The ID of the subdocument
                status: attempt.status,
                strikes: attempt.strikes,
                score: attempt.score,
                startedAt: attempt.startedAt
            };
        }).filter(Boolean); // Filter out any nulls
            
        res.json({ success: true, attempts });
        
    } catch (error) {
        console.error("Error fetching test attempts:", error);
        res.status(500).json({ message: 'Error fetching attempts' });
    }
});

// --- NEW ROUTE: Get leaderboard for a specific test ---
router.get('/tests/:testId/leaderboard', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    const User = require('../models/User'); // <-- ADD HERE
    try {
        const { testId } = req.params;
        
        // 1. Ensure mentor owns this test
        const test = await Test.findOne({ _id: testId, createdBy: req.user.id });
        if (!test) {
            return res.status(404).json({ message: 'Test not found or you do not own this test' });
        }
        
        // 2. Find users who have a *completed* attempt for this test
        const usersWithAttempts = await User.find({ 
                'testAttempts.testId': testId,
                'testAttempts.status': 'completed' // Only show completed attempts
            })
            .select('username profile.avatar testAttempts'); // Select necessary fields

        // 3. Map, filter, and sort the attempts
        const leaderboard = usersWithAttempts.map(user => {
            const attempt = user.testAttempts.find(a => a.testId.toString() === testId);
            return {
                userId: user._id,
                username: user.username,
                avatar: user.profile.avatar,
                score: attempt.score,
                status: attempt.status,
                completedAt: attempt.completedAt
            };
        }).filter(Boolean) // Filter out any nulls
          .sort((a, b) => b.score - a.score); // Sort by score descending

        // 4. Add position
        const rankedLeaderboard = leaderboard.map((entry, index) => ({
            ...entry,
            position: index + 1
        }));
            
        res.json({ success: true, leaderboard: rankedLeaderboard, testTitle: test.title });
        
    } catch (error) {
        console.error("Error fetching test leaderboard:", error);
        res.status(500).json({ message: 'Error fetching test leaderboard' });
    }
});
// --- END NEW ROUTE ---
// POST: Unlock a user's test attempt (3-strike reset)
router.post('/attempts/unlock', mentorAuth, async (req, res) => {
    const Test = require('../models/Test'); // <-- ADD HERE
    const User = require('../models/User'); // <-- ADD HERE
    try {
        const { userId, attemptId } = req.body;
        
        if (!userId || !attemptId) {
            return res.status(400).json({ message: 'userId and attemptId are required' });
        }
        
        // Find the user and the specific test attempt
        const user = await User.findOne({ _id: userId, 'testAttempts._id': attemptId });
        
        if (!user) {
            return res.status(404).json({ message: 'User or test attempt not found' });
        }
        
        // Find the specific attempt
        const attempt = user.testAttempts.id(attemptId);
        if (!attempt) {
             return res.status(404).json({ message: 'Test attempt subdocument not found' });
        }

        // Check if mentor owns the test this attempt belongs to
        const test = await Test.findOne({ _id: attempt.testId, createdBy: req.user.id });
        if (!test) {
             return res.status(403).json({ message: 'Access denied: You do not own the test associated with this attempt.' });
        }
        
        // Only unlock if it's currently locked
        if (attempt.status === 'locked') {
            attempt.status = 'inprogress';
            attempt.strikes = 0; // Reset strikes
            await user.save();
            res.json({ success: true, message: `Test unlocked for ${user.username}` });
        } else {
            res.status(400).json({ success: false, message: `Test is not locked (status: ${attempt.status})` });
        }
        
    } catch (error) {
         console.error("Error unlocking test:", error);
         res.status(500).json({ message: 'Error unlocking test' });
    }
});



module.exports = router;
