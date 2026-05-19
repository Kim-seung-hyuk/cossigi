/**
 * Timer Service - Server-side time management for Mission: Zero Noise
 * 
 * Handles elapsed time calculation, time limit enforcement,
 * and remaining time computation based on session start time.
 */

const config = require('../config');

const TIME_LIMIT = config.GAME_TIME_LIMIT; // 180 seconds

/**
 * DB의 datetime 문자열을 UTC로 강제 파싱.
 *
 * SQLite의 `datetime('now')` 는 `"YYYY-MM-DD HH:MM:SS"` 형식이고 **타임존 표시가 없지만
 * 실제 값은 UTC**. node가 그 문자열을 `new Date(s)` 로 받으면 ISO가 아니므로 시스템
 * 로컬 타임존으로 해석함. 시스템 TZ가 UTC면 우연히 맞지만, KST면 9시간 오차가 생기고
 * elapsed 가 즉시 TIME_LIMIT 을 초과 → 게임 시작 즉시 시간초과 처리되는 버그가 됨.
 * 'T' 와 'Z' 를 채워 ISO UTC 로 강제한 뒤 파싱.
 */
function parseDbDate(s) {
  if (!s) return null;
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d) ? null : d;
}

/**
 * Calculate elapsed seconds since session start.
 *
 * @param {string} startedAt - SQLite/ISO datetime string of session start (UTC, from DB)
 * @returns {number} Elapsed seconds (floored to integer)
 */
function getElapsedSeconds(startedAt) {
  const d = parseDbDate(startedAt);
  if (!d) return 0;

  const elapsed = Math.floor((Date.now() - d.getTime()) / 1000);
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
