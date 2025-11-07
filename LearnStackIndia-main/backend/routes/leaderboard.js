// routes/leaderboard.js - Leaderboard routes
const express = require('express');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const { type = 'all-time', limit = 10 } = req.query;
    
    let leaderboard = await Leaderboard.findOne({ type })
      .populate('rankings.user', 'username profile.avatar stats.rank')
      .sort({ 'period.start': -1 });
    
    // --- MODIFICATION: Regenerate if old ---
    const isOld = !leaderboard || (Date.now() - new Date(leaderboard.lastUpdated).getTime()) > 15 * 60 * 1000; // 15 minutes
    if (isOld) {
      console.log(`[Leaderboard] 'all-time' leaderboard is old or missing. Regenerating...`);
      leaderboard = await generateLeaderboard(type);
      // Re-populate after generation
      await leaderboard.populate('rankings.user', 'username profile.avatar stats.rank');
    }
    // --- END MODIFICATION ---
    
    const rankings = leaderboard.rankings
      .slice(0, parseInt(limit))
      .map(rank => ({
        position: rank.position,
        username: rank.user.username,
        avatar: rank.user.profile.avatar,
        rank: rank.user.stats.rank.level,
        score: rank.score,
        metrics: rank.metrics
      }));
    
    res.json({
      success: true,
      type,
      rankings,
      lastUpdated: leaderboard.lastUpdated
    });
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

router.get('/daily-practice', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const type = 'daily-practice';

        let leaderboard = await Leaderboard.findOne({ type })
            .populate('rankings.user', 'username profile.avatar stats.rank')
            .sort({ 'period.start': -1 }); // 'period' is not really used, but good to keep

        // Regenerate if it's older than 15 minutes or doesn't exist
        const isOld = !leaderboard || (Date.now() - new Date(leaderboard.lastUpdated).getTime()) > 15 * 60 * 1000; // 15 minutes

        if (isOld) {
            console.log(`[Leaderboard] 'daily-practice' leaderboard is old or missing. Regenerating...`);
            leaderboard = await generateDailyLeaderboard();
            // Re-populate after generation
            await leaderboard.populate('rankings.user', 'username profile.avatar stats.rank');
        }

        const rankings = leaderboard.rankings
            .slice(0, limit)
            .map(rank => ({
                position: rank.position,
                username: rank.user ? rank.user.username : '[Deleted User]',
                avatar: rank.user ? rank.user.profile.avatar : null,
                rank: rank.user ? rank.user.stats.rank.level : 'N/A',
                score: rank.score, // This is the dailyProblemScore
                metrics: rank.metrics // This will contain totalDailyProblemsAttempted/Passed
            }));

        res.json({
            success: true,
            type,
            rankings,
            lastUpdated: leaderboard.lastUpdated
        });

    } catch (error) {
        console.error('❌ Error fetching daily-practice leaderboard:', error);
        res.status(500).json({ message: 'Error fetching daily-practice leaderboard' });
    }
});

