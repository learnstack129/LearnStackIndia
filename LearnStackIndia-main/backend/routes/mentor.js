// backend/routes/mentor.js
const express = require('express');
const mentorAuth = require('../middleware/mentorAuth');
const Test = require('../models/Test');
const Question = require('../models/Question');
const User = require('../models/User');
const mongoose = require('mongoose');

const router = express.Router();

// --- Test Management ---

// GET: Fetch all tests created by the logged-in mentor
router.get('/tests', mentorAuth, async (req, res) => {
    try {
        const tests = await Test.find({ createdBy: req.user.id })
            .populate('questions', 'text timeLimit')
            .sort({ createdAt: -1 });
            
        res.json({ success: true, tests });
    } catch (error) {
        console.error("Error fetching mentor's tests:", error);
        res.status(500).json({ message: "Error fetching tests" });
    }
});

// POST: Create a new test
router.post('/tests', mentorAuth, async (req, res) => {
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

// POST: Add a new question (MCQ or Short Answer) and link it to a test
router.post('/tests/:testId/questions', mentorAuth, async (req, res) => {
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
        
        res.status(201).json({ success: true, message: 'Question added to test', question: newQuestion });

    } catch (error) {
        console.error("Error adding question:", error);
         if (error.name === 'ValidationError') {
             // Send validation errors from the model's pre-save hook
             return res.status(400).json({ message: `Validation Error: ${error.message}` });
         }
        res.status(500).json({ message: 'Error adding question' });
    }
});
// --- User Monitoring & Control ---

// GET: Get all user attempts for a specific test (for monitoring)
router.get('/tests/:testId/attempts', mentorAuth, async (req, res) => {
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

// POST: Unlock a user's test attempt (3-strike reset)
router.post('/attempts/unlock', mentorAuth, async (req, res) => {
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


// TODO: Add a route for real-time violation logging (this is complex, requires WebSocket or polling)
// GET /violations/live

module.exports = router;
