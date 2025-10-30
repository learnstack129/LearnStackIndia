// routes/admin.js - Adjusted for User Model Changes
const express = require('express');
const mongoose = require('mongoose'); // Import mongoose
const adminAuth = require('../middleware/adminAuth'); // Auth middleware
const User = require('../models/User');
const Topic = require('../models/Topic');
const AchievementTemplate = require('../models/Achievement');
const Leaderboard = require('../models/Leaderboard'); // Needed for potential leaderboard actions

const router = express.Router();

// --- Stats (No change needed) ---
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [totalUsers, activeTopics, totalAchievements, leaderboardEntries] = await Promise.all([
            User.countDocuments(),
            Topic.countDocuments({ isActive: true }),
            AchievementTemplate.countDocuments({ isActive: true }),
            Leaderboard.findOne({ type: 'all-time' }).select('rankings').lean()
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeTopics,
                totalAchievements,
                leaderboardUsers: leaderboardEntries?.rankings?.length || 0
            }
        });
    } catch (error) {
        console.error("Error fetching admin stats:", error);
        res.status(500).json({ message: 'Error fetching admin stats' });
    }
});

// --- User Management ---
// Get all users (Lean() handles Maps okay for display)
router.get('/users', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.search || '';
        let sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

        // Adjust sorting keys if necessary
        if (sortBy === 'points') sortBy = 'stats.rank.points';
        else if (sortBy === 'rank') sortBy = 'stats.rank.level';
        else if (!User.schema.path(sortBy) && !['username', 'email', 'createdAt', 'role', 'stats.rank.points', 'stats.rank.level'].includes(sortBy)) {
            sortBy = 'createdAt';
            console.warn(`Invalid sortBy: ${req.query.sortBy}. Defaulting to 'createdAt'.`);
        }

        let query = {};
        if (searchTerm) {
            query = { $or: [{ username: { $regex: searchTerm, $options: 'i' } }, { email: { $regex: searchTerm, $options: 'i' } }] };
        }

        const sort = { [sortBy]: sortOrder };

        const [users, totalUsers] = await Promise.all([
            User.find(query)
                .select('-password -emailVerificationToken -passwordResetToken -dailyActivity')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(), // Use lean for performance
            User.countDocuments(query)
        ]);

        res.json({
            success: true, users,
            totalPages: Math.ceil(totalUsers / limit), currentPage: page, totalUsers
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        if (error.name === 'MongoServerError' || error instanceof mongoose.Error) {
            return res.status(500).json({ message: 'Database error fetching users', errorDetails: error.message });
        }
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// Get single user by ID (Lean() handles Maps okay for display)
router.get('/users/:id', adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -emailVerificationToken -passwordResetToken')
            .lean();

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, user });
    } catch (error) {
        console.error("Error fetching user:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid user ID format' });
        res.status(500).json({ message: 'Error fetching user' });
    }
});

