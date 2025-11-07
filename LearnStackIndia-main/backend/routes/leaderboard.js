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
    
    if (!leaderboard) {
      // Generate leaderboard if doesn't exist
      leaderboard = await generateLeaderboard(type);
    }
    
    // --- *** MODIFICATION START *** ---
    // Repopulate user data for the specific fields needed by the requested leaderboard type
    await leaderboard.populate({
        path: 'rankings.user',
        select: 'username profile.avatar stats.rank stats.dailyProblemPoints' // Ensure we get both rank and daily points
    });
    
    const rankings = leaderboard.rankings
      .slice(0, parseInt(limit))
      .map(rank => ({
        position: rank.position,
        username: rank.user.username,
        avatar: rank.user.profile.avatar,
        // Show main rank level, but score from the leaderboard
        rank: rank.user.stats.rank.level, 
        score: rank.score, // This score is from the correct field (dailyProblemPoints or rank.points)
        metrics: rank.metrics
      }));
    // --- *** MODIFICATION END *** ---
      
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

// Update user's leaderboard position
// ... (no changes to this route) ...
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
// ... (no changes to this route) ...
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
// --- *** THIS FUNCTION IS MODIFIED *** ---
async function generateLeaderboard(type) {
  
  // --- *** MODIFICATION START *** ---
  let scoreField = 'stats.rank.points';
  let scoreAccess = (user) => user.stats.rank.points;
  let queryFilter = {}; // No filter for 'all-time'

  if (type === 'daily-practice') {
      scoreField = 'stats.dailyProblemPoints';
      scoreAccess = (user) => user.stats.dailyProblemPoints || 0;
      queryFilter = { 'stats.dailyProblemPoints': { $gt: 0 } }; // Only users who have points
  }
  // --- *** MODIFICATION END *** ---

  const users = await User.find(queryFilter) // Use dynamic filter
    .select('username profile stats')
    .sort({ [scoreField]: -1 }) // Use dynamic sort field
    .limit(100);
  
  const rankings = users.map((user, index) => ({
    user: user._id,
    position: index + 1,
    score: scoreAccess(user), // Use dynamic score access
    metrics: {
      algorithmsCompleted: user.stats.algorithmsCompleted,
      averageAccuracy: user.stats.averageAccuracy,
      timeSpent: user.stats.timeSpent.total,
      streak: user.stats.streak.current
    }
  }));
  
  const leaderboard = new Leaderboard({
    type,
    period: getPeriod(type),
    rankings,
    lastUpdated: new Date()
  });
  
  await leaderboard.save();
  return leaderboard;
}

// Helper function to update user's position
// --- *** THIS FUNCTION IS MODIFIED *** ---
async function updateUserLeaderboardPosition(userId) {
  // This function now needs to update ALL relevant leaderboards
  const user = await User.findById(userId);
  if (!user) return;

  // --- Update 'all-time' leaderboard ---
  const allTimeLeaderboard = await Leaderboard.findOne({ type: 'all-time' });
  if (allTimeLeaderboard) {
    let userRanking = allTimeLeaderboard.rankings.find(r => r.user.toString() === userId);
    if (userRanking) {
        userRanking.score = user.stats.rank.points;
        // update metrics...
    } else {
        allTimeLeaderboard.rankings.push({
            user: userId,
            position: allTimeLeaderboard.rankings.length + 1,
            score: user.stats.rank.points,
            // ...metrics
        });
    }
    // Re-sort and update positions
    allTimeLeaderboard.rankings.sort((a, b) => b.score - a.score);
    allTimeLeaderboard.rankings.forEach((rank, index) => { rank.position = index + 1; });
    allTimeLeaderboard.lastUpdated = new Date();
    await allTimeLeaderboard.save();
  } else {
      await generateLeaderboard('all-time'); // Generate if it doesn't exist
  }

  // --- Update 'daily-practice' leaderboard ---
  const dailyLeaderboard = await Leaderboard.findOne({ type: 'daily-practice' });
  if (dailyLeaderboard) {
      let userRanking = dailyLeaderboard.rankings.find(r => r.user.toString() === userId);
      const dailyScore = user.stats.dailyProblemPoints || 0;
      
      if (userRanking) {
          userRanking.score = dailyScore;
          // update metrics...
      } else if (dailyScore > 0) { // Only add if they have points
          dailyLeaderboard.rankings.push({
              user: userId,
              position: dailyLeaderboard.rankings.length + 1,
              score: dailyScore,
              // ...metrics
          });
      }
      
      // Re-sort and update positions
      dailyLeaderboard.rankings.sort((a, b) => b.score - a.score);
      // Filter out users with 0 points who might still be in the list
      dailyLeaderboard.rankings = dailyLeaderboard.rankings.filter(r => r.score > 0);
      dailyLeaderboard.rankings.forEach((rank, index) => { rank.position = index + 1; });
      
      dailyLeaderboard.lastUpdated = new Date();
      await dailyLeaderboard.save();
  } else {
      await generateLeaderboard('daily-practice'); // Generate if it doesn't exist
  }
}

// Helper function to get period
// ... (no changes to this route) ...
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
    case 'daily-practice': // Add this case
      return { start: new Date(0), end: null };
  }
  
  return { start, end: now };
}

module.exports = router;
