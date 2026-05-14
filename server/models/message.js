/**
 * Message Model - CRUD operations for messages table
 */

const { getDatabase } = require('../database/connection');

/**
 * Save a message to the database.
 *
 * @param {string} sessionId - Session UUID
 * @param {string} role - Message role ('player', 'cosseogi', 'system')
 * @param {string} content - Message content
 * @param {number|null} turnNumber - Turn number (null for system messages)
 * @param {number|null} phase - 이 메시지가 발생한 시점의 페이즈 (1~4). 이전 페이즈 단서 누수 차단용.
 * @returns {object} Created message record
 */
function createMessage(sessionId, role, content, turnNumber = null, phase = null) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO messages (session_id, role, content, turn_number, phase)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, role, content, turnNumber, phase);

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Get all messages for a session, ordered by creation time.
 *
 * @param {string} sessionId - Session UUID
 * @returns {object[]} Array of message records in chronological order
 */
function getMessagesBySessionId(sessionId) {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC'
  ).all(sessionId);
}

/**
 * 특정 페이즈의 메시지만 조회 (AI 대화 컨텍스트로 전달할 용도).
 * phase 컬럼이 NULL인 레거시 메시지는 제외 — 모델에 안전.
 *
 * @param {string} sessionId
 * @param {number} phase
 * @returns {object[]}
 */
function getMessagesBySessionAndPhase(sessionId, phase) {
  const db = getDatabase();
  return db.prepare(
    'SELECT * FROM messages WHERE session_id = ? AND phase = ? ORDER BY created_at ASC, id ASC'
  ).all(sessionId, phase);
}

/**
 * Get the count of messages in a session.
 * 
 * @param {string} sessionId - Session UUID
 * @returns {number} Message count
 */
function getMessageCount(sessionId) {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?').get(sessionId);
  return row.count;
}

/**
 * Delete all messages for a session (used when browser disconnects).
 * 
 * @param {string} sessionId - Session UUID
 * @returns {number} Number of deleted messages
 */
function deleteMessagesBySessionId(sessionId) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  return result.changes;
}

module.exports = {
  createMessage,
  getMessagesBySessionId,
  getMessagesBySessionAndPhase,
  getMessageCount,
  deleteMessagesBySessionId
};
