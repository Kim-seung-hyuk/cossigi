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
 * @returns {object} Created message record
 */
function createMessage(sessionId, role, content, turnNumber = null) {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO messages (session_id, role, content, turn_number)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, role, content, turnNumber);

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
  getMessageCount,
  deleteMessagesBySessionId
};