// Update user's leaderboard position
router.post('/update', auth, async (req, res) => {
  try {
    await updateUserLeaderboardPosition(req.user.id);
    
    res.json({
      success: true,
      message: 'Leaderboard updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating leaderboard:', error);
    res.status(500).json({ message: 'Error updating leaderboard' });
  }
});

// Get user's rank
router.get('/my-rank', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Find user's position in all-time leaderboard
    const leaderboard = await Leaderboard.findOne({ type: 'all-time' });
    
    let position = null;
    if (leaderboard) {
      const userRank = leaderboard.rankings.find(
        r => r.user.toString() === req.user.id
      );
      position = userRank ? userRank.position : null;
    }
    
    res.json({
      success: true,
      rank: {
        level: user.stats.rank.level,
        points: user.stats.rank.points,
        position: position || 'Unranked'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user rank:', error);
    res.status(500).json({ message: 'Error fetching user rank' });
  }
});

// Helper function to generate leaderboard
async function generateLeaderboard(type) {
  // ... (existing function) ...
  const users = await User.find({})
    .select('username profile stats')
    .sort({ 'stats.rank.points': -1 })
    .limit(100);
  
  const rankings = users.map((user, index) => ({
    user: user._id,
    position: index + 1,
    score: user.stats.rank.points,
    metrics: {
      algorithmsCompleted: user.stats.algorithmsCompleted,
      averageAccuracy: user.stats.averageAccuracy,
      timeSpent: user.stats.timeSpent.total,
      streak: user.stats.streak.current
    }
  }));
  
  const period = getPeriod(type);
  const lastUpdated = new Date();

  // Use updateOne with upsert to create or replace
  await Leaderboard.updateOne(
      { type: type },
      { $set: { period, rankings, lastUpdated } },
      { upsert: true }
  );
  
  return Leaderboard.findOne({ type: type });
}

async function generateDailyLeaderboard() {
    const type = 'daily-practice';

    // Find users who have at least one daily problem attempt
    // and sort them by the new 'dailyProblemScore'
    const users = await User.find({
        'stats.dailyProblemScore': { $gt: 0 } // Only users with a score > 0
    })
    .select('username profile stats dailyProblemAttempts') // Need dailyProblemAttempts for metrics
    .sort({ 'stats.dailyProblemScore': -1 }) // Sort by the new score
    .limit(100); // Limit to top 100

    const rankings = users.map((user, index) => {
        let problemsAttempted = 0;
        let problemsPassed = 0;

        if (user.dailyProblemAttempts) {
            problemsAttempted = user.dailyProblemAttempts.length;
            problemsPassed = user.dailyProblemAttempts.filter(a => a.passed).length;
        }

        return {
            user: user._id,
            position: index + 1,
            score: user.stats.dailyProblemScore, // The new total score
            metrics: {
                totalDailyProblemsAttempted: problemsAttempted,
                totalDailyProblemsPassed: problemsPassed,
                // Add other metrics if you want
            }
        };
    });

    const period = { start: new Date(0), end: null }; // All-time for this leaderboard
    const lastUpdated = new Date();

    // Use updateOne with upsert to create or replace
    await Leaderboard.updateOne(
        { type: type },
        { $set: { period, rankings, lastUpdated } },
        { upsert: true }
    );
    
    // Return the newly created/updated leaderboard document
    return Leaderboard.findOne({ type: type });
}

// Helper function to update user's position
async function updateUserLeaderboardPosition(userId) {
  const leaderboard = await Leaderboard.findOne({ type: 'all-time' });
  
  if (!leaderboard) {
    await generateLeaderboard('all-time');
    return;
  }
  
  const user = await User.findById(userId);
  
  // Find or create user's ranking
  let userRanking = leaderboard.rankings.find(
    r => r.user.toString() === userId
  );
  
  if (userRanking) {
    userRanking.score = user.stats.rank.points;
    userRanking.metrics = {
      algorithmsCompleted: user.stats.algorithmsCompleted,
      averageAccuracy: user.stats.averageAccuracy,
      timeSpent: user.stats.timeSpent.total,
      streak: user.stats.streak.current
    };
  } else {
    leaderboard.rankings.push({
      user: userId,
      position: leaderboard.rankings.length + 1,
      score: user.stats.rank.points,
      metrics: {
        algorithmsCompleted: user.stats.algorithmsCompleted,
        averageAccuracy: user.stats.averageAccuracy,
        timeSpent: user.stats.timeSpent.total,
        streak: user.stats.streak.current
      }
    });
  }
  
  // Re-sort and update positions
  leaderboard.rankings.sort((a, b) => b.score - a.score);
  leaderboard.rankings.forEach((rank, index) => {
    rank.position = index + 1;
  });
  
  leaderboard.lastUpdated = new Date();
  await leaderboard.save();
}

// Helper function to get period
function getPeriod(type) {
  const now = new Date();
  const start = new Date(now);
  
  switch (type) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all-time':
      return { start: new Date(0), end: null };
  }
  
  return { start, end: now };
}


module.exports = router;
