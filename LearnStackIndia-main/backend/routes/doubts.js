// backend/routes/doubt.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Doubt = require('../models/Doubt');
const User = require('../models/User');
const Topic = require('../models/Topic');

// --- Helper function (from dailyProblem.js) to check subject access ---
async function checkSubjectAccess(userId, subjectName) {
    try {
        const [user, topicsInSubject] = await Promise.all([
            User.findById(userId).select('progress learningPath').lean(),
            Topic.find({ subject: subjectName }).select('id isGloballyLocked prerequisites').lean()
        ]);

        if (!user) throw new Error('User not found');
        if (topicsInSubject.length === 0) return false; // No topics = no access

        const userProgressMap = new Map(Object.entries(user.progress || {}));
        const completedTopicsSet = new Set(user.learningPath?.completedTopics || []);

        const isSubjectAccessible = topicsInSubject.some(topic => {
            const userProgressForTopic = userProgressMap.get(topic.id);
            let prereqsMet = true;
            if (topic.prerequisites && topic.prerequisites.length > 0) {
                prereqsMet = topic.prerequisites.every(prereqId => completedTopicsSet.has(prereqId));
            }
            let userSpecificStatus = userProgressForTopic?.status || (topic.isGloballyLocked ? 'locked' : 'available');
            
            let finalEffectiveStatus = 'available';
            if (topic.isGloballyLocked) {
                finalEffectiveStatus = (userSpecificStatus !== 'locked') ? userSpecificStatus : 'locked';
            } else if (!prereqsMet) {
                finalEffectiveStatus = (userSpecificStatus !== 'locked') ? userSpecificStatus : 'locked';
            } else {
                finalEffectiveStatus = userSpecificStatus;
            }
            return finalEffectiveStatus !== 'locked';
        });
        
        return isSubjectAccessible;
    } catch (error) {
        console.error(`Error in checkSubjectAccess for user ${userId}, subject ${subjectName}:`, error);
        return false;
    }
}

// GET /api/doubt/subjects
// Get a list of *unlocked* subjects a user can ask doubts in.
router.get('/subjects', auth, async (req, res) => {
    try {
        const allSubjects = await Topic.distinct('subject');
        const accessibleSubjects = [];
        for (const subjectName of allSubjects) {
            const hasAccess = await checkSubjectAccess(req.user.id, subjectName);
            if (hasAccess) {
                accessibleSubjects.push(subjectName);
            }
        }
        res.json({ success: true, subjects: accessibleSubjects.sort() });
    } catch (error) {
        console.error("Error fetching accessible subjects:", error);
        res.status(500).json({ message: 'Error fetching subjects' });
    }
});

// POST /api/doubt/ask
// Create a new doubt thread.
router.post('/ask', auth, async (req, res) => {
    try {
        const { subject, title, message } = req.body;
        if (!subject || !title || !message) {
            return res.status(400).json({ message: 'Subject, title, and message are required.' });
        }

        const hasAccess = await checkSubjectAccess(req.user.id, subject);
        if (!hasAccess) {
            return res.status(403).json({ message: 'You must unlock this subject before asking doubts in it.' });
        }
        
        const user = await User.findById(req.user.id).select('role');

        const newDoubt = new Doubt({
            subject,
            title,
            student: req.user.id,
            status: 'open',
            messages: [{
                sender: req.user.id,
                senderRole: user.role, // 'user'
                message: message
            }]
        });

        await newDoubt.save();
        res.status(201).json({ success: true, message: 'Doubt submitted successfully.', doubt: newDoubt });
    } catch (error) {
        console.error("Error creating doubt:", error);
        res.status(500).json({ message: 'Error creating doubt' });
    }
});

// GET /api/doubt/my-doubts
// Get all doubt threads (open and closed) for the logged-in user.
router.get('/my-doubts', auth, async (req, res) => {
    try {
        const doubts = await Doubt.find({ student: req.user.id })
            .populate('mentor', 'username profile.avatar')
            .select('-messages') // Exclude full message history for the list view
            .sort({ status: 1, updatedAt: -1 }); // Show open/answered first, then newest

        res.json({ success: true, doubts });
    } catch (error) {
        console.error("Error fetching user's doubts:", error);
        res.status(500).json({ message: 'Error fetching doubts' });
    }
});

// GET /api/doubt/thread/:doubtId
// Get the full conversation for one doubt (user must be the student).
router.get('/thread/:doubtId', auth, async (req, res) => {
    try {
        const doubt = await Doubt.findById(req.params.doubtId)
            .populate('student', 'username profile.avatar')
            .populate('mentor', 'username profile.avatar')
            .populate('messages.sender', 'username profile.avatar');

        if (!doubt) {
            return res.status(404).json({ message: 'Doubt thread not found.' });
        }
        if (doubt.student._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        
        res.json({ success: true, doubt });
    } catch (error) {
        console.error("Error fetching doubt thread:", error);
        res.status(500).json({ message: 'Error fetching thread' });
    }
});

// POST /api/doubt/reply/:doubtId
// Add a new message (reply) to a doubt thread (as the student).
router.post('/reply/:doubtId', auth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const doubt = await Doubt.findById(req.params.doubtId);
        if (!doubt) {
            return res.status(404).json({ message: 'Doubt thread not found.' });
        }
        if (doubt.student.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        if (doubt.status === 'closed') {
             return res.status(400).json({ message: 'This doubt is closed. Please create a new one.' });
        }
        
        const user = await User.findById(req.user.id).select('role');

        const newMessage = {
            sender: req.user.id,
            senderRole: user.role, // 'user'
            message: message
        };
        
        doubt.messages.push(newMessage);
        doubt.status = 'open'; // Re-open the doubt (user needs a reply)
        
        await doubt.save();
        
        // Populate the new message to send back to the client
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('messages.sender', 'username profile.avatar');
        const populatedMessage = populatedDoubt.messages[populatedDoubt.messages.length - 1];

        res.status(201).json({ success: true, message: 'Reply sent.', new_message: populatedMessage });
    } catch (error) {
        console.error("Error replying to doubt:", error);
        res.status(500).json({ message: 'Error sending reply' });
    }
});

// POST /api/doubt/close/:doubtId
// Mark a doubt as "closed" (by the student).
router.post('/close/:doubtId', auth, async (req, res) => {
    try {
        const doubt = await Doubt.findById(req.params.doubtId);
        if (!doubt) {
            return res.status(404).json({ message: 'Doubt thread not found.' });
        }
        if (doubt.student.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        doubt.status = 'closed';
        // pre-save hook will set 'closedAt' and 'autoDeleteAt'
        await doubt.save(); 
        
        res.json({ success: true, message: 'Doubt thread closed.' });
    } catch (error) {
        console.error("Error closing doubt:", error);
        res.status(500).json({ message: 'Error closing doubt' });
    }
});

module.exports = router;
