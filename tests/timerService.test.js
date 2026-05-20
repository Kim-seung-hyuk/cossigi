/**
 * Unit tests for Timer Service
 */

const {
  TIME_LIMIT,
  getElapsedSeconds,
  getRemainingSeconds,
  checkTimeLimit,
  getTimeoutElapsed
} = require('../server/services/timerService');

describe('Timer Service', () => {
  describe('TIME_LIMIT', () => {
    it('should be 120 seconds', () => {
      expect(TIME_LIMIT).toBe(120);
    });
  });

  describe('getElapsedSeconds', () => {
    it('should return 0 for null/undefined startedAt', () => {
      expect(getElapsedSeconds(null)).toBe(0);
      expect(getElapsedSeconds(undefined)).toBe(0);
    });

    it('should calculate elapsed seconds from start time', () => {
      // Start 30 seconds ago
      const startedAt = new Date(Date.now() - 30000).toISOString();
      const elapsed = getElapsedSeconds(startedAt);
      // Allow 1 second tolerance for test execution time
      expect(elapsed).toBeGreaterThanOrEqual(29);
      expect(elapsed).toBeLessThanOrEqual(31);
    });

    it('should return 0 for future start time', () => {
      const startedAt = new Date(Date.now() + 10000).toISOString();
      expect(getElapsedSeconds(startedAt)).toBe(0);
    });
  });

  describe('getRemainingSeconds', () => {
    it('should return remaining time correctly', () => {
      // Start 60 seconds ago
      const startedAt = new Date(Date.now() - 60000).toISOString();
      const remaining = getRemainingSeconds(startedAt);
      // Should be around 120 seconds remaining
      expect(remaining).toBeGreaterThanOrEqual(119);
      expect(remaining).toBeLessThanOrEqual(121);
    });

    it('should return 0 when time is expired', () => {
      // Start 200 seconds ago
      const startedAt = new Date(Date.now() - 200000).toISOString();
      expect(getRemainingSeconds(startedAt)).toBe(0);
    });

    it('should return full time for just-started session', () => {
      const startedAt = new Date().toISOString();
      const remaining = getRemainingSeconds(startedAt);
      expect(remaining).toBeGreaterThanOrEqual(119);
      expect(remaining).toBeLessThanOrEqual(120);
    });
  });

  describe('checkTimeLimit', () => {
    it('should return not expired for active session', () => {
      const startedAt = new Date(Date.now() - 60000).toISOString();
      const result = checkTimeLimit(startedAt);
      expect(result.isExpired).toBe(false);
      expect(result.elapsedSeconds).toBeGreaterThanOrEqual(59);
      expect(result.elapsedSeconds).toBeLessThanOrEqual(61);
      expect(result.remainingSeconds).toBeGreaterThanOrEqual(119);
      expect(result.remainingSeconds).toBeLessThanOrEqual(121);
    });

    it('should return expired for timed-out session', () => {
      const startedAt = new Date(Date.now() - 200000).toISOString();
      const result = checkTimeLimit(startedAt);
      expect(result.isExpired).toBe(true);
      expect(result.elapsedSeconds).toBe(120);
      expect(result.remainingSeconds).toBe(0);
    });

    it('should return not expired for null startedAt', () => {
      const result = checkTimeLimit(null);
      expect(result.isExpired).toBe(false);
      expect(result.elapsedSeconds).toBe(0);
      expect(result.remainingSeconds).toBe(120);
    });

    it('should return expired at exactly TIME_LIMIT seconds', () => {
      const startedAt = new Date(Date.now() - 120000).toISOString();
      const result = checkTimeLimit(startedAt);
      expect(result.isExpired).toBe(true);
      expect(result.elapsedSeconds).toBe(120);
      expect(result.remainingSeconds).toBe(0);
    });
  });

  describe('getTimeoutElapsed', () => {
    it('should return 120', () => {
      expect(getTimeoutElapsed()).toBe(120);
    });
  });
});
