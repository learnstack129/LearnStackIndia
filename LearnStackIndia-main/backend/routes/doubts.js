// backend/routes/doubts.js
const express = require('express');
const auth = require('../middleware/auth');
const mentorAuth = require('../middleware/mentorAuth');
const User = require('../models/User'); // To get user role for replies
const Doubt = require('../models/Doubt');
const mongoose = require('mongoose');

const router = express.Router();

// GET: Fetch all doubts for a specific subject
// GET /api/doubts?subject=DSA%20Visualizer
router.get('/', auth, async (req, res) => {
    try {
        const { subject } = req.query;
        if (!subject) {
            return res.status(400).json({ message: 'Subject query parameter is required' });
        }

        const doubts = await Doubt.find({ subject: subject })
            .populate('postedBy', 'username profile.avatar') // Populate the original poster
            .populate('replies.postedBy', 'username profile.avatar role') // Populate users who replied
            .sort({ isResolved: 1, createdAt: -1 }); // Show unresolved first

        res.json({ success: true, doubts });
    } catch (error) {
        console.error("Error fetching doubts:", error);
        res.status(500).json({ message: "Error fetching doubts" });
    }
});

// POST: Create a new doubt
// POST /api/doubts
router.post('/', auth, async (req, res) => {
    try {
        const { title, questionText, subject } = req.body;
        if (!title || !questionText || !subject) {
            return res.status(400).json({ message: 'Title, question text, and subject are required' });
        }

        const newDoubt = new Doubt({
            title,
            questionText,
            subject,
            postedBy: req.user.id
        });

        await newDoubt.save();
            
            // Manually populate the postedBy user for the response
            // (This pattern is safer and matches your 'reply' route logic)
            const user = await User.findById(req.user.id).select('username profile.avatar').lean();
            const populatedDoubt = newDoubt.toObject(); // Convert to plain object
            populatedDoubt.postedBy = user; // Replace the ID with the user object

            res.status(201).json({ success: true, message: 'Doubt posted successfully', doubt: populatedDoubt });
    } catch (error) {
        console.error("Error posting doubt:", error);
        // Add specific validation error handling
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation Error: ${error.message}` });
        }
        res.status(500).json({ message: 'Error posting doubt' });
    }
});

// POST: Add a reply to a doubt (Mentor only)
// POST /api/doubts/:doubtId/reply
router.post('/:doubtId/reply', mentorAuth, async (req, res) => {
    try {
        const { doubtId } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Reply text is required' });
        }

        const doubt = await Doubt.findById(doubtId);
        if (!doubt) {
            return res.status(404).json({ message: 'Doubt not found' });
        }

        const newReply = {
            text,
            postedBy: req.user.id,
            isMentor: req.user.role === 'mentor' || req.user.role === 'admin'
        };

        doubt.replies.push(newReply);
        await doubt.save();
        
        // Find the newly added reply to populate it
        const savedReply = doubt.replies[doubt.replies.length - 1];
        // Manually populate the user details for the response
        const user = await User.findById(req.user.id).select('username profile.avatar role').lean();
        const populatedReply = {
            ...savedReply.toObject(),
            postedBy: user
        };

        res.status(201).json({ success: true, message: 'Reply added', reply: populatedReply });
    } catch (error) {
        console.error("Error adding reply:", error);
        res.status(500).json({ message: 'Error adding reply' });
    }
});

// PUT: Mark a doubt as resolved (Mentor or Original Poster)
// PUT /api/doubts/:doubtId/resolve
router.put('/:doubtId/resolve', auth, async (req, res) => {
    try {
        const { doubtId } = req.params;
        const doubt = await Doubt.findById(doubtId);

        if (!doubt) {
            return res.status(404).json({ message: 'Doubt not found' });
        }

        // Check if user is OP or a mentor/admin
        const user = await User.findById(req.user.id).select('role');
        if (doubt.postedBy.toString() !== req.user.id && user.role === 'user') {
            return res.status(403).json({ message: 'Only the poster or a mentor can resolve this doubt' });
        }

        doubt.isResolved = true;
        await doubt.save();
        res.json({ success: true, message: 'Doubt marked as resolved' });
        
    } catch (error) {
        console.error("Error resolving doubt:", error);
        res.status(500).json({ message: 'Error resolving doubt' });
    }
});

module.exports = router;
