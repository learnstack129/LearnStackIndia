// routes/auth.js - Enhanced Authentication Routes (Adjusted for Map/Array & Real-time Progress)
const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // Import mongoose
const User = require('../models/User'); //
const auth = require('../middleware/auth'); //
const Topic = require('../models/Topic'); // Import Topic model
const AchievementTemplate = require('../models/Achievement'); // Import Achievement model
const Leaderboard = require('../models/Leaderboard'); // Import Leaderboard model

const router = express.Router();

// --- Email configuration and OTP functions ---
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail', // or your provider
        auth: {
            user: process.env.EMAIL_USER, //
            pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
        }
    });
    console.log("📧 Email service configured.");
} else {
    console.warn("⚠️ Email service not configured. OTP emails will not be sent.");
    transporter = { // Dummy transporter
        sendMail: async (mailOptions) => {
            console.warn("Dummy email sendMail called. No email sent.");
            console.log("To:", mailOptions.to);
            console.log("Subject:", mailOptions.subject);
            if (process.env.NODE_ENV === 'development') {
                console.log("Simulating email success in development.");
                return { accepted: [mailOptions.to], rejected: [] }; // Simulate nodemailer response
            }
            throw new Error("Email service not configured."); // Fail in production
        }
    };
}

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTPEmail = async (email, otp, username) => {
    if (!transporter) return false;
    const mailOptions = {
        from: process.env.EMAIL_USER, //
        to: email,
        subject: 'DSA Visualizer - Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to DSA Visualizer!</h2>
            <p>Hi ${username || 'there'},</p>
            <p>Thank you for registering. Please verify your email using the OTP below:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #2563eb; font-size: 32px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 5 minutes.</p>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Best regards,<br>DSA Visualizer Team</p>
          </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ OTP email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('❌ Email sending error:', error);
        return false;
    }
};

const sendPasswordResetOTP = async (email, otp, username) => {
    if (!transporter) return false;
    const mailOptions = {
        from: process.env.EMAIL_USER, //
        to: email,
        subject: 'DSA Visualizer - Password Reset',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${username || 'there'},</p>
            <p>You requested a password reset. Use the OTP below:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #dc2626; font-size: 32px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 5 minutes.</p>
            <p>If you didn't request this, ignore this email.</p>
            <p>Best regards,<br>DSA Visualizer Team</p>
          </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Password reset OTP sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('❌ Password reset email sending error:', error);
        return false;
    }
};
// --- End Email/OTP ---

