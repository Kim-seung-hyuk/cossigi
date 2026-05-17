/**
 * Session Model - CRUD operations for sessions table
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/connection');

/**
 * Create a new game session.
 * Generates a UUID, sets initial state: phase=1, noise=100, turn=0, status='in_progress'.
 * 
 * @param {number} playerId - The player's ID
 * @returns {object} Created session record
 */
function createSession(playerId) {
  const db = getDatabase();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO sessions (id, player_id, phase, noise_level, turn_count, status, keywords_collected)
    VALUES (?, ?, 1, 100, 0, 'in_progress', '[]')
  `).run(id, playerId);

  return getSessionById(id);
}

/**
 * Get a session by ID.
 * 
 * @param {string} id - Session UUID
 * @returns {object|undefined} Session record or undefined
 */
function getSessionById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

/**
 * Update session state (phase, noise level, turn count, keywords, phase turns).
 * 
 * @param {string} id - Session UUID
 * @param {object} updates - Fields to update
 * @param {number} [updates.phase] - New phase number
 * @param {number} [updates.noise_level] - New noise level
 * @param {number} [updates.turn_count] - New turn count
 * @param {string} [updates.status] - New status
 * @param {string} [updates.keywords_collected] - JSON string of collected keywords
 * @param {number} [updates.phase1_completed] - Phase 1 completion flag
 * @param {number} [updates.phase2_completed] - Phase 2 completion flag
 * @param {number} [updates.phase3_completed] - Phase 3 completion flag
 * @param {number} [updates.phase1_turns] - Turns used in phase 1
 * @param {number} [updates.phase2_turns] - Turns used in phase 2
 * @param {number} [updates.phase3_turns] - Turns used in phase 3
 * @returns {object|undefined} Updated session record
 */
function updateSession(id, updates) {
  const db = getDatabase();
  const allowedFields = [
    'phase', 'noise_level', 'turn_count', 'status', 'score',
    'ended_at', 'elapsed_seconds', 'keywords_collected',
    'phase1_completed', 'phase2_completed', 'phase3_completed',
    'phase1_turns', 'phase2_turns', 'phase3_turns'
  ];

  const setClauses = [];
  const values = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }

  if (setClauses.length === 0) return getSessionById(id);

  values.push(id);
  db.prepare(`UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  return getSessionById(id);
}

/**
 * End a session (set status, score, ended_at, elapsed_seconds).
 * 
 * @param {string} id - Session UUID
 * @param {string} status - Final status ('성공', '시간초과', '포기')
 * @param {number} score - Final score
 * @param {number} elapsedSeconds - Total elapsed time in seconds
 * @returns {object|undefined} Updated session record
 */
function endSession(id, status, score, elapsedSeconds) {
  const db = getDatabase();
  db.prepare(`
    UPDATE sessions 
    SET status = ?, score = ?, ended_at = datetime('now'), elapsed_seconds = ?
    WHERE id = ?
  `).run(status, score, elapsedSeconds, id);

  return getSessionById(id);
}

/**
 * Delete a session by ID (used when browser disconnects).
 * 
 * @param {string} id - Session UUID
 * @returns {boolean} True if session was deleted
 */
function deleteSession(id) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get all sessions for a player.
 * 
 * @param {number} playerId - Player ID
 * @returns {object[]} Array of session records
 */
function getSessionsByPlayerId(playerId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM sessions WHERE player_id = ? ORDER BY started_at DESC').all(playerId);
}

/**
 * Get all completed sessions sorted by ranking rules:
 * 1. 성공 sessions above all others
 * 2. Within same status group, sort by score DESC
 * 3. Same score: sort by elapsed_seconds ASC
 * 
 * @param {number} [limit] - Optional limit on results
 * @returns {object[]} Ranked session records with player name
 */
function getRankedSessions(limit) {
  const db = getDatabase();
  // 🏷️ 정렬: 성공(0) → 시간초과(1) → 포기(2) → 그 외.
  //   시상 등급(1~3등 / 4~30등)도 이 순서를 따른다 (leaderboard.js).
  let query = `
    SELECT s.*, p.name as player_name
    FROM sessions s
    JOIN players p ON s.player_id = p.id
    WHERE s.status != 'in_progress'
    ORDER BY
      CASE s.status
        WHEN '성공'     THEN 0
        WHEN '시간초과' THEN 1
        WHEN '포기'     THEN 2
        ELSE 3 END ASC,
      s.score DESC,
      s.elapsed_seconds ASC
  `;

  if (limit) {
    query += ` LIMIT ?`;
    return db.prepare(query).all(limit);
  }

  return db.prepare(query).all();
}

/**
 * Get top 10 ranked sessions.
 *
 * @returns {object[]} Top 10 ranked session records with player name
 */
function getTop10Sessions() {
  return getRankedSessions(10);
}

/**
 * Bedrock 호출 1회분의 토큰 사용량을 세션에 누적.
 * 1 row UPDATE — Bedrock 응답 직후 호출.
 */
function addBedrockUsage(id, inputTokens, outputTokens) {
  const db = getDatabase();
  db.prepare(`
    UPDATE sessions
       SET bedrock_input_tokens  = bedrock_input_tokens  + ?,
           bedrock_output_tokens = bedrock_output_tokens + ?,
           bedrock_call_count    = bedrock_call_count    + 1
     WHERE id = ?
  `).run(inputTokens || 0, outputTokens || 0, id);
}

/**
 * Bedrock 호출이 1회라도 발생한 최근 N개 세션을 시간 역순으로 조회.
 * 평균 비용 산출용.
 */
function getRecentBedrockSessions(limit) {
  const db = getDatabase();
  return db.prepare(`
    SELECT s.id, s.status, s.started_at, s.ended_at, s.turn_count,
           s.bedrock_input_tokens, s.bedrock_output_tokens, s.bedrock_call_count,
           p.name AS player_name
      FROM sessions s
      JOIN players p ON s.player_id = p.id
     WHERE s.bedrock_call_count > 0
     ORDER BY s.started_at DESC
     LIMIT ?
  `).all(limit);
}

module.exports = {
  createSession,
  getSessionById,
  updateSession,
  endSession,
  deleteSession,
  getSessionsByPlayerId,
  getRankedSessions,
  getTop10Sessions,
  addBedrockUsage,
  getRecentBedrockSessions
};