// --- ADJUSTED: Get topic statuses for a specific user ---
router.get('/users/:userId/topic-statuses', adminAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const [user, topics] = await Promise.all([
            User.findById(userId).select('progress username learningPath').lean(), // Select learningPath for prereq check
            Topic.find().select('id name order isGloballyLocked prerequisites').sort({ order: 1 }).lean()
        ]);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const userProgressMap = new Map(Object.entries(user.progress || {}));
        const completedTopicsSet = new Set(user.learningPath?.completedTopics || []);

        const topicStatuses = topics.map(topic => {
            const userProgressForTopic = userProgressMap.get(topic.id);

            // Check Prerequisites
            let prereqsMet = true;
            if (topic.prerequisites && topic.prerequisites.length > 0) {
                prereqsMet = topic.prerequisites.every(prereqId => completedTopicsSet.has(prereqId));
            }

            // Determine User Specific Status
            let userSpecificStatus;
            if (userProgressForTopic?.status) { // If user has a specific status saved
                userSpecificStatus = userProgressForTopic.status;
            } else { // Otherwise, default based only on the global lock
                userSpecificStatus = topic.isGloballyLocked ? 'locked' : 'available';
            }


            // Determine Final Effective Status
            let finalEffectiveStatus;
            if (topic.isGloballyLocked) {
                finalEffectiveStatus = (userSpecificStatus !== 'locked') ? userSpecificStatus : 'locked';
            } else {
                finalEffectiveStatus = userSpecificStatus; // Already includes prereq check
            }

            // Determine Status Text
            let statusText = finalEffectiveStatus.charAt(0).toUpperCase() + finalEffectiveStatus.slice(1);
            if (finalEffectiveStatus === 'locked') {
                if (topic.isGloballyLocked && userSpecificStatus !== 'locked') statusText = `Globally Locked (User Override: ${userSpecificStatus})`; // Should not happen if final is locked?
                else if (topic.isGloballyLocked) statusText = 'Locked Globally';
                // else if (!prereqsMet) statusText = 'Locked (Prerequisites)'; // REMOVE THIS LINE
                else if (userSpecificStatus === 'locked') statusText = 'Locked for User';
                else statusText = 'Locked'; // Generic
            } else if (topic.isGloballyLocked) { // Unlocked via override
                statusText = `Unlocked for User (${statusText})`;
            }


            return {
                _id: topic._id, id: topic.id, name: topic.name,
                effectiveStatus: finalEffectiveStatus, statusText: statusText,
                isGloballyLocked: topic.isGloballyLocked,
                isUserLocked: userSpecificStatus === 'locked' // Reflects user *intent* or prerequisite lock
            };
        });

        res.json({ success: true, username: user.username, topicStatuses });

    } catch (error) {
        console.error(`Error fetching topic statuses for user ${req.params.userId}:`, error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid user ID format' });
        res.status(500).json({ message: 'Error fetching topic statuses' });
    }
});

// Update user (Minor adjustment for $unset)
router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const { role, isEmailVerified } = req.body;
        const updateData = {};
        const unsetData = {}; // Separate object for $unset

        if (role && ['user', 'admin'].includes(role)) updateData.role = role;

        if (typeof isEmailVerified === 'boolean') {
            updateData.isEmailVerified = isEmailVerified;
            if (isEmailVerified) {
                // Prepare fields for $unset
                unsetData.emailVerificationToken = "";
                unsetData.emailVerificationExpires = "";
            }
        }
        // If unsetData has keys, add it to updateData under $unset
        if (Object.keys(unsetData).length > 0) updateData.$unset = unsetData;

        const options = { new: true, runValidators: true, select: '-password' };
        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, options);

        if (!updatedUser) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        console.error("Error updating user:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid user ID format' });
        if (error.name === 'ValidationError') return res.status(400).json({ message: `Validation Error: ${error.message}` });
        res.status(500).json({ message: 'Error updating user' });
    }
});

// Delete user (No change needed)
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ message: 'User not found' });
        // Optional: Remove from leaderboards
        // await Leaderboard.updateMany({}, { $pull: { rankings: { user: req.params.id } } });
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error("Error deleting user:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid user ID format' });
        res.status(500).json({ message: 'Error deleting user' });
    }
});

