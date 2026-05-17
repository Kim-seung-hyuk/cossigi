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

  // 🏷️ 시간초과 dedup: 같은 사용자(phone/student_id 매치)의 시간초과 세션 중
  //   최고점만 남기고 나머지는 삭제. 정책상 1인당 시간초과 랭킹은 1개만 존재.
  if (status === '시간초과') {
    const ended = db.prepare('SELECT player_id FROM sessions WHERE id = ?').get(id);
    if (ended) dedupTimeoutSessionsForPlayer(ended.player_id);
  }

  return getSessionById(id);
}

/**
 * 시간초과 세션 중복 정리 — 같은 phone 또는 student_id를 가진 시간초과 세션들 중
 * 최고점만 남기고 나머지(메시지 포함)를 모두 삭제.
 *
 * 호출 시점: endSession(status='시간초과') 직후. 신규 세션이 막 끝난 시점이라
 *           기존 시간초과 + 신규 시간초과 후보군을 동시 비교.
 *
 * @param {number} playerId - 방금 끝난 시간초과 세션의 player_id
 * @returns {number} 삭제된 세션 수 (0이면 dedup 불필요)
 */
function dedupTimeoutSessionsForPlayer(playerId) {
  const db = getDatabase();
  const player = db.prepare('SELECT phone, student_id FROM players WHERE id = ?').get(playerId);
  if (!player) return 0;

  // phone OR student_id 매치 조건 구성 (둘 중 하나라도 있어야 dedup 의미 있음)
  const conditions = [];
  const params = [];
  if (player.phone) {
    conditions.push('p.phone = ?');
    params.push(player.phone);
  }
  if (player.student_id) {
    conditions.push('p.student_id = ?');
    params.push(player.student_id);
  }
  if (conditions.length === 0) return 0;

  // 매치되는 시간초과 세션 전부 — 점수 DESC, 동점 시 최신 우선
  const sessions = db.prepare(`
    SELECT s.id, s.score, s.started_at
    FROM sessions s
    JOIN players p ON p.id = s.player_id
    WHERE s.status = '시간초과' AND (${conditions.join(' OR ')})
    ORDER BY s.score DESC, s.started_at DESC
  `).all(...params);

  if (sessions.length <= 1) return 0;

  const toDelete = sessions.slice(1).map(s => s.id); // 첫 번째(최고점) 제외 전부
  const placeholders = toDelete.map(() => '?').join(',');

  // 메시지 먼저(FK 제약), 세션 삭제
  db.prepare(`DELETE FROM messages WHERE session_id IN (${placeholders})`).run(...toDelete);
  const result = db.prepare(`DELETE FROM sessions WHERE id IN (${placeholders})`).run(...toDelete);

  return result.changes;
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
  dedupTimeoutSessionsForPlayer,
  deleteSession,
  getSessionsByPlayerId,
  getRankedSessions,
  getTop10Sessions,
  addBedrockUsage,
  getRecentBedrockSessions
};
