// backend/routes/doubts.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Doubt = require('../models/Doubt');
const User = require('../models/User'); // For senderRole
const mongoose = require('mongoose');

// @route   POST /api/doubts/ask
// @desc    User creates a new doubt
// @access  Private (User)
router.post('/ask', auth, async (req, res) => {
    try {
        const { subject, title, message } = req.body;
        if (!subject || !title || !message) {
            return res.status(400).json({ message: 'Subject, title, and message are required.' });
        }

        // We need the user's role to set senderRole
        const user = await User.findById(req.user.id).select('role');
        if (!user) {
             return res.status(404).json({ message: 'User not found.' });
        }

        // Create the first message
        const firstMessage = {
            sender: req.user.id,
            senderRole: 'user', // First message is always from the user
            message: message
        };

        // Create the new doubt thread
        const newDoubt = new Doubt({
            user: req.user.id,
            subject: subject,
            title: title,
            messages: [firstMessage],
            status: 'open',
            lastReplier: req.user.id
        });

        await newDoubt.save();
        
        // Populate sender info for the first message to return to UI
        const populatedDoubt = await newDoubt.populate('messages.sender', 'username profile.avatar');

        res.status(201).json({ success: true, message: 'Doubt submitted successfully.', doubt: populatedDoubt });

    } catch (error) {
        console.error("Error asking doubt:", error);
        res.status(500).json({ message: 'Server error while submitting doubt.' });
    }
});

// @route   GET /api/doubts/my-doubts
// @desc    Get all doubt threads for the logged-in user
// @access  Private (User)
router.get('/my-doubts', auth, async (req, res) => {
    try {
        const doubts = await Doubt.find({ user: req.user.id })
            .populate('user', 'username') // User who asked
            .populate('lastReplier', 'username role') // Who replied last
            .populate('messages.sender', 'username profile.avatar role') // Populate all senders in thread
            .sort({ status: 1, updatedAt: -1 }); // Show 'open' doubts first, then by last update

        res.json({ success: true, doubts: doubts });
    } catch (error) {
        console.error("Error fetching user's doubts:", error);
        res.status(500).json({ message: 'Server error fetching doubts.' });
    }
});

// @route   POST /api/doubts/:doubtId/reply
// @desc    User or Mentor adds a reply to a doubt thread
// @access  Private (User or Mentor)
router.post('/:doubtId/reply', auth, async (req, res) => {
    try {
        const { doubtId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;

        if (!message) {
            return res.status(400).json({ message: 'Message cannot be empty.' });
        }
        if (!mongoose.Types.ObjectId.isValid(doubtId)) {
            return res.status(400).json({ message: 'Invalid doubt ID.' });
        }

        const [user, doubt] = await Promise.all([
            User.findById(userId).select('role'),
            Doubt.findById(doubtId)
        ]);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        if (!doubt) {
            return res.status(404).json({ message: 'Doubt thread not found.' });
        }

        // Authorization: Must be the user who asked OR a mentor/admin
        if (doubt.user.toString() !== userId && user.role === 'user') {
            return res.status(403).json({ message: 'Access denied. You did not create this doubt.' });
        }
        
        // Check if thread is finished
        if (doubt.status === 'finished') {
            return res.status(400).json({ message: 'This doubt thread is finished and cannot be replied to.' });
        }

        // Determine sender role for the message
        const senderRole = (user.role === 'mentor' || user.role === 'admin') ? 'mentor' : 'user';

        const newReply = {
            sender: userId,
            senderRole: senderRole,
            message: message
        };

        doubt.messages.push(newReply);
        doubt.lastReplier = userId;
        // If thread was 'finished' and someone replies, re-open it.
        // (Decided against this based on user flow, but could be added)
        // doubt.status = 'open'; 
        // doubt.expireAt = undefined; // Clear expiration
        
        await doubt.save();
        
        // Populate the new message's sender info before sending back
        const populatedDoubt = await doubt.populate('messages.sender', 'username profile.avatar role');
        const populatedReply = populatedDoubt.messages[populatedDoubt.messages.length - 1];

        res.json({ success: true, message: 'Reply posted.', newReply: populatedReply });

    } catch (error) {
        console.error("Error posting reply:", error);
        res.status(500).json({ message: 'Server error while posting reply.' });
    }
});

// @route   POST /api/doubts/:doubtId/finish
// @desc    User or Mentor marks a doubt as finished
// @access  Private (User or Mentor)
router.post('/:doubtId/finish', auth, async (req, res) => {
    try {
        const { doubtId } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(doubtId)) {
            return res.status(400).json({ message: 'Invalid doubt ID.' });
        }

        const [user, doubt] = await Promise.all([
            User.findById(userId).select('role'),
            Doubt.findById(doubtId)
        ]);
        
        if (!user) return res.status(404).json({ message: 'User not found.' });
        if (!doubt) return res.status(404).json({ message: 'Doubt thread not found.' });

        // Authorization: Must be the user who asked OR a mentor/admin
        if (doubt.user.toString() !== userId && user.role === 'user') {
            return res.status(403).json({ message: 'Access denied. You cannot close this doubt.' });
        }
        
        if (doubt.status === 'finished') {
             return res.status(400).json({ message: 'This doubt is already finished.' });
        }

        doubt.status = 'finished';
        // The pre-save hook in Doubt.js will set 'finishedAt' and 'expireAt'
        await doubt.save();

        res.json({ success: true, message: 'Doubt thread has been marked as finished.' });

    } catch (error) {
        console.error("Error finishing doubt:", error);
        res.status(500).json({ message: 'Server error while finishing doubt.' });
    }
});


module.exports = router;
