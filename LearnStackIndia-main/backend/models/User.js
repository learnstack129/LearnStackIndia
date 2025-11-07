// models/User.js - Enhanced User Model with Dynamic Progress
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Import Topic model to get the total number of algorithms dynamically
const Topic = require('./Topic'); // Assuming Topic model is in the same directory

// --- Sub-schema for Algorithm Progress ---
// ... (no changes in this sub-schema)
const algorithmProgressSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['locked', 'available', 'completed'], 
        default: 'available'
    },
    completed: { type: Boolean, default: false },
    timeSpentViz: { type: Number, default: 0 },
    lastAttemptViz: Date,
    accuracyPractice: { type: Number, default: 0, min: 0, max: 100 },
    bestTimePractice: { type: Number, default: null },
    attemptsPractice: { type: Number, default: 0 },
    pointsPractice: { type: Number, default: 0 },
    lastAttemptPractice: Date,
    notes: String
}, { _id: false });

// --- Sub-schema for Topic Progress ---
// ... (no changes in this sub-schema)
const topicProgressSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['locked', 'available', 'in-progress', 'completed'],
        default: 'available'
    },
    completion: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    totalTime: {
        type: Number,
        default: 0
    },
    algorithms: {
        type: Map,
        of: algorithmProgressSchema,
        default: () => new Map()
    }
}, { _id: false });

// --- Sub-schema for Earned Achievements ---
// ... (no changes in this sub-schema)
const earnedAchievementSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: String,
    description: String,
    icon: String,
    points: Number,
    category: {
        type: String,
        enum: ['learning', 'performance', 'consistency', 'mastery', 'special'],
        required: true
    },
    rarity: {
        type: String,
        enum: ['common', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    criteria: {
        type: mongoose.Schema.Types.Mixed
    },
    earnedAt: { type: Date, default: Date.now },
    isVisible: { type: Boolean, default: true }
}, { _id: false });

// --- Sub-schema for Daily Activity ---
// ... (no changes in this sub-schema)
const dailyActivitySessionSchema = new mongoose.Schema({
    startTime: Date,
    endTime: Date,
    topic: String,
    algorithm: String,
    accuracy: Number,
    timeSpent: Number,
    points: Number
}, { _id: false });

const dailyActivitySchema = new mongoose.Schema({
    date: { type: Date, required: true, index: true },
    timeSpent: { type: Number, default: 0 },
    algorithmsAttempted: { type: Number, default: 0 },
    algorithmsCompleted: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    topicsStudied: [String],
    sessions: [dailyActivitySessionSchema]
}, { _id: false });

// --- NEW: Sub-schema for Test Attempts ---
// ... (no changes in this sub-schema)
const testAttemptSchema = new mongoose.Schema({
    testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
        required: true
    },
    status: {
        type: String,
        enum: ['inprogress', 'locked', 'completed'],
        default: 'inprogress'
    },
    strikes: {
        type: Number,
        default: 0
    },
    score: {
        type: Number,
        default: 0
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
}, { _id: true });

// --- *** MODIFICATION START *** ---
const dailyProblemAttemptSchema = new mongoose.Schema({
    problemId: { // Reference to the DailyProblem
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DailyProblem',
        required: true
    },
    runCount: { // Tracks the 2-run limit
        type: Number,
        default: 0
    },
    isLocked: { // Locks after 2 failed runs or 1 pass
        type: Boolean,
        default: false
    },
    passed: { // Did they ever pass?
        type: Boolean,
        default: false
    },
    // Changed from Boolean to Number to store points from this attempt
    pointsAwarded: { 
        type: Number,
        default: 0
    },
    lastSubmittedCode: { // The code for the mentor to review
        type: String
    },
    lastResults: { // e.g., "Passed 3/5 test cases"
        type: String
    },
    mentorFeedback: { // The mentor's suggestion
        type: String,
        default: null
    },
    feedbackRead: {
        type: Boolean,
        default: false
    },
    lastAttemptedAt: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });
