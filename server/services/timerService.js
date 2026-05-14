/**
 * Timer Service - Server-side time management for Mission: Zero Noise
 * 
 * Handles elapsed time calculation, time limit enforcement,
 * and remaining time computation based on session start time.
 */

const config = require('../config');

const TIME_LIMIT = config.GAME_TIME_LIMIT; // 180 seconds

/**
 * Calculate elapsed seconds since session start.
 * 
 * @param {string} startedAt - ISO datetime string of session start (from DB)
 * @returns {number} Elapsed seconds (floored to integer)
 */
function getElapsedSeconds(startedAt) {
  if (!startedAt) return 0;

  const startTime = new Date(startedAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - startTime) / 1000);

  return Math.max(0, elapsed);
}

/**
 * Calculate remaining seconds for a session.
 * 
 * @param {string} startedAt - ISO datetime string of session start
 * @returns {number} Remaining seconds (0 if expired)
 */
function getRemainingSeconds(startedAt) {
  const elapsed = getElapsedSeconds(startedAt);
  const remaining = TIME_LIMIT - elapsed;
  return Math.max(0, remaining);
}

/**
 * Check if a session has exceeded the time limit.
 * 
 * @param {string} startedAt - ISO datetime string of session start
 * @returns {object} Time check result
 * @returns {boolean} result.isExpired - Whether time limit is exceeded
 * @returns {number} result.elapsedSeconds - Elapsed seconds (capped at TIME_LIMIT)
 * @returns {number} result.remainingSeconds - Remaining seconds (0 if expired)
 */
function checkTimeLimit(startedAt) {
  if (!startedAt) {
    return { isExpired: false, elapsedSeconds: 0, remainingSeconds: TIME_LIMIT };
  }

  const elapsed = getElapsedSeconds(startedAt);

  if (elapsed >= TIME_LIMIT) {
    return {
      isExpired: true,
      elapsedSeconds: TIME_LIMIT,
      remainingSeconds: 0
    };
  }

  return {
    isExpired: false,
    elapsedSeconds: elapsed,
    remainingSeconds: TIME_LIMIT - elapsed
  };
}

/**
 * Get the fixed elapsed time for timeout sessions.
 * When a session times out, elapsed time is always fixed at TIME_LIMIT.
 * 
 * @returns {number} Fixed timeout elapsed seconds (180)
 */
function getTimeoutElapsed() {
  return TIME_LIMIT;
}

module.exports = {
  TIME_LIMIT,
  getElapsedSeconds,
  getRemainingSeconds,
  checkTimeLimit,
  getTimeoutElapsed
};
