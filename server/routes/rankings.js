/**
 * Rankings API Routes
 * 
 * GET /api/rankings      - Get all rankings (sorted)
 * GET /api/rankings/top10 - Get top 10 leaderboard
 */

const express = require('express');
const router = express.Router();
const sessionModel = require('../models/session');

/**
 * GET /api/rankings
 * Get all rankings with sorting rules applied:
 * 1. 성공 sessions above all others
 * 2. Score DESC within same status group
 * 3. Elapsed seconds ASC for same score
 * 
 * Query params: ?limit=N (optional)
 */
router.get('/', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const rankings = sessionModel.getRankedSessions(limit);

    const formattedRankings = rankings.map((session, index) => ({
      rank: index + 1,
      playerName: session.player_name,
      turnCount: session.turn_count,
      elapsedSeconds: session.elapsed_seconds,
      status: session.status,
      score: session.score
    }));

    res.json({ rankings: formattedRankings });
  } catch (err) {
    console.error('[Rankings] Error getting rankings:', err.message);
    res.status(500).json({ error: '랭킹 조회 중 오류가 발생했습니다' });
  }
});

/**
 * GET /api/rankings/top10
 * Get top 10 leaderboard.
 */
router.get('/top10', (req, res) => {
  try {
    const rankings = sessionModel.getTop10Sessions();

    const formattedRankings = rankings.map((session, index) => ({
      rank: index + 1,
      playerName: session.player_name,
      turnCount: session.turn_count,
      elapsedSeconds: session.elapsed_seconds,
      status: session.status,
      score: session.score
    }));

    res.json({ rankings: formattedRankings });
  } catch (err) {
    console.error('[Rankings] Error getting top 10:', err.message);
    res.status(500).json({ error: '랭킹 조회 중 오류가 발생했습니다' });
  }
});

module.exports = router;