// --- Register Route ---
router.post('/register', async (req, res) => { //
    try {
        const { username, email, password } = req.body; //

        // Validation
        if (!username || !email || !password) return res.status(400).json({ message: 'Please provide username, email, and password' }); //
        if (username.length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters long' }); //
        if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters long' }); //
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/; //
        if (!emailRegex.test(email)) return res.status(400).json({ message: 'Please provide a valid email address' }); //

        const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.trim() }] }); //
        if (existingUser) { //
            return res.status(400).json({ //
                message: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken' //
            });
        }

        const otp = generateOTP(); //
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        const user = new User({ //
            username: username.trim(), //
            email: email.toLowerCase(), //
            password, //
            isEmailVerified: false, //
            emailVerificationToken: otp, //
            emailVerificationExpires: otpExpiry //
            // Mongoose pre-save hook will initialize progress map
        });
        await user.save(); // Triggers pre-save hook

        const emailSent = await sendOTPEmail(user.email, otp, user.username); //
        if (!emailSent && process.env.NODE_ENV !== 'development') { //
            console.warn(`Email sending failed for ${email}, rolling back user creation.`); //
            await User.findByIdAndDelete(user._id); // Rollback
            return res.status(500).json({ message: 'Failed to send verification email. Please try again.' }); //
        }

        res.status(201).json({ //
            success: true, //
            message: 'Registration successful! Please check your email for the verification code.', //
            requiresVerification: true, //
            email: user.email, //
            username: user.username //
        });

    } catch (error) {
        console.error('❌ Registration error:', error); //
        if (error.name === 'ValidationError') return res.status(400).json({ message: 'Validation failed: ' + Object.values(error.errors).map(err => err.message).join(', ') }); //
        if (error.code === 11000) { //
            const field = Object.keys(error.keyPattern)[0]; //
            return res.status(400).json({ message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` }); //
        }
        res.status(500).json({ message: 'Server error during registration', error: process.env.NODE_ENV === 'development' ? error.message : undefined }); //
    }
});

// --- OTP verification route ---
router.post('/verify-otp', async (req, res) => { //
    try {
        const { email, otp } = req.body; //
        if (!email || !otp) return res.status(400).json({ message: 'Please provide email and OTP' }); //

        const user = await User.findOne({ email: email.toLowerCase() }); //
        if (!user) return res.status(400).json({ message: 'User not found' }); //
        if (user.isEmailVerified) return res.status(400).json({ message: 'Email already verified' }); //
        if (!user.emailVerificationToken) return res.status(400).json({ message: 'No OTP found or already used. Please request a new one.' }); //
        if (!user.emailVerificationExpires || new Date() > user.emailVerificationExpires) { //
            // Clear expired token
            user.emailVerificationToken = null; //
            user.emailVerificationExpires = null; //
            await user.save(); //
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' }); //
        }
        if (user.emailVerificationToken !== otp.toString()) return res.status(400).json({ message: 'Invalid OTP.' }); //

        // Verify user
        user.isEmailVerified = true; //
        user.emailVerificationToken = null; //
        user.emailVerificationExpires = null; //
        await user.save(); //

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); //

        res.json({ //
            success: true, //
            message: 'Email verified successfully! You are now logged in.', //
            token, //
            user: { // Send minimal user data needed
                id: user._id, //
                username: user.username, //
                email: user.email, //
                role: user.role, //
                isEmailVerified: user.isEmailVerified //
            }
        });

    } catch (error) {
        console.error('❌ OTP verification error:', error); //
        res.status(500).json({ message: 'Server error during OTP verification' }); //
    }
});

// --- Resend OTP route ---
router.post('/resend-otp', async (req, res) => { //
    try {
        const { email } = req.body; //
        if (!email) return res.status(400).json({ message: 'Please provide email address' }); //

        const user = await User.findOne({ email: email.toLowerCase() }); //
        if (!user) return res.status(400).json({ message: 'User not found' }); //
        if (user.isEmailVerified) return res.status(400).json({ message: 'Email already verified' }); //

        const otp = generateOTP(); //
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        user.emailVerificationToken = otp; //
        user.emailVerificationExpires = otpExpiry; //
        await user.save(); //

        const emailSent = await sendOTPEmail(user.email, otp, user.username); //
        if (!emailSent && process.env.NODE_ENV !== 'development') { //
            return res.status(500).json({ message: 'Failed to send verification email. Please try again.' }); //
        }

        res.json({ success: true, message: 'New verification code sent to your email.' }); //

    } catch (error) {
        console.error('❌ Resend OTP error:', error); //
        res.status(500).json({ message: 'Server error during OTP resend' }); //
    }
});

// --- Login Route ---
router.post('/login', async (req, res) => { //
    try {
        const { email, password } = req.body; //
        if (!email || !password) return res.status(400).json({ message: 'Please provide email and password' }); //

        // Select password explicitly for comparison
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password'); //
        if (!user) return res.status(400).json({ message: 'Invalid email or password' }); //

        const isPasswordValid = await user.correctPassword(password); // correctPassword now only takes candidate
        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid email or password' }); //

        if (!user.isEmailVerified) { //
            return res.status(400).json({ //
                message: 'Please verify your email before logging in.', //
                requiresVerification: true, email: user.email //
            });
        }

        // Update daily activity & streak on login
        user.updateDailyActivity({}); // Pass empty object to just update date/streak
        await user.save({ validateBeforeSave: false }); // Save streak/daily update

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); //

        // Convert profile.socialLinks Map to Object for JSON response
        const socialLinksObject = Object.fromEntries(user.profile.socialLinks || new Map()); //

        res.json({ //
            success: true, //
            token, //
            user: { // Send necessary initial data
                id: user._id, //
                username: user.username, //
                email: user.email, //
                role: user.role, //
                profile: { // Send profile parts, converting subdoc and Map
                    ...(user.profile.toObject ? user.profile.toObject() : user.profile), //
                    socialLinks: socialLinksObject //
                },
                // Omit large fields like progress, achievements, dailyActivity
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error); //
        res.status(500).json({ message: 'Server error during login' }); //
    }
});

// --- Forgot password route ---
router.post('/forgot-password', async (req, res) => { //
    try {
        const { email } = req.body; //
        if (!email) return res.status(400).json({ message: 'Please provide your email address' }); //

        const user = await User.findOne({ email: email.toLowerCase() }); //
        // Security: Don't reveal if email exists or not immediately
        if (!user || !user.isEmailVerified) { //
            console.log(`Password reset requested for non-existent or unverified email: ${email}`); //
            return res.json({ success: true, message: 'If this email is registered and verified, you will receive a password reset code shortly.' }); //
        }

        const resetOTP = generateOTP(); //
        const resetOTPExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        user.passwordResetToken = resetOTP; //
        user.passwordResetExpires = resetOTPExpiry; //
        await user.save(); //

        const emailSent = await sendPasswordResetOTP(user.email, resetOTP, user.username); //
        if (!emailSent && process.env.NODE_ENV !== 'development') { //
            user.passwordResetToken = null; //
            user.passwordResetExpires = null; //
            await user.save(); //
            return res.status(500).json({ message: 'Failed to send password reset email. Please try again.' }); //
        }

        res.json({ success: true, message: 'Password reset code sent to your email. Please check your inbox.' }); //

    } catch (error) {
        console.error('❌ Forgot password error:', error); //
        res.status(500).json({ message: 'Server error during password reset request' }); //
    }
});

// --- Reset password route ---
router.post('/reset-password', async (req, res) => { //
    try {
        const { email, otp, newPassword } = req.body; //

        if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Please provide email, OTP, and new password' }); //
        if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters long' }); //

        const user = await User.findOne({ //
            email: email.toLowerCase(), //
            passwordResetToken: otp.toString(), //
            passwordResetExpires: { $gt: Date.now() } //
        });

        if (!user) { //
            // Check for expired token
            const expiredUser = await User.findOne({ email: email.toLowerCase(), passwordResetToken: otp.toString() }); //
            if (expiredUser) { //
                expiredUser.passwordResetToken = null; //
                expiredUser.passwordResetExpires = null; //
                await expiredUser.save(); //
                return res.status(400).json({ message: 'Password reset code has expired. Please request a new one.' }); //
            }
            return res.status(400).json({ message: 'Invalid reset code or email.' }); //
        }

        // Reset password - pre-save hook will hash it
        user.password = newPassword; //
        user.passwordResetToken = null; //
        user.passwordResetExpires = null; //
        user.passwordChangedAt = new Date(); //
        await user.save(); //

        res.json({ success: true, message: 'Password reset successfully! You can now login with your new password.' }); //

    } catch (error) {
        console.error('❌ Reset password error:', error); //
        if (error.name === 'ValidationError') { //
            return res.status(400).json({ message: 'Validation failed: ' + Object.values(error.errors).map(err => err.message).join(', ') }); //
        }
        res.status(500).json({ message: 'Server error during password reset' }); //
    }
});


// --- ADJUSTED Get dashboard data ---
router.get('/dashboard', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [user, topics, achievementTemplates, leaderboard] = await Promise.all([
            User.findById(userId).select('-password -emailVerificationToken -passwordResetToken -dailyActivity._id -dailyActivity.sessions._id'),
            Topic.find({ isActive: true }).select('id name description icon color order estimatedTime difficulty prerequisites algorithms isActive isGloballyLocked').sort({ order: 1 }).lean(), // Fetch topics
            AchievementTemplate.find({ isActive: true }).select('id name category').lean(),
            Leaderboard.findOne({ type: 'all-time' }).sort({ 'period.start': -1 }).limit(10).populate('rankings.user', 'username profile.avatar stats.rank.level').lean()
        ]);

        if (!user) {
            console.error(`[Dashboard Error] User not found for ID: ${userId}`);
            return res.status(404).json({ message: 'User not found' });
        }

        // --- Calculate User Position --- (Keep existing logic)
        let userPosition = null;
        const userRankEntry = await Leaderboard.findOne(
            { type: 'all-time', 'rankings.user': userId },
            { 'rankings.$': 1 }
        ).lean();
        if (userRankEntry?.rankings?.length > 0) {
            userPosition = userRankEntry.rankings[0].position;
        }

        // --- Calculate CURRENT total number of active algorithms --- (Keep existing logic)
        let currentTotalAlgorithms = 0;
        topics.forEach(topic => {
            currentTotalAlgorithms += topic.algorithms?.length || 0;
        });

        // --- Calculate USER'S completed algorithms --- (Keep existing logic)
        let userCompletedAlgorithms = 0;
        user.progress.forEach((topicProgress) => {
            if (topicProgress.algorithms && topicProgress.algorithms instanceof Map) {
                topicProgress.algorithms.forEach((algoProgress) => {
                    if (algoProgress.completed) {
                        userCompletedAlgorithms++;
                    }
                });
            }
        });

        // --- Calculate Real-time Overall Progress Percentage --- (Keep existing logic)
        const realTimeOverallProgress = currentTotalAlgorithms > 0
            ? Math.round((userCompletedAlgorithms / currentTotalAlgorithms) * 100)
            : 0;

        // --- Convert Progress Map to Object for Frontend, applying lock logic ---
        const topicsWithProgress = {};
        topics.forEach(topic => { // topic here is the definition from Topic model
            const userProgressForTopic = user.progress.get(topic.id); // User's progress data for this topic

            // --- Determine Topic Effective Status (Keep existing logic) ---
            let topicUserSpecificStatus = 'available';
            let prereqsMet = true; // Assume true if no prereqs
            if (topic.prerequisites && topic.prerequisites.length > 0) {
                const completedTopicsSet = new Set(user.learningPath?.completedTopics || []);
                prereqsMet = topic.prerequisites.every(prereqId => completedTopicsSet.has(prereqId));
            }
            if (userProgressForTopic?.status) {
                topicUserSpecificStatus = userProgressForTopic.status;
            } else {
                topicUserSpecificStatus = topic.isGloballyLocked ? 'locked' : 'available';
            }
            let topicEffectiveStatus;
            if (topic.isGloballyLocked) {
                topicEffectiveStatus = (topicUserSpecificStatus !== 'locked') ? topicUserSpecificStatus : 'locked';
            } else {
                topicEffectiveStatus = topicUserSpecificStatus; // Already includes prereq check
            }
            // --- End Topic Status ---


            // --- Process Algorithms: Calculate effective status for EACH algorithm ---
            const algorithmsProgressObject = {};
            const algorithmDefinitions = topic.algorithms || []; // Array of algo definitions for this topic

            algorithmDefinitions.forEach(algoDef => {
                const userAlgoProgress = userProgressForTopic?.algorithms?.get(algoDef.id);
                const algoUserSpecificStatus = userAlgoProgress?.status || 'available'; // Default if no user record
                const algoIsGloballyLocked = algoDef.isGloballyLocked === true;
                let algoEffectiveStatus = 'available'; // Default

                if (algoIsGloballyLocked) {
                    // Global lock takes precedence unless overridden by user status 'available'
                    algoEffectiveStatus = (algoUserSpecificStatus === 'available') ? 'available' : 'locked';
                } else {
                    // If not globally locked, user status dictates (can be 'available' or 'locked')
                    algoEffectiveStatus = algoUserSpecificStatus;
                }

                // *** CRITICAL ADDITION: Also consider the TOPIC's effective status ***
                // An algorithm cannot be available if its parent topic is locked.
                if (topicEffectiveStatus === 'locked') {
                    algoEffectiveStatus = 'locked';
                }

                // Store the calculated effective status along with other progress data
                algorithmsProgressObject[algoDef.id] = {
                    ...(userAlgoProgress?.toObject ? userAlgoProgress.toObject() : userAlgoProgress), // User progress data
                    effectiveStatus: algoEffectiveStatus // Add the calculated status
                };
            });
            // --- End Process Algorithms ---

            topicsWithProgress[topic.id] = {
                // Topic config data
                id: topic.id, name: topic.name, description: topic.description, icon: topic.icon,
                color: topic.color, order: topic.order, estimatedTime: topic.estimatedTime,
                difficulty: topic.difficulty,
                algorithms: algorithmDefinitions, // Include algo definitions (includes isGloballyLocked)
                // User progress data:
                status: topicEffectiveStatus, // Topic's effective status
                completion: userProgressForTopic?.completion ?? 0,
                userAlgoProgress: algorithmsProgressObject // User progress WITH effectiveStatus added
            };
        });
        // --- End Convert Progress Map ---

        // --- Prepare Achievements (Keep existing logic) ---
        const totalUserAchievements = user.totalAchievements;
        const recentAchievements = [...user.achievements]
            .sort((a, b) => b.earnedAt - a.earnedAt)
            .slice(0, 6)
            .map(ach => ach.toObject ? ach.toObject() : ach);

        // --- Access stats safely (Keep existing logic) ---
        const userStats = user.stats || {};
        const userRank = userStats.rank || {};
        const userTimeSpent = userStats.timeSpent || {};
        const userStreak = userStats.streak || {};

        // --- Assemble Dashboard Data (Keep existing structure) ---
        const dashboardData = {
            user: { username: user.username, profile: user.profile?.toObject(), rank: userRank.level ?? 'Bronze', totalUserAchievements },
            stats: {
                overallProgress: realTimeOverallProgress, algorithmsCompleted: userCompletedAlgorithms,
                totalAlgorithms: currentTotalAlgorithms, timeToday: userTimeSpent.today ?? 0,
                timeThisWeek: userTimeSpent.thisWeek ?? 0, timeTotal: userTimeSpent.total ?? 0,
                currentStreak: userStreak.current ?? 0, longestStreak: userStreak.longest ?? 0,
                rank: { level: userRank.level ?? 'Bronze', points: userRank.points ?? 0, position: userPosition || 'Unranked' },
                averageAccuracy: userStats.averageAccuracy ?? 0
            },
            topics: topicsWithProgress, // Includes algo effective status now
            achievements: { recent: recentAchievements, total: totalUserAchievements, available: achievementTemplates.length },
            learningPath: user.learningPath?.toObject(),
            leaderboard: leaderboard ? {
                topUsers: leaderboard.rankings.slice(0, 10).map(rank => ({
                    position: rank.position, username: rank.user?.username ?? '?', avatar: rank.user?.profile?.avatar, rank: rank.user?.stats?.rank?.level ?? '?', score: rank.score
                })),
                userPosition: userPosition || 'Unranked'
            } : { topUsers: [], userPosition: 'Unranked' }
        };

        console.log(`[Dashboard Send] Sending dashboard data for user ${user.username}.`);
        res.json(dashboardData);
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({
            message: 'Server error fetching dashboard data',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});


// --- ADJUSTED Route: Check Algorithm Access ---
router.get('/check-access/:topicId/:algorithmId', auth, async (req, res) => { //
    try {
        const userId = req.user.id; //
        const { topicId, algorithmId } = req.params; //

        // Fetch user and topic definition
        const [user, topicDefinition] = await Promise.all([ //
            User.findById(userId).select('progress learningPath'), // Get full doc to use Map methods
            Topic.findOne({ id: topicId }).select('id isGloballyLocked prerequisites algorithms.id algorithms.isGloballyLocked').lean()
        ]);

        if (!user) return res.status(404).json({ message: 'User not found' }); //
        if (!topicDefinition) return res.status(404).json({ message: 'Topic definition not found' }); //

        // --- Determine Effective Status using Map ---
        const userProgressForTopic = user.progress.get(topicId);
        let topicUserSpecificStatus = 'available';
        // Simplified status check (assuming prerequisites removed as per previous request)
        if (userProgressForTopic?.status) {
            topicUserSpecificStatus = userProgressForTopic.status;
        } else {
            topicUserSpecificStatus = topicDefinition.isGloballyLocked ? 'locked' : 'available';
        }
        let topicEffectiveStatus;
        if (topicDefinition.isGloballyLocked) {
            topicEffectiveStatus = (topicUserSpecificStatus !== 'locked') ? topicUserSpecificStatus : 'locked';
        } else {
            topicEffectiveStatus = topicUserSpecificStatus;
        }
        // --- End Determine Effective Status ---

        // --- NEW: Determine Algorithm Effective Status ---
        let algorithmEffectiveStatus = 'available'; // Default
        let algoIsGloballyLocked = false;

        // Find the specific algorithm definition
        const algorithmDef = topicDefinition.algorithms?.find(a => a.id === algorithmId);
        if (!algorithmDef) {
             console.error(`[Access Check] Algorithm definition ${algorithmId} not found in topic ${topicId}.`);
             return res.status(404).json({ message: 'Algorithm definition not found' });
        }
        algoIsGloballyLocked = algorithmDef.isGloballyLocked === true;
        // Get user-specific progress/status for this algorithm
        const userAlgoProgress = userProgressForTopic?.algorithms?.get(algorithmId);
        const algoUserSpecificStatus = userAlgoProgress?.status || 'available'; // Default if no user record

        if (algoIsGloballyLocked) {
             // If globally locked, only a user status of 'available' can override it
             algorithmEffectiveStatus = (algoUserSpecificStatus === 'available') ? 'available' : 'locked';
        } else {
             // If not globally locked, the user's specific status takes precedence
             algorithmEffectiveStatus = algoUserSpecificStatus; // Can be 'available' or 'locked'
        }
        // --- End Algorithm Status ---

        // --- Determine Final Access ---
        // Access requires BOTH topic AND algorithm to be effectively available/completed
        const hasAccess = (topicEffectiveStatus !== 'locked') && (algorithmEffectiveStatus !== 'locked');
        // Determine the most restrictive status to report back
        let finalReportedStatus = 'available';
        if (topicEffectiveStatus === 'locked') finalReportedStatus = 'locked (topic)';
        else if (algorithmEffectiveStatus === 'locked') finalReportedStatus = 'locked (algorithm)';
        // --- End Final Access ---

        console.log(`[Access Check] User: ${userId}, Topic: ${topicId}, Algo: ${algorithmId}`);
        console.log(`  Topic Status -> GlobalLock: ${topicDefinition.isGloballyLocked}, UserSpecific: ${topicUserSpecificStatus}, Effective: ${topicEffectiveStatus}`);
        console.log(`  Algo Status -> GlobalLock: ${algoIsGloballyLocked}, UserSpecific: ${algoUserSpecificStatus}, Effective: ${algorithmEffectiveStatus}`);
        console.log(`  Final Access -> Granted: ${hasAccess}, Reported Status: ${finalReportedStatus}`);

        res.json({ //
            success: true, //
            hasAccess: hasAccess, //
            status: finalReportedStatus //
        });

    } catch (error) {
        console.error(`❌ Error checking access for topic ${req.params.topicId}, algo ${req.params.algorithmId}:`, error); //
        res.status(500).json({ message: 'Server error checking access' }); //
    }
});


// --- ADJUSTED Update progress route ---
router.post('/progress', auth, async (req, res) => { //
    try {
        const { category, algorithm, data } = req.body; // category = topicId, algorithm = algorithmId
        const user = await User.findById(req.user.id); //

        if (!user) return res.status(404).json({ message: 'User not found.' }); //

        // Use Map methods to access progress
        let topicProgress = user.progress.get(category); //

        if (!topicProgress) { //
            console.error(`Progress structure not found for user ${user.id}, topic ${category}. Initializing.`); //
            // Attempt to initialize based on schema defaults (should ideally exist from pre-save)
            topicProgress = { status: 'available', completion: 0, totalTime: 0, algorithms: new Map() }; // Initialize Map
            user.progress.set(category, topicProgress); //
        }
        // Ensure algorithms map exists
        if (!topicProgress.algorithms) { //
            topicProgress.algorithms = new Map(); //
        }

        let algorithmProgress = topicProgress.algorithms.get(algorithm); //

        // Ensure algorithm progress exists or initialize it
        if (!algorithmProgress) { //
            // Verify algorithm exists in Topic model before initializing
            const topicDef = await Topic.findOne({ id: category }).select('algorithms._id algorithms.id').lean(); //
            const algoExistsInDef = topicDef?.algorithms?.some(a => a.id === algorithm); //
            if (!algoExistsInDef) { //
                return res.status(404).json({ message: `Algorithm '${algorithm}' not defined for topic '${category}'.` }); //
            }
            algorithmProgress = {}; // Initialize empty; defaults apply on save
            topicProgress.algorithms.set(algorithm, algorithmProgress); //
            console.log(`Initialized progress map entry for ${category}.${algorithm}`); //
        }

        // --- Update Specific Fields ---
        let pointsEarnedThisUpdate = 0; //
        let timeIncrementSeconds = 0; //
        let attemptedPractice = false; //
        let completedPractice = false; // Flag if practice completed algo *in this update*

        // Visualization Time Update
        if (data.timeSpentViz !== undefined && typeof data.timeSpentViz === 'number' && data.timeSpentViz >= 0) { //
            algorithmProgress.timeSpentViz = (algorithmProgress.timeSpentViz || 0) + data.timeSpentViz; //
            algorithmProgress.lastAttemptViz = data.lastAttemptViz ? new Date(data.lastAttemptViz) : new Date(); //
            timeIncrementSeconds += data.timeSpentViz; //
        }

        // Practice Data Update
        if (data.timeSpentPractice !== undefined && typeof data.timeSpentPractice === 'number') { //
            attemptedPractice = true; //
            if (data.completed === true && algorithmProgress.completed !== true) { //
                algorithmProgress.completed = true; //
                completedPractice = true; // Mark completion occurred now
            }

            algorithmProgress.accuracyPractice = data.accuracyPractice ?? algorithmProgress.accuracyPractice ?? 0; //
            algorithmProgress.timeSpentPractice = (algorithmProgress.timeSpentPractice || 0) + data.timeSpentPractice; //
            algorithmProgress.attemptsPractice = (algorithmProgress.attemptsPractice || 0) + (data.attemptsPractice || 1); //
            const practicePoints = data.pointsPractice || 0; //
            algorithmProgress.pointsPractice = (algorithmProgress.pointsPractice || 0) + practicePoints; //
            algorithmProgress.lastAttemptPractice = data.lastAttemptPractice ? new Date(data.lastAttemptPractice) : new Date(); //

            if (data.timeSpentPractice > 0 && (algorithmProgress.bestTimePractice === null || algorithmProgress.bestTimePractice === undefined || data.timeSpentPractice < algorithmProgress.bestTimePractice)) { //
                algorithmProgress.bestTimePractice = data.timeSpentPractice; //
            }

            pointsEarnedThisUpdate += practicePoints; //
            timeIncrementSeconds += data.timeSpentPractice; //
        }

        // --- Mark Modified (Crucial for Maps) ---
        // Set the potentially modified algorithmProgress back into the map
        topicProgress.algorithms.set(algorithm, algorithmProgress); //
        // Set the potentially modified topicProgress back into the main map
        user.progress.set(category, topicProgress); //
        // Mark the top-level progress field as modified
        user.markModified('progress'); //
        // --- End Mark Modified ---

        // Update global time spent stats (convert seconds to minutes)
        const timeIncrementMinutes = timeIncrementSeconds > 0 ? Math.max(1, Math.round(timeIncrementSeconds / 60)) : 0; //
        if (timeIncrementMinutes > 0) { //
            const sessionData = attemptedPractice ? { //
                endTime: new Date(), topic: category, algorithm: algorithm, //
                accuracy: data.accuracyPractice, timeSpent: data.timeSpentPractice, points: data.pointsPractice //
            } : undefined; //
            user.updateDailyActivity({ // This method handles marking modified internally
                timeSpent: timeIncrementMinutes, //
                algorithmsAttempted: attemptedPractice ? 1 : 0, //
                algorithmsCompleted: completedPractice ? 1 : 0, //
                pointsEarned: pointsEarnedThisUpdate, //
                topic: category, //
                session: sessionData //
            });
        } else if (data.lastAttemptViz || data.lastAttemptPractice) { //
            // If only lastAttempt was updated, still update streak
            user.updateDailyActivity({}); // Call with empty object
        }

        // Update user rank points
        if (pointsEarnedThisUpdate > 0) { //
            user.stats.rank.points = (user.stats.rank.points || 0) + pointsEarnedThisUpdate; //
            user.markModified('stats.rank'); // Mark rank points change
            // Rank level is updated in pre-save hook based on points
        }

        // --- Trigger unlock check if a topic was potentially completed ---
        // (Pre-save hook handles the actual completion logic and status update)
        // *Correction*: Check completion percentage directly from the topicProgress object AFTER potential updates within this scope
        let currentTopicCompletion = 0;
        let topicAlgoCount = 0;
        let topicCompletedCount = 0;
        if (topicProgress.algorithms && topicProgress.algorithms.size > 0) {
            topicAlgoCount = topicProgress.algorithms.size;
            topicProgress.algorithms.forEach(algoProg => {
                if (algoProg.completed) {
                    topicCompletedCount++;
                }
            });
            currentTopicCompletion = topicAlgoCount > 0 ? Math.round((topicCompletedCount / topicAlgoCount) * 100) : 0;
            // Update the completion directly on the object before save (pre-save will confirm)
            topicProgress.completion = currentTopicCompletion;
        }

        if (completedPractice && currentTopicCompletion === 100) { // Check the recalculated completion
            console.log(`[Progress Update] Triggering unlock check after completing algo ${algorithm} in topic ${category}.`); //
            // unlockNextTopic might need to be async if it fetches data
            await user.unlockNextTopic(); // Call unlock logic
        }

        // --- Save User (Pre-save hook recalculates derived stats) ---
        await user.save(); //
        console.log(`User ${user.id} progress saved for ${category}.${algorithm}.`); //

        // --- Prepare Response Data ---
        // Convert updated progress back to objects
        const updatedAlgorithmProgressResponse = user.progress.get(category)?.algorithms.get(algorithm)?.toObject() || {}; //
        const updatedTopicProgressResponse = user.progress.get(category)?.toObject() || {}; // Get the updated topic data after save

        res.json({ //
            success: true, //
            message: 'Progress updated successfully', //
            updatedAlgorithmProgress: updatedAlgorithmProgressResponse, //
            updatedStats: user.stats.toObject(), // Send updated stats after save
            updatedTopicStatus: updatedTopicProgressResponse.status, // Send updated topic status
            updatedTopicCompletion: updatedTopicProgressResponse.completion, // Send updated topic completion
            updatedLearningPath: user.learningPath.toObject() // Send potentially updated learning path
        });

    } catch (error) {
        console.error('❌ Progress update error:', error); //
        res.status(500).json({ message: 'Server error updating progress', error: error.message }); //
    }
});


// --- ADJUSTED Get user profile (/me route) ---
router.get('/me', auth, async (req, res) => { //
    try {
        const user = await User.findById(req.user.id) //
            .select('-password -emailVerificationToken -passwordResetToken -dailyActivity._id -dailyActivity.sessions._id') //
            .lean(); // Use lean

        if (!user) { //
            return res.status(404).json({ message: 'User not found' }); //
        }

        // Convert Maps to Objects for JSON response
        const progressObject = {}; //
        if (user.progress && typeof user.progress === 'object') { // Check if it's an object (from lean)
            for (const [topicId, topicData] of Object.entries(user.progress)) { //
                const algorithmsObject = {}; //
                if (topicData.algorithms && typeof topicData.algorithms === 'object') { //
                    for (const [algoId, algoData] of Object.entries(topicData.algorithms)) { //
                        algorithmsObject[algoId] = algoData; //
                    }
                }
                progressObject[topicId] = { ...topicData, algorithms: algorithmsObject }; //
            }
        }

        const socialLinksObject = {}; //
        if (user.profile?.socialLinks && typeof user.profile.socialLinks === 'object') { //
            for (const [key, value] of Object.entries(user.profile.socialLinks)) { //
                socialLinksObject[key] = value; //
            }
        }

        // Prepare achievements (already an array)
        const achievementsArray = user.achievements || []; //

        // Prepare daily activity
        const dailyActivityClean = (user.dailyActivity || []).slice(-30); //

        // Manually calculate virtuals if needed with lean()
        const totalAchievements = achievementsArray.length; //

        // --- START: Manual Real-time Overall Progress Calculation for /me ---
        // Fetch current topics to get the real total algorithm count
        const currentTopics = await Topic.find({ isActive: true }).select('algorithms.id').lean(); //
        let currentTotalAlgorithms = 0;
        currentTopics.forEach(topic => {
            currentTotalAlgorithms += topic.algorithms?.length || 0;
        });

        // Count completed algorithms from the user's progressObject (derived from lean)
        let userCompletedAlgorithms = 0;
        Object.values(progressObject).forEach(topicProgress => {
            if (topicProgress.algorithms && typeof topicProgress.algorithms === 'object') {
                Object.values(topicProgress.algorithms).forEach(algoProgress => {
                    if (algoProgress.completed) {
                        userCompletedAlgorithms++;
                    }
                });
            }
        });

        const realTimeOverallProgress = currentTotalAlgorithms > 0
            ? Math.round((userCompletedAlgorithms / currentTotalAlgorithms) * 100)
            : 0;
        // --- END: Manual Real-time Overall Progress Calculation ---


        res.json({ //
            id: user._id, //
            username: user.username, //
            email: user.email, //
            role: user.role, //
            profile: { ...user.profile, socialLinks: socialLinksObject }, //
            stats: { // Overwrite overallProgress and algorithmsCompleted with real-time values
                ...(user.stats || {}),
                overallProgress: realTimeOverallProgress, // Use the real-time calculation
                algorithmsCompleted: userCompletedAlgorithms // Use the real-time count
            },
            progress: progressObject, //
            achievements: achievementsArray, //
            learningPath: user.learningPath, //
            preferences: user.preferences, //
            dailyActivity: dailyActivityClean, //
            // Add manually calculated virtuals
            totalAchievements: totalAchievements, //
            // completionPercentage is now replaced by stats.overallProgress above
            createdAt: user.createdAt //
        });
    } catch (error) {
        console.error('❌ Profile fetch error:', error); //
        res.status(500).json({ message: 'Server error fetching profile' }); //
    }
});


module.exports = router;