// --- Topic Management (No changes needed here) ---
router.get('/topics', adminAuth, async (req, res) => { /* Keep existing */ try { const topics = await Topic.find().sort({ order: 1 }).lean(); res.json({ success: true, topics }); } catch (error) { console.error("Error fetching topics for admin:", error); res.status(500).json({ message: 'Error fetching topics' }); } });
router.get('/topics/:id', adminAuth, async (req, res) => { /* Keep existing */ try { const topic = await Topic.findById(req.params.id).lean(); if (!topic) return res.status(404).json({ message: 'Topic not found' }); res.json({ success: true, topic }); } catch (error) { console.error("Error fetching single topic:", error); if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid topic ID format' }); res.status(500).json({ message: 'Error fetching topic' }); } });
router.post('/topics', adminAuth, async (req, res) => { /* Keep existing */ try { const { id, name, description, icon, color, order, estimatedTime, difficulty, isActive, algorithms } = req.body; if (!id || !name || order === undefined || estimatedTime === undefined || !difficulty) return res.status(400).json({ message: 'Missing required topic fields (id, name, order, estimatedTime, difficulty)' }); if (algorithms && (!Array.isArray(algorithms) || algorithms.some(algo => !algo.id || !algo.name || !algo.difficulty || algo.points === undefined))) return res.status(400).json({ message: 'Invalid algorithm structure: Each must have id, name, difficulty, points.' }); const newTopic = new Topic({ id, name, description, icon, color, order, estimatedTime, difficulty, isActive, algorithms: algorithms || [] }); await newTopic.save(); res.status(201).json({ success: true, message: 'Topic created', topic: newTopic }); } catch (error) { console.error("Error creating topic:", error); if (error.code === 11000) return res.status(400).json({ message: `Topic ID '${req.body.id}' already exists.` }); if (error.name === 'ValidationError') return res.status(400).json({ message: `Validation Error: ${error.message}` }); res.status(500).json({ message: 'Error creating topic' }); } });
router.put('/topics/:id', adminAuth, async (req, res) => { /* Keep existing */ try { const { name, description, icon, color, order, estimatedTime, difficulty, isActive, algorithms } = req.body; const updateData = { name, description, icon, color, order, estimatedTime, difficulty, isActive }; if (algorithms !== undefined) { if (!Array.isArray(algorithms) || algorithms.some(algo => !algo.id || !algo.name || !algo.difficulty || algo.points === undefined)) return res.status(400).json({ message: 'Invalid algorithm structure.' }); updateData.algorithms = algorithms; } Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]); const updatedTopic = await Topic.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).lean(); if (!updatedTopic) return res.status(404).json({ message: 'Topic not found' }); res.json({ success: true, message: 'Topic updated', topic: updatedTopic }); } catch (error) { console.error("Error updating topic:", error); if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid topic ID format' }); if (error.name === 'ValidationError') return res.status(400).json({ message: `Validation Error: ${error.message}` }); res.status(500).json({ message: 'Error updating topic' }); } });
router.delete('/topics/:id', adminAuth, async (req, res) => { /* Keep existing */ try { const deletedTopic = await Topic.findByIdAndDelete(req.params.id); if (!deletedTopic) return res.status(404).json({ message: 'Topic not found' }); res.json({ success: true, message: 'Topic deleted' }); } catch (error) { console.error("Error deleting topic:", error); if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid topic ID format' }); res.status(500).json({ message: 'Error deleting topic' }); } });


// --- Achievement Management (No changes needed here) ---
router.get('/achievements', adminAuth, async (req, res) => { /* Keep existing */ try { const achievements = await AchievementTemplate.find().sort({ category: 1, points: 1 }).lean(); res.json({ success: true, achievements }); } catch (error) { console.error("Error fetching achievements for admin:", error); res.status(500).json({ message: 'Error fetching achievements' }); } });
router.get('/achievements/:id', adminAuth, async (req, res) => { /* Keep existing */ try { const achievement = await AchievementTemplate.findById(req.params.id).lean(); if (!achievement) return res.status(404).json({ message: 'Achievement not found' }); achievement.criteriaJson = JSON.stringify(achievement.criteria || {}, null, 2); res.json({ success: true, achievement }); } catch (error) { console.error("Error fetching single achievement:", error); if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid achievement ID format' }); res.status(500).json({ message: 'Error fetching achievement' }); } });
router.post('/achievements', adminAuth, async (req, res) => { /* Keep existing */ try { const { id, name, description, icon, category, points, criteriaJson, isActive, rarity } = req.body; if (!id || !name || !description || !icon || !category || points === undefined || !criteriaJson) return res.status(400).json({ message: 'Missing required fields' }); let criteria; try { criteria = JSON.parse(criteriaJson); if (typeof criteria !== 'object' || criteria === null || typeof criteria.type !== 'string' || criteria.value === undefined) throw new Error("Criteria JSON must be object with 'type' and 'value'."); } catch (e) { return res.status(400).json({ message: `Invalid Criteria JSON: ${e.message}` }); } const newAchievement = new AchievementTemplate({ id, name, description, icon, category, points, criteria, isActive: isActive !== undefined ? isActive : true, rarity: rarity || 'common' }); await newAchievement.save(); res.status(201).json({ success: true, message: 'Achievement created', achievement: newAchievement }); } catch (error) { console.error("Error creating achievement:", error); if (error.code === 11000) return res.status(400).json({ message: `Achievement ID '${req.body.id}' already exists.` }); if (error.name === 'ValidationError') return res.status(400).json({ message: `Validation Error: ${error.message}` }); res.status(500).json({ message: 'Error creating achievement' }); } });
router.put('/achievements/:id', adminAuth, async (req, res) => { /* Keep existing */ try { const { name, description, icon, category, points, criteriaJson, isActive, rarity } = req.body; const updateData = { name, description, icon, category, points, isActive, rarity }; if (criteriaJson !== undefined) { let criteria; try { criteria = JSON.parse(criteriaJson); if (typeof criteria !== 'object' || criteria === null || typeof criteria.type !== 'string' || criteria.value === undefined) throw new Error("Criteria JSON must be object with 'type' and 'value'."); updateData.criteria = criteria; } catch (e) { return res.status(400).json({ message: `Invalid Criteria JSON: ${e.message}` }); } } Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]); const updatedAchievement = await AchievementTemplate.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).lean(); if (!updatedAchievement) return res.status(404).json({ message: 'Achievement not found' }); res.json({ success: true, message: 'Achievement updated', achievement: updatedAchievement }); } catch (error) { console.error("Error updating achievement:", error); if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid achievement ID format' }); if (error.name === 'ValidationError') return res.status(400).json({ message: `Validation Error: ${error.message}` }); res.status(500).json({ message: 'Error updating achievement' }); } });
router.delete('/achievements/:id', adminAuth, async (req, res) => { /* Keep existing */ try { const deletedAchievement = await AchievementTemplate.findByIdAndDelete(req.params.id); if (!deletedAchievement) return res.status(404).json({ message: 'Achievement not found' }); await User.updateMany({}, { $pull: { achievements: { id: deletedAchievement.id } } }); res.json({ success: true, message: 'Achievement deleted' }); } catch (error) { console.error("Error deleting achievement:", error); if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid achievement ID format' }); res.status(500).json({ message: 'Error deleting achievement' }); } });


// --- Leaderboard Management (Utility needs adjustment) ---
async function generateLeaderboardUtility(type) {
    console.log(`Generating leaderboard of type: ${type}`);
    let sortCriteria = { 'stats.rank.points': -1 };
    // Add time-based filtering if needed for daily, weekly, monthly based on User.dailyActivity or timestamps

    const users = await User.find({}) // Add filters if needed
        .select('username profile stats') // Ensure all required stats are selected
        .sort(sortCriteria)
        .limit(100)
        .lean(); // Use lean

    const rankings = users.map((user, index) => ({
        user: user._id,
        position: index + 1,
        score: user.stats?.rank?.points ?? 0, // Safe access
        metrics: { // Safe access for metrics
            algorithmsCompleted: user.stats?.algorithmsCompleted ?? 0,
            averageAccuracy: user.stats?.averageAccuracy ?? 0,
            timeSpent: user.stats?.timeSpent?.total ?? 0,
            streak: user.stats?.streak?.current ?? 0
        }
    }));

    let period = { start: new Date(0), end: null }; // Default all-time
    // Add logic for daily/weekly/monthly periods if implementing those types

    // Use updateOne with upsert to create or replace
    await Leaderboard.updateOne(
        { type },
        { type, period, rankings, lastUpdated: new Date() },
        { upsert: true }
    );
    console.log(`Generated/Updated ${type} leaderboard with ${rankings.length} entries.`);
}

router.post('/leaderboard/regenerate', adminAuth, async (req, res) => {
    try {
        const { type = 'all-time' } = req.body;
        console.log(`Admin requested regeneration of ${type} leaderboard...`);
        await generateLeaderboardUtility(type); // Uses upsert now
        res.json({ success: true, message: `Leaderboard type '${type}' regenerated/updated.` });
    } catch (error) {
        console.error("Error regenerating leaderboard:", error);
        res.status(500).json({ message: 'Error regenerating leaderboard' });
    }
});


// --- ADJUSTED: Lock a topic (Globally or User-Specific) ---
router.post('/topics/:topicMongoId/lock', adminAuth, async (req, res) => {
    try {
        const { userId, global } = req.body;
        const topicMongoId = req.params.topicMongoId;

        const topicToLock = await Topic.findById(topicMongoId).select('id name');
        if (!topicToLock) return res.status(404).json({ message: 'Topic not found' });
        const topicCustomId = topicToLock.id;

        if (global) {
            // Global Lock
            const updatedTopic = await Topic.findByIdAndUpdate(topicMongoId, { isGloballyLocked: true }, { new: true });
            if (!updatedTopic) return res.status(404).json({ message: 'Topic not found during update' });
            console.log(`Topic ${topicToLock.name} globally locked. Resetting user statuses...`);
            // Reset status for users who have this topic in their progress map AND status is not 'locked'
            const updateFilter = { [`progress.${topicCustomId}.status`]: { $ne: 'locked' } };
            const updateOperation = { $set: { [`progress.${topicCustomId}.status`]: 'locked' } };
            const updateResult = await User.updateMany(updateFilter, updateOperation);
            console.log(`Set status to 'locked' for ${updateResult.modifiedCount} users for topic ${topicCustomId}.`);
            return res.json({ success: true, message: `Topic "${topicToLock.name}" locked globally.` });

        } else if (userId) {
            // User-Specific Lock
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            let topicProgress = user.progress.get(topicCustomId);
            if (!topicProgress) { // Initialize if doesn't exist
                topicProgress = { status: 'locked', completion: 0, totalTime: 0, algorithms: new Map() };
            } else {
                topicProgress.status = 'locked'; // Set status
            }
            user.progress.set(topicCustomId, topicProgress); // Update map
            user.markModified('progress'); // Mark modified
            await user.save();
            console.log(`Topic ${topicCustomId} locked for user ${user.username}.`);
            return res.json({ success: true, message: `Topic "${topicToLock.name}" locked for user "${user.username}".` });
        } else {
            return res.status(400).json({ message: 'Request must specify "userId" or "global: true".' });
        }
    } catch (error) {
        console.error("Error locking topic:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid ID format' });
        res.status(500).json({ message: 'Error locking topic' });
    }
});

// --- ADJUSTED: Unlock a topic (Globally or User-Specific) ---
router.post('/topics/:topicMongoId/unlock', adminAuth, async (req, res) => {
    try {
        const { userId, global } = req.body;
        const topicMongoId = req.params.topicMongoId;

        console.log(`[Unlock Request] Topic: ${topicMongoId}, Global: ${global}, User: ${userId}`);

        // Fetch topic WITH prerequisites
        const topicToUnlock = await Topic.findById(topicMongoId).select('id name isGloballyLocked prerequisites');
        if (!topicToUnlock) return res.status(404).json({ message: 'Topic not found' });
        console.log(`[Unlock Info] Topic: ${topicToUnlock.name}, GlobalLock: ${topicToUnlock.isGloballyLocked}`);

        if (global) {
            // Global Unlock
            if (!topicToUnlock.isGloballyLocked) return res.json({ success: true, message: `Topic "${topicToUnlock.name}" is already globally unlocked.` });
            topicToUnlock.isGloballyLocked = false;
            await topicToUnlock.save();
            console.log(`[Unlock Success] Topic ${topicToUnlock.name} globally unlocked.`);
            // Note: This does NOT automatically change user-specific 'locked' statuses. They remain locked until prerequisites are met or admin unlocks individually.
            return res.json({ success: true, message: `Topic "${topicToUnlock.name}" unlocked globally.` });

        } else if (userId) {
            // User-Specific Unlock
            const user = await User.findById(userId).select('progress learningPath'); // Select learningPath for prereqs
            if (!user) return res.status(404).json({ message: 'User not found' });

            const topicCustomId = topicToUnlock.id;
            const userProgressForTopic = user.progress.get(topicCustomId);
            const userSpecificStatus = userProgressForTopic?.status || 'available'; // Default assumes available if no record

            console.log(`[Unlock Info] User: ${user.id}, Topic: ${topicCustomId}, UserStatus: ${userSpecificStatus}`);

            // Check prerequisites for the user
            if (userSpecificStatus === 'locked') {
                // Determine new status - Admin unlock always makes it 'available' for the user
                const newStatus = 'available'; // Set directly to available
                console.log(`[Unlock Action] Admin override. Setting user ${userId} status for ${topicCustomId} to '${newStatus}'`);

                let topicProgressToUpdate = user.progress.get(topicCustomId);
                if (!topicProgressToUpdate) {
                    topicProgressToUpdate = { status: newStatus, completion: 0, totalTime: 0, algorithms: new Map() };
                } else {
                    topicProgressToUpdate.status = newStatus; // Update status
                }
                user.progress.set(topicCustomId, topicProgressToUpdate);
                user.markModified('progress');

                await user.save();
                const message = newStatus === 'available'
                    ? `Topic "${topicToUnlock.name}" unlocked for user "${user.username}".`
                    : `Topic "${topicToUnlock.name}" remains locked for user "${user.username}" (Prerequisites not met).`;
                console.log(`[Unlock Result] ${message}`);
                return res.json({ success: true, message: message });
            } else {
                console.log(`[Unlock Info] Topic ${topicCustomId} already accessible (Status: ${userSpecificStatus}) to user ${user.username}.`);
                return res.json({ success: true, message: `Topic "${topicToUnlock.name}" is already accessible to user "${user.username}".` });
            }
        } else {
            return res.status(400).json({ message: 'Request must specify "userId" or "global: true".' });
        }
    } catch (error) {
        console.error("[Unlock Error] General error:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid ID format' });
        res.status(500).json({ message: 'Server error during topic unlock' });
    }
});router.post('/topics/:topicMongoId/algorithms/:algoId/lock', adminAuth, async (req, res) => {
    try {
        const { userId, global } = req.body;
        const { topicMongoId, algoId } = req.params; // algoId is the string ID like 'bubbleSort'

        // Find the topic
        const topic = await Topic.findById(topicMongoId);
        if (!topic) return res.status(404).json({ message: 'Topic not found' });

        // Find the algorithm within the topic
        const algorithm = topic.algorithms.find(a => a.id === algoId);
        if (!algorithm) return res.status(404).json({ message: `Algorithm '${algoId}' not found in topic '${topic.name}'` });

        if (global) {
            // Global Lock
            algorithm.isGloballyLocked = true;
            await topic.save();
            console.log(`Algorithm ${algoId} globally locked in topic ${topic.name}.`);
            // Note: This doesn't automatically update user progress status like topic locks did.
            // Access checks will handle the global lock dynamically.
            return res.json({ success: true, message: `Algorithm "${algorithm.name}" locked globally.` });

        } else if (userId) {
            // User-Specific Lock
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            const topicProgress = user.progress.get(topic.id);
            if (!topicProgress) {
                 return res.status(400).json({ message: `User has no progress data for topic '${topic.name}'. Cannot lock algorithm.` });
            }

            let algoProgress = topicProgress.algorithms.get(algoId);
            if (!algoProgress) { // Initialize if doesn't exist
                 algoProgress = { status: 'locked', completed: false }; // Set locked status
                 console.log(`Initialized and locked algo progress for ${topic.id}.${algoId} for user ${userId}`);
            } else {
                 algoProgress.status = 'locked'; // Set status to locked
                 console.log(`Set algo progress status to locked for ${topic.id}.${algoId} for user ${userId}`);
            }
            topicProgress.algorithms.set(algoId, algoProgress); // Update map
            user.markModified('progress'); // Mark modified
            await user.save();
            return res.json({ success: true, message: `Algorithm "${algorithm.name}" locked for user "${user.username}".` });
        } else {
            return res.status(400).json({ message: 'Request must specify "userId" or "global: true".' });
        }
    } catch (error) {
        console.error("Error locking algorithm:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid Topic ID format' });
        res.status(500).json({ message: 'Error locking algorithm' });
    }
});

// --- NEW: Unlock an Algorithm (Globally or User-Specific) ---
router.post('/topics/:topicMongoId/algorithms/:algoId/unlock', adminAuth, async (req, res) => {
     try {
        const { userId, global } = req.body;
        const { topicMongoId, algoId } = req.params;

        // Find the topic
        const topic = await Topic.findById(topicMongoId);
        if (!topic) return res.status(404).json({ message: 'Topic not found' });

        // Find the algorithm within the topic
        const algorithm = topic.algorithms.find(a => a.id === algoId);
        if (!algorithm) return res.status(404).json({ message: `Algorithm '${algoId}' not found in topic '${topic.name}'` });

        if (global) {
            // Global Unlock
            if (!algorithm.isGloballyLocked) {
                 return res.json({ success: true, message: `Algorithm "${algorithm.name}" is already globally unlocked.` });
            }
            algorithm.isGloballyLocked = false;
            await topic.save();
            console.log(`Algorithm ${algoId} globally unlocked in topic ${topic.name}.`);
            return res.json({ success: true, message: `Algorithm "${algorithm.name}" unlocked globally.` });

        } else if (userId) {
            // User-Specific Unlock (Admin override - ignores prerequisites/topic lock)
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            const topicProgress = user.progress.get(topic.id);
             if (!topicProgress) {
                 // If no topic progress, we can assume the algo isn't locked *specifically* for the user yet.
                 console.log(`User ${userId} has no progress for topic ${topic.id}. Algorithm ${algoId} considered available.`);
                 return res.json({ success: true, message: `Algorithm "${algorithm.name}" is effectively available (no user-specific lock found).` });
             }

            let algoProgress = topicProgress.algorithms.get(algoId);

            if (algoProgress && algoProgress.status === 'locked') {
                 // Only change if it was specifically locked for the user
                 algoProgress.status = 'available'; // Set status to available
                 topicProgress.algorithms.set(algoId, algoProgress); // Update map
                 user.markModified('progress'); // Mark modified
                 await user.save();
                 console.log(`Algorithm ${algoId} unlocked for user ${userId} in topic ${topic.id}.`);
                 return res.json({ success: true, message: `Algorithm "${algorithm.name}" unlocked for user "${user.username}".` });
            } else {
                 // Algorithm wasn't specifically locked for the user
                 console.log(`Algorithm ${algoId} was not specifically locked for user ${userId} in topic ${topic.id}. Status remains '${algoProgress?.status || 'default available'}'.`);
                 return res.json({ success: true, message: `Algorithm "${algorithm.name}" was not specifically locked for user "${user.username}".` });
            }
        } else {
            return res.status(400).json({ message: 'Request must specify "userId" or "global: true".' });
        }
    } catch (error) {
        console.error("Error unlocking algorithm:", error);
        if (error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid Topic ID format' });
        res.status(500).json({ message: 'Error unlocking algorithm' });
    }
});




module.exports = router;