// --- *** MODIFICATION END *** ---


// --- Main User Schema ---
const userSchema = new mongoose.Schema({
    // ... (Authentication & Profile fields are unchanged) ...
    username: {
        type: String, required: [true, 'Username is required'], unique: true, trim: true,
        minlength: [3, 'Username must be at least 3 characters long'], index: true
    },
    email: {
        type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'], index: true
    },
    password: {
        type: String, required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'], select: false
    },
    role: { 
        type: String, 
        enum: ['user', 'mentor', 'admin'],
        default: 'user' 
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordChangedAt: Date,
    profile: {
        avatar: { type: String, default: 'https://placeholder-image-service.onrender.com/image/100x100?prompt=User%20avatar%20profile%20picture%20with%20neutral%20background' },
        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },
        bio: { type: String, trim: true, maxlength: 200 },
        location: { type: String, trim: true },
        website: { type: String, trim: true },
        socialLinks: {
            type: Map,
            of: String,
            default: () => new Map()
        }
    },
    progress: { // Dynamic Map for topics
        type: Map,
        of: topicProgressSchema,
        default: () => new Map()
    },
    
    // --- *** MODIFICATION START *** ---
    stats: {
        overallProgress: { type: Number, default: 0, min: 0, max: 100 },
        rank: {
            level: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'], default: 'Bronze' },
            points: { type: Number, default: 0, index: true } // Main leaderboard points
        },
        // New field for the daily problem leaderboard
        dailyProblemPoints: { type: Number, default: 0, index: true },
        
        timeSpent: { // All in minutes
            total: { type: Number, default: 0 },
            today: { type: Number, default: 0 },
            thisWeek: { type: Number, default: 0 },
            thisMonth: { type: Number, default: 0 }
        },
        algorithmsCompleted: { type: Number, default: 0 },
        streak: {
            current: { type: Number, default: 0 },
            longest: { type: Number, default: 0 },
            lastActiveDate: Date
        },
        averageAccuracy: { type: Number, default: 0, min: 0, max: 100 }
    },
    // --- *** MODIFICATION END *** ---

    achievements: {
        type: [earnedAchievementSchema],
        default: []
    },
    learningPath: {
        currentTopic: { type: String, default: null },
        completedTopics: { type: [String], default: [] },
        topicOrder: { type: [String], default: [] },
    },
    testAttempts: [testAttemptSchema],
    dailyProblemAttempts: [dailyProblemAttemptSchema], // Uses the modified schema
    dailyActivity: {
        type: [dailyActivitySchema],
        default: []
    },
    preferences: {
        theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
        notifications: {
            email: { type: Boolean, default: true },
            dailyReminder: { type: Boolean, default: false },
            achievementUpdates: { type: Boolean, default: true },
            weeklyReport: { type: Boolean, default: false }
        },
        privacy: {
            showProfile: { type: Boolean, default: true },
            showProgress: { type: Boolean, default: true },
            showOnLeaderboard: { type: Boolean, default: true }
        },
        learning: {
            difficultyPreference: { type: String, enum: ['easy', 'medium', 'hard', 'any'], default: 'any' },
            autoAdvance: { type: Boolean, default: true },
            dailyGoalMinutes: { type: Number, default: 30 }
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// --- VIRTUALS ---
// ... (no changes to virtuals) ...
userSchema.virtual('fullName').get(function () {
    return [this.profile.firstName, this.profile.lastName].filter(Boolean).join(' ') || this.username;
});
userSchema.virtual('totalAchievements').get(function () {
    return this.achievements.length;
});
userSchema.virtual('completionPercentage').get(function () {
    let totalAlgorithms = 0;
    let completedAlgorithms = 0;
    this.progress.forEach((topicProgress) => {
        topicProgress.algorithms.forEach((algoProgress) => {
            totalAlgorithms++;
            if (algoProgress.completed) {
                completedAlgorithms++;
            }
        });
    });
    return totalAlgorithms > 0 ? Math.round((completedAlgorithms / totalAlgorithms) * 100) : 0;
});

// --- MIDDLEWARE ---
// ... (no changes to pre-save logic) ...
userSchema.pre('save', async function (next) {
    console.log(`[User Pre-Save] Running for: ${this.username}`);
    if (this.isModified('password')) {
        console.log('[User Pre-Save] Hashing password...');
        this.password = await bcrypt.hash(this.password, 12);
        if (!this.isNew) {
            this.passwordResetToken = undefined;
            this.passwordResetExpires = undefined;
        }
    }
    if (this.isNew) {
        console.log('[User Pre-Save] Initializing progress for new user...');
        if (!this.stats) { this.stats = {}; }
        this.stats.rank = { level: 'Bronze', points: 0 };
        this.stats.streak = { current: 0, longest: 0, lastActiveDate: null };
        this.stats.timeSpent = { total: 0, today: 0, thisWeek: 0, thisMonth: 0 };
        
        // --- *** MODIFICATION START *** ---
        // Ensure dailyProblemPoints is initialized
        this.stats.dailyProblemPoints = 0; 
        // --- *** MODIFICATION END *** ---

        if (!this.learningPath) { this.learningPath = {}; }
        try {
            const Topic = require('./Topic'); 
            const topics = await Topic.find({ isActive: true }).sort({ order: 1 }).select('id algorithms isGloballyLocked order').lean();
            const topicOrder = [];
            topics.forEach(topic => {
                topicOrder.push(topic.id);
                const algoMap = new Map();
                if (topic.algorithms) {
                    topic.algorithms.forEach(algo => {
                        algoMap.set(algo.id, {});
                    });
                }
                const initialStatus = topic.isGloballyLocked ? 'locked' : 'available';
                this.progress.set(topic.id, {
                    status: initialStatus,
                    completion: 0,
                    totalTime: 0,
                    algorithms: algoMap
                });
            });
            this.learningPath.topicOrder = topicOrder; 
            this.learningPath.currentTopic = topicOrder.length > 0 ? topicOrder[0] : null;
            console.log(`[User Pre-Save] Initialized progress for ${topics.length} topics. Current: ${this.learningPath.currentTopic}`);
        } catch (error) {
            console.error('[User Pre-Save] Error initializing progress:', error);
            return next(new Error('Failed to initialize user topics: ' + error.message));
        }
    }
    if (!this.isNew) {
        console.log('[User Pre-Save] Recalculating derived stats...');
        if (!this.stats) { this.stats = {}; } 
        if (!this.stats.rank) { this.stats.rank = { level: 'Bronze', points: 0 }; }
        if (!this.stats.streak) { this.stats.streak = { current: 0, longest: 0, lastActiveDate: null }; }
        if (!this.stats.timeSpent) { this.stats.timeSpent = { total: 0, today: 0, thisWeek: 0, thisMonth: 0 }; }
        if (!this.learningPath) { this.learningPath = { completedTopics: [] }; }
        
        // --- *** MODIFICATION START *** ---
        // Ensure dailyProblemPoints exists before recalculating
        if (this.stats.dailyProblemPoints === undefined || this.stats.dailyProblemPoints === null) {
            this.stats.dailyProblemPoints = 0;
        }
        // --- *** MODIFICATION END *** ---
        
        let totalCompleted = 0;
        let totalTrackedAlgos = 0;
        let totalAccuracySum = 0;
        let practiceAlgoCount = 0;
        let totalTopicCompletionSum = 0;
        let activeTopicCount = 0; 
        this.progress.forEach((topicProgress, topicId) => {
            let topicCompletedAlgos = 0;
            let topicTotalAlgos = 0;
            if (topicProgress.algorithms && topicProgress.algorithms.size > 0) {
                activeTopicCount++;
                topicProgress.algorithms.forEach((algoProgress) => {
                    topicTotalAlgos++;
                    totalTrackedAlgos++;
                    if (algoProgress.completed) {
                        topicCompletedAlgos++;
                        totalCompleted++;
                    }
                    if (algoProgress.attemptsPractice > 0) {
                        totalAccuracySum += algoProgress.accuracyPractice;
                        practiceAlgoCount++;
                    }
                });
                topicProgress.completion = topicTotalAlgos > 0 ? Math.round((topicCompletedAlgos / topicTotalAlgos) * 100) : 0;
                totalTopicCompletionSum += topicProgress.completion;
                if (topicProgress.status !== 'locked') {
                    if (topicProgress.completion === 100 && topicProgress.status !== 'completed') {
                        topicProgress.status = 'completed';
                        if (!this.learningPath.completedTopics.includes(topicId)) {
                            this.learningPath.completedTopics.push(topicId);
                            this.markModified('learningPath.completedTopics');
                        }
                    } else if (topicProgress.completion > 0 && topicProgress.status === 'available') {
                        topicProgress.status = 'in-progress';
                    }
                }
            } else {
                topicProgress.completion = 0;
            }
        });
        this.stats.algorithmsCompleted = totalCompleted;
        this.stats.overallProgress = activeTopicCount > 0 ? Math.round(totalTopicCompletionSum / activeTopicCount) : 0;
        this.stats.averageAccuracy = practiceAlgoCount > 0 ? Math.round(totalAccuracySum / practiceAlgoCount) : 0;
        console.log(`[User Pre-Save] Stats updated: Completed=${totalCompleted}, Overall%=${this.stats.overallProgress}, AvgAcc%=${this.stats.averageAccuracy}`);
        this.updateRank();
        console.log(`[User Pre-Save] Rank updated: Level=${this.stats.rank.level}, Points=${this.stats.rank.points}`);
        this.markModified('progress');
    }
    next();
});

// --- INSTANCE METHODS ---
// ... (correctPassword, updateDailyActivity, updateRank, unlockNextTopic, awardAchievement, hasAchievement are unchanged) ...
userSchema.methods.correctPassword = async function (candidatePassword) {
    if (!this.password) {
        console.error(`Password not selected for user ${this.username} during correctPassword check.`);
        return false;
    }
    return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.updateDailyActivity = function (activityData = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todayActivity = this.dailyActivity.find(activity =>
        activity.date instanceof Date && activity.date.getTime() === today.getTime()
    );
    let isNewDayRecord = false;
    if (!todayActivity) {
        todayActivity = { date: today, timeSpent: 0, algorithmsAttempted: 0, algorithmsCompleted: 0, pointsEarned: 0, topicsStudied: [], sessions: [] };
        this.dailyActivity.push(todayActivity);
        isNewDayRecord = true;
    }
    const timeIncrementMinutes = activityData.timeSpent || 0;
    todayActivity.timeSpent += timeIncrementMinutes;
    todayActivity.algorithmsAttempted += activityData.algorithmsAttempted || 0;
    todayActivity.algorithmsCompleted += activityData.algorithmsCompleted || 0;
    todayActivity.pointsEarned += activityData.pointsEarned || 0;
    if (activityData.topic && !todayActivity.topicsStudied.includes(activityData.topic)) {
        todayActivity.topicsStudied.push(activityData.topic);
    }
    if (activityData.session) {
        todayActivity.sessions.push(activityData.session);
    }
    if (!this.stats) { this.stats = {}; }
    if (!this.stats.timeSpent) { this.stats.timeSpent = { total: 0, today: 0, thisWeek: 0, thisMonth: 0 }; }
    if (!this.stats.streak) { this.stats.streak = { current: 0, longest: 0, lastActiveDate: null }; }
    this.stats.timeSpent.today = todayActivity.timeSpent;
    this.stats.timeSpent.total = (this.stats.timeSpent.total || 0) + timeIncrementMinutes;
    const lastActive = this.stats.streak.lastActiveDate;
    let daysDiff = -1;
    if (lastActive) {
        const lastActiveDay = new Date(lastActive);
        lastActiveDay.setHours(0, 0, 0, 0);
        daysDiff = Math.floor((today.getTime() - lastActiveDay.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (daysDiff !== 0) {
        if (daysDiff === 1) {
            this.stats.streak.current = (this.stats.streak.current || 0) + 1;
        } else {
            this.stats.streak.current = 1;
        }
        this.stats.streak.lastActiveDate = today;
        if (this.stats.streak.current > (this.stats.streak.longest || 0)) {
            this.stats.streak.longest = this.stats.streak.current;
        }
        this.markModified('stats.streak');
    }
    this.markModified('dailyActivity');
    this.markModified('stats.timeSpent');
};
userSchema.methods.updateRank = function () {
    if (!this.stats) {
        this.stats = {};
    }
    if (!this.stats.rank) {
        this.stats.rank = { level: 'Bronze', points: 0 };
    }
    const points = this.stats.rank.points || 0;
    let newLevel = 'Bronze';
    const thresholds = { Diamond: 10000, Platinum: 5000, Gold: 2000, Silver: 500, Bronze: 0 };
    if (points >= thresholds.Diamond) newLevel = 'Diamond';
    else if (points >= thresholds.Platinum) newLevel = 'Platinum';
    else if (points >= thresholds.Gold) newLevel = 'Gold';
    else if (points >= thresholds.Silver) newLevel = 'Silver';
    if (this.stats.rank.level !== newLevel) {
        console.log(`[User UpdateRank] Rank changed for ${this.username}: ${this.stats.rank.level} -> ${newLevel}`);
        this.stats.rank.level = newLevel;
        this.markModified('stats.rank');
    }
};
userSchema.methods.unlockNextTopic = async function () {
    console.log(`[User UnlockNext] Checking for ${this.username}...`);
    const currentTopicId = this.learningPath.currentTopic;
    const topicOrder = this.learningPath.topicOrder;
    const completedTopicsSet = new Set(this.learningPath.completedTopics);
    if (!currentTopicId || !topicOrder || topicOrder.length === 0) {
        console.log('[User UnlockNext] No current topic or topic order defined.');
        return;
    }
    const currentIndex = topicOrder.indexOf(currentTopicId);
    let nextTopicId = null;
    if (currentIndex >= 0 && currentIndex < topicOrder.length - 1) {
        nextTopicId = topicOrder[currentIndex + 1];
    }
    if (!nextTopicId) {
        console.log('[User UnlockNext] Already at the last topic or invalid current topic index.');
        return;
    }
    const nextTopicProgress = this.progress.get(nextTopicId);
    if (nextTopicProgress && nextTopicProgress.status === 'locked') {
        console.log(`[User UnlockNext] Next topic is ${nextTopicId}. Checking prerequisites...`);
        const nextTopicDef = await Topic.findOne({ id: nextTopicId }).select('prerequisites').lean();
        let prerequisitesMet = true;
        if (nextTopicDef && nextTopicDef.prerequisites && nextTopicDef.prerequisites.length > 0) {
            prerequisitesMet = nextTopicDef.prerequisites.every(prereqId =>
                completedTopicsSet.has(prereqId) && (this.progress.get(prereqId)?.completion === 100)
            );
            console.log(`[User UnlockNext] Prerequisites for ${nextTopicId}: ${nextTopicDef.prerequisites.join(', ')}. Met: ${prerequisitesMet}`);
        } else {
            console.log(`[User UnlockNext] No prerequisites defined for ${nextTopicId}.`);
        }
        if (prerequisitesMet) {
            console.log(`[User UnlockNext] Prerequisites met. Unlocking topic: ${nextTopicId}`);
            nextTopicProgress.status = 'available';
            this.progress.set(nextTopicId, nextTopicProgress);
            this.markModified('progress');
            console.log(`[User UnlockNext] Topic ${nextTopicId} status set to 'available'.`);
        } else {
            console.log(`[User UnlockNext] Prerequisites not yet met for ${nextTopicId}.`);
        }
    } else if (nextTopicProgress) {
        console.log(`[User UnlockNext] Next topic ${nextTopicId} is already unlocked (Status: ${nextTopicProgress.status}).`);
    } else {
        console.warn(`[User UnlockNext] Next topic ${nextTopicId} not found in user's progress map.`);
    }
    const currentTopicProgress = this.progress.get(currentTopicId);
    if (currentTopicProgress && currentTopicProgress.completion === 100 && nextTopicId) {
        const nextStatus = this.progress.get(nextTopicId)?.status;
        if (nextStatus === 'available' || nextStatus === 'in-progress' || nextStatus === 'completed') {
            this.learningPath.currentTopic = nextTopicId;
            this.markModified('learningPath');
            console.log(`[User UnlockNext] Advanced current topic to: ${nextTopicId}`);
        } else {
            console.log(`[User UnlockNext] Current topic ${currentTopicId} completed, but next topic ${nextTopicId} is still locked. Not advancing.`);
        }
    } else {
        console.log(`[User UnlockNext] Current topic ${currentTopicId} not completed or no next topic. Not advancing.`);
    }
};
userSchema.methods.awardAchievement = function (achievementTemplate) {
    if (!achievementTemplate || !achievementTemplate.id) {
        console.error("[AwardAchievement] Invalid achievement template provided.");
        return false;
    }
    if (this.achievements.some(ach => ach.id === achievementTemplate.id)) {
        return false;
    }
    const earnedAchievement = {
        id: achievementTemplate.id,
        name: achievementTemplate.name,
        description: achievementTemplate.description,
        icon: achievementTemplate.icon,
        points: achievementTemplate.points,
        category: achievementTemplate.category,
        rarity: achievementTemplate.rarity || 'common',
        criteria: achievementTemplate.criteria,
        earnedAt: new Date(),
        isVisible: true
    };
    this.achievements.push(earnedAchievement);
    this.markModified('achievements');
    this.stats.rank.points = (this.stats.rank.points || 0) + achievementTemplate.points;
    this.updateRank();
    console.log(`[AwardAchievement] Awarded achievement "${achievementTemplate.name}" (+${achievementTemplate.points} points) to ${this.username}.`);
    return true;
};
userSchema.methods.hasAchievement = function (achievementId) {
    return this.achievements.some(ach => ach.id === achievementId);
};

// --- *** MODIFICATION START *** ---
// findOrCreateDailyAttempt - Changed `pointsAwarded` default to 0
userSchema.methods.findOrCreateDailyAttempt = function(problemId) {
    if (!this.dailyProblemAttempts) {
        this.dailyProblemAttempts = [];
    }
    let attempt = this.dailyProblemAttempts.find(a => a.problemId.equals(problemId));

    if (!attempt) {
        // Create a new one
        const newAttempt = {
            problemId: problemId,
            runCount: 0,
            isLocked: false,
            passed: false,
            pointsAwarded: 0, // Default to 0 points
            lastAttemptedAt: new Date()
        };
        this.dailyProblemAttempts.push(newAttempt);
        // Get the Mongoose-managed sub-document
        attempt = this.dailyProblemAttempts[this.dailyProblemAttempts.length - 1];
    } else {
        // Update timestamp on existing attempt
        attempt.lastAttemptedAt = new Date();
    }
    return attempt;
};
// --- *** MODIFICATION END *** ---

module.exports = mongoose.model('User', userSchema);
