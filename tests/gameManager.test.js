/**
 * Unit tests for Game Manager - Core game logic
 */

const {
  PHASE_KEYWORDS,
  NOISE_LEVELS,
  REBOOT_CODE,
  checkKeyword,
  calculateScore,
  getNoiseLevel,
  processMessage,
  verifyRebootCode
} = require('../server/services/gameManager');

describe('Game Manager', () => {
  describe('checkKeyword', () => {
    describe('Phase 1 - "AWS"', () => {
      it('should accept exact match "AWS"', () => {
        expect(checkKeyword(1, 'AWS')).toBe(true);
      });

      it('should accept lowercase "aws"', () => {
        expect(checkKeyword(1, 'aws')).toBe(true);
      });

      it('should accept mixed case "Aws"', () => {
        expect(checkKeyword(1, 'Aws')).toBe(true);
      });

      it('should accept with leading/trailing whitespace', () => {
        expect(checkKeyword(1, '  AWS  ')).toBe(true);
      });

      it('should reject keyword embedded in sentence', () => {
        expect(checkKeyword(1, 'I think AWS is the answer')).toBe(false);
      });

      it('should reject keyword with extra characters', () => {
        expect(checkKeyword(1, 'AWS!')).toBe(false);
      });

      it('should reject empty string', () => {
        expect(checkKeyword(1, '')).toBe(false);
      });

      it('should reject null/undefined', () => {
        expect(checkKeyword(1, null)).toBe(false);
        expect(checkKeyword(1, undefined)).toBe(false);
      });
    });

    describe('Phase 2 - "5G"', () => {
      it('should accept exact match "5G"', () => {
        expect(checkKeyword(2, '5G')).toBe(true);
      });

      it('should accept lowercase "5g"', () => {
        expect(checkKeyword(2, '5g')).toBe(true);
      });

      it('should reject "5G network"', () => {
        expect(checkKeyword(2, '5G network')).toBe(false);
      });
    });

    describe('Phase 3 - "통신"', () => {
      it('should accept exact match "통신"', () => {
        expect(checkKeyword(3, '통신')).toBe(true);
      });

      it('should accept with whitespace "  통신  "', () => {
        expect(checkKeyword(3, '  통신  ')).toBe(true);
      });

      it('should reject "차세대통신"', () => {
        expect(checkKeyword(3, '차세대통신')).toBe(false);
      });

      it('should reject "통신 사업단"', () => {
        expect(checkKeyword(3, '통신 사업단')).toBe(false);
      });
    });

    describe('Invalid phase', () => {
      it('should reject for invalid phase number', () => {
        expect(checkKeyword(0, 'AWS')).toBe(false);
        expect(checkKeyword(4, 'AWS')).toBe(false);
        expect(checkKeyword(99, 'test')).toBe(false);
      });
    });
  });

  describe('calculateScore', () => {
    describe('Success status', () => {
      it('should calculate score correctly for success', () => {
        const session = {
          status: 'success',
          turn_count: 10,
          elapsed_seconds: 60
        };
        // 1000 - (10 × 10) - (60 × 0.5) = 1000 - 100 - 30 = 870
        expect(calculateScore(session)).toBe(870);
      });

      it('should handle minimum turns and time', () => {
        const session = {
          status: 'success',
          turn_count: 3,
          elapsed_seconds: 20
        };
        // 1000 - (3 × 10) - (20 × 0.5) = 1000 - 30 - 10 = 960
        expect(calculateScore(session)).toBe(960);
      });

      it('should handle Korean status "성공"', () => {
        const session = {
          status: '성공',
          turn_count: 5,
          elapsed_seconds: 30
        };
        // 1000 - (5 × 10) - (30 × 0.5) = 1000 - 50 - 15 = 935
        expect(calculateScore(session)).toBe(935);
      });
    });

    describe('Timeout status', () => {
      it('should only count completed phase turns', () => {
        const session = {
          status: 'timeout',
          turn_count: 12,
          elapsed_seconds: 120,
          phase1_completed: 1,
          phase2_completed: 1,
          phase3_completed: 0,
          phase1_turns: 3,
          phase2_turns: 2,
          phase3_turns: 7
        };
        // Completed turns: 3 + 2 = 5 (phase3 not completed, so its 7 turns excluded)
        // 1000 - (5 × 10) - (120 × 1.5) = 1000 - 50 - 180 = 770
        expect(calculateScore(session)).toBe(770);
      });

      it('should handle no completed phases', () => {
        const session = {
          status: 'timeout',
          turn_count: 5,
          elapsed_seconds: 120,
          phase1_completed: 0,
          phase2_completed: 0,
          phase3_completed: 0,
          phase1_turns: 5,
          phase2_turns: 0,
          phase3_turns: 0
        };
        // No completed phases: turns = 0
        // 1000 - (0 × 10) - (120 × 1.5) = 1000 - 0 - 180 = 820
        expect(calculateScore(session)).toBe(820);
      });

      it('should handle Korean status "시간초과"', () => {
        const session = {
          status: '시간초과',
          turn_count: 8,
          elapsed_seconds: 120,
          phase1_completed: 1,
          phase2_completed: 0,
          phase3_completed: 0,
          phase1_turns: 2,
          phase2_turns: 6,
          phase3_turns: 0
        };
        // Completed turns: 2 (only phase1)
        // 1000 - (2 × 10) - (120 × 1.5) = 1000 - 20 - 180 = 800
        expect(calculateScore(session)).toBe(800);
      });
    });

    describe('Quit status', () => {
      it('should always return 0 for quit', () => {
        const session = {
          status: 'quit',
          turn_count: 10,
          elapsed_seconds: 60,
          phase1_completed: 1,
          phase2_completed: 1,
          phase3_completed: 0,
          phase1_turns: 3,
          phase2_turns: 4,
          phase3_turns: 3
        };
        expect(calculateScore(session)).toBe(0);
      });

      it('should handle Korean status "포기"', () => {
        const session = {
          status: '포기',
          turn_count: 1,
          elapsed_seconds: 5
        };
        expect(calculateScore(session)).toBe(0);
      });
    });

    describe('Edge cases', () => {
      it('should return 0 for null session', () => {
        expect(calculateScore(null)).toBe(0);
      });

      it('should return 0 for unknown status', () => {
        expect(calculateScore({ status: 'unknown' })).toBe(0);
      });
    });
  });

  describe('getNoiseLevel', () => {
    it('should return 100% for phase 1 (not completed)', () => {
      expect(getNoiseLevel(1, false)).toBe(100);
    });

    it('should return 70% when phase 1 is completed', () => {
      expect(getNoiseLevel(1, true)).toBe(70);
    });

    it('should return 70% for phase 2 (not completed)', () => {
      expect(getNoiseLevel(2, false)).toBe(70);
    });

    it('should return 40% when phase 2 is completed', () => {
      expect(getNoiseLevel(2, true)).toBe(40);
    });

    it('should return 40% for phase 3 (not completed)', () => {
      expect(getNoiseLevel(3, false)).toBe(40);
    });

    it('should return 10% when phase 3 is completed', () => {
      expect(getNoiseLevel(3, true)).toBe(10);
    });

    it('should return 10% for reboot phase (not completed)', () => {
      expect(getNoiseLevel(4, false)).toBe(10);
    });

    it('should return 0% when reboot is completed', () => {
      expect(getNoiseLevel(4, true)).toBe(0);
    });
  });

  describe('processMessage', () => {
    const baseSession = {
      id: 'test-session-1',
      phase: 1,
      noise_level: 100,
      turn_count: 0,
      status: 'in_progress',
      keywords_collected: '[]',
      phase1_turns: 0,
      phase2_turns: 0,
      phase3_turns: 0
    };

    it('should return error for inactive session', () => {
      const session = { ...baseSession, status: 'success' };
      const result = processMessage(session, 'AWS');
      expect(result.error).toBeDefined();
      expect(result.isGameOver).toBe(true);
    });

    it('should return error for null session', () => {
      const result = processMessage(null, 'AWS');
      expect(result.error).toBeDefined();
    });

    it('should detect correct keyword for phase 1', () => {
      const result = processMessage(baseSession, 'AWS');
      expect(result.isCorrect).toBe(true);
      expect(result.phase).toBe(2);
      expect(result.noiseLevel).toBe(70);
      expect(result.keyword).toBe('AWS');
      expect(result.keywords).toContain('AWS');
      expect(result.turn).toBe(1);
      expect(result.isRebootPhase).toBe(false);
    });

    it('should detect correct keyword for phase 3 and enter reboot phase', () => {
      const session = {
        ...baseSession,
        phase: 3,
        noise_level: 40,
        turn_count: 5,
        keywords_collected: '["AWS","5G"]',
        phase3_turns: 2
      };
      const result = processMessage(session, '통신');
      expect(result.isCorrect).toBe(true);
      expect(result.phase).toBe(4);
      expect(result.noiseLevel).toBe(10);
      expect(result.keyword).toBe('통신');
      expect(result.keywords).toEqual(['AWS', '5G', '통신']);
      expect(result.isRebootPhase).toBe(true);
    });

    it('should handle incorrect answer', () => {
      const result = processMessage(baseSession, 'wrong answer');
      expect(result.isCorrect).toBe(false);
      expect(result.phase).toBe(1);
      expect(result.noiseLevel).toBe(100);
      expect(result.turn).toBe(1);
      expect(result.needsAIResponse).toBe(true);
    });

    it('should increment turn count', () => {
      const session = { ...baseSession, turn_count: 3, phase1_turns: 3 };
      const result = processMessage(session, 'wrong');
      expect(result.turn).toBe(4);
      expect(result.currentPhaseTurns).toBe(4);
    });
  });

  describe('verifyRebootCode', () => {
    it('should accept exact "AWS 5G 통신"', () => {
      const result = verifyRebootCode('AWS 5G 통신');
      expect(result.success).toBe(true);
      expect(result.noiseLevel).toBe(0);
    });

    it('should accept with leading/trailing whitespace', () => {
      const result = verifyRebootCode('  AWS 5G 통신  ');
      expect(result.success).toBe(true);
    });

    it('should reject lowercase "aws 5g 통신"', () => {
      const result = verifyRebootCode('aws 5g 통신');
      expect(result.success).toBe(false);
    });

    it('should reject mixed case "Aws 5G 통신"', () => {
      const result = verifyRebootCode('Aws 5G 통신');
      expect(result.success).toBe(false);
    });

    it('should reject "AWS5G통신" (no spaces)', () => {
      const result = verifyRebootCode('AWS5G통신');
      expect(result.success).toBe(false);
    });

    it('should reject partial code "AWS 5G"', () => {
      const result = verifyRebootCode('AWS 5G');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = verifyRebootCode('');
      expect(result.success).toBe(false);
    });

    it('should reject null/undefined', () => {
      const result = verifyRebootCode(null);
      expect(result.success).toBe(false);
      const result2 = verifyRebootCode(undefined);
      expect(result2.success).toBe(false);
    });

    it('should reject wrong order "5G AWS 통신"', () => {
      const result = verifyRebootCode('5G AWS 통신');
      expect(result.success).toBe(false);
    });
  });
});
