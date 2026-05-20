/**
 * Unit tests for Player, Session, and Message models
 */

const path = require('path');
const fs = require('fs');

// Override DB_PATH to use in-memory or temp file for tests
process.env.DB_PATH = path.join(__dirname, '..', 'data', 'test-models.db');

const { getDatabase, closeDatabase } = require('../server/database/connection');
const playerModel = require('../server/models/player');
const sessionModel = require('../server/models/session');
const messageModel = require('../server/models/message');

beforeAll(() => {
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  // Initialize DB
  getDatabase();
});

afterAll(() => {
  closeDatabase();
  // Clean up test database
  const dbPath = path.resolve(process.env.DB_PATH);
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
});

beforeEach(() => {
  // Clear tables before each test
  const db = getDatabase();
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM players');
});

// ============ Player Model Tests ============

describe('Player Model', () => {
  describe('validateName', () => {
    it('should accept valid names (1-20 chars)', () => {
      expect(playerModel.validateName('홍길동')).toEqual({ valid: true });
      expect(playerModel.validateName('A')).toEqual({ valid: true });
      expect(playerModel.validateName('12345678901234567890')).toEqual({ valid: true }); // 20 chars
    });

    it('should reject empty or whitespace-only names', () => {
      expect(playerModel.validateName('')).toEqual({ valid: false, error: '이름을 입력해주세요' });
      expect(playerModel.validateName('   ')).toEqual({ valid: false, error: '이름을 입력해주세요' });
      expect(playerModel.validateName(null)).toEqual({ valid: false, error: '이름을 입력해주세요' });
      expect(playerModel.validateName(undefined)).toEqual({ valid: false, error: '이름을 입력해주세요' });
    });

    it('should reject names longer than 20 characters', () => {
      expect(playerModel.validateName('123456789012345678901')).toEqual({
        valid: false,
        error: '이름은 20자 이하로 입력해주세요'
      });
    });
  });

  describe('createPlayer', () => {
    it('should create a player with valid name', () => {
      const player = playerModel.createPlayer('테스트유저');
      expect(player).not.toBeNull();
      expect(player.id).toBeDefined();
      expect(player.name).toBe('테스트유저');
    });

    it('should trim whitespace from name', () => {
      const player = playerModel.createPlayer('  유저  ');
      expect(player.name).toBe('유저');
    });

    it('should return null for duplicate names', () => {
      playerModel.createPlayer('중복이름');
      const result = playerModel.createPlayer('중복이름');
      expect(result).toBeNull();
    });

    it('should throw error for invalid names', () => {
      expect(() => playerModel.createPlayer('')).toThrow('이름을 입력해주세요');
      expect(() => playerModel.createPlayer('a'.repeat(21))).toThrow('이름은 20자 이하로 입력해주세요');
    });
  });

  describe('isNameTaken', () => {
    it('should return true for existing names', () => {
      playerModel.createPlayer('존재하는이름');
      expect(playerModel.isNameTaken('존재하는이름')).toBe(true);
    });

    it('should return false for non-existing names', () => {
      expect(playerModel.isNameTaken('없는이름')).toBe(false);
    });
  });

  describe('getPlayerById / getPlayerByName', () => {
    it('should retrieve player by ID', () => {
      const created = playerModel.createPlayer('조회테스트');
      const found = playerModel.getPlayerById(created.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('조회테스트');
    });

    it('should retrieve player by name', () => {
      playerModel.createPlayer('이름조회');
      const found = playerModel.getPlayerByName('이름조회');
      expect(found).toBeDefined();
      expect(found.name).toBe('이름조회');
    });

    it('should return undefined for non-existing player', () => {
      expect(playerModel.getPlayerById(9999)).toBeUndefined();
      expect(playerModel.getPlayerByName('없음')).toBeUndefined();
    });
  });

  describe('deletePlayer', () => {
    it('should delete a player and allow name reuse', () => {
      const player = playerModel.createPlayer('삭제대상');
      expect(playerModel.deletePlayer(player.id)).toBe(true);
      expect(playerModel.isNameTaken('삭제대상')).toBe(false);

      // Name can be reused
      const newPlayer = playerModel.createPlayer('삭제대상');
      expect(newPlayer).not.toBeNull();
    });
  });
});

// ============ Session Model Tests ============

describe('Session Model', () => {
  let testPlayer;

  beforeEach(() => {
    testPlayer = playerModel.createPlayer('세션테스트유저');
  });

  describe('createSession', () => {
    it('should create a session with correct initial state', () => {
      const session = sessionModel.createSession(testPlayer.id);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.id.length).toBe(36); // UUID format
      expect(session.player_id).toBe(testPlayer.id);
      expect(session.phase).toBe(1);
      expect(session.noise_level).toBe(100);
      expect(session.turn_count).toBe(0);
      expect(session.status).toBe('in_progress');
      expect(session.score).toBeNull();
      expect(session.started_at).toBeDefined();
      expect(session.keywords_collected).toBe('[]');
    });
  });

  describe('getSessionById', () => {
    it('should retrieve session by ID', () => {
      const created = sessionModel.createSession(testPlayer.id);
      const found = sessionModel.getSessionById(created.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
    });

    it('should return undefined for non-existing session', () => {
      expect(sessionModel.getSessionById('non-existent-id')).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    it('should update phase and noise level', () => {
      const session = sessionModel.createSession(testPlayer.id);
      const updated = sessionModel.updateSession(session.id, {
        phase: 2,
        noise_level: 70,
        turn_count: 3,
        phase1_completed: 1,
        phase1_turns: 3,
        keywords_collected: '["AWS"]'
      });

      expect(updated.phase).toBe(2);
      expect(updated.noise_level).toBe(70);
      expect(updated.turn_count).toBe(3);
      expect(updated.phase1_completed).toBe(1);
      expect(updated.phase1_turns).toBe(3);
      expect(updated.keywords_collected).toBe('["AWS"]');
    });

    it('should update phase2 and phase3 turns', () => {
      const session = sessionModel.createSession(testPlayer.id);
      sessionModel.updateSession(session.id, {
        phase2_completed: 1,
        phase2_turns: 2,
        phase3_completed: 1,
        phase3_turns: 4
      });

      const found = sessionModel.getSessionById(session.id);
      expect(found.phase2_completed).toBe(1);
      expect(found.phase2_turns).toBe(2);
      expect(found.phase3_completed).toBe(1);
      expect(found.phase3_turns).toBe(4);
    });

    it('should not update disallowed fields', () => {
      const session = sessionModel.createSession(testPlayer.id);
      const updated = sessionModel.updateSession(session.id, {
        id: 'hacked-id',
        player_id: 999
      });
      expect(updated.id).toBe(session.id);
      expect(updated.player_id).toBe(testPlayer.id);
    });
  });

  describe('endSession', () => {
    it('should end session with success status', () => {
      const session = sessionModel.createSession(testPlayer.id);
      const ended = sessionModel.endSession(session.id, '성공', 850, 60);

      expect(ended.status).toBe('성공');
      expect(ended.score).toBe(850);
      expect(ended.elapsed_seconds).toBe(60);
      expect(ended.ended_at).toBeDefined();
    });

    it('should end session with timeout status', () => {
      const session = sessionModel.createSession(testPlayer.id);
      const ended = sessionModel.endSession(session.id, '시간초과', 770, 120);

      expect(ended.status).toBe('시간초과');
      expect(ended.score).toBe(770);
      expect(ended.elapsed_seconds).toBe(120);
    });

    it('should end session with quit status', () => {
      const session = sessionModel.createSession(testPlayer.id);
      const ended = sessionModel.endSession(session.id, '포기', 0, 45);

      expect(ended.status).toBe('포기');
      expect(ended.score).toBe(0);
      expect(ended.elapsed_seconds).toBe(45);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', () => {
      const session = sessionModel.createSession(testPlayer.id);
      expect(sessionModel.deleteSession(session.id)).toBe(true);
      expect(sessionModel.getSessionById(session.id)).toBeUndefined();
    });
  });

  describe('getRankedSessions / getTop10Sessions', () => {
    it('should rank sessions: 성공 above others, score DESC, elapsed ASC', () => {
      // Create multiple players and sessions
      const p1 = playerModel.createPlayer('랭킹1');
      const p2 = playerModel.createPlayer('랭킹2');
      const p3 = playerModel.createPlayer('랭킹3');
      const p4 = playerModel.createPlayer('랭킹4');

      const s1 = sessionModel.createSession(p1.id);
      const s2 = sessionModel.createSession(p2.id);
      const s3 = sessionModel.createSession(p3.id);
      const s4 = sessionModel.createSession(p4.id);

      // End sessions with different statuses and scores
      sessionModel.endSession(s1.id, '성공', 900, 50);
      sessionModel.endSession(s2.id, '성공', 850, 60);
      sessionModel.endSession(s3.id, '시간초과', 770, 120);
      sessionModel.endSession(s4.id, '포기', 0, 30);

      const rankings = sessionModel.getRankedSessions();
      expect(rankings.length).toBe(4);

      // 성공 sessions first, sorted by score DESC
      expect(rankings[0].player_name).toBe('랭킹1'); // 성공, 900
      expect(rankings[1].player_name).toBe('랭킹2'); // 성공, 850
      // Then others by score DESC
      expect(rankings[2].player_name).toBe('랭킹3'); // 시간초과, 860
      expect(rankings[3].player_name).toBe('랭킹4'); // 포기, 0
    });

    it('should sort same score by elapsed_seconds ASC', () => {
      const p1 = playerModel.createPlayer('동점1');
      const p2 = playerModel.createPlayer('동점2');

      const s1 = sessionModel.createSession(p1.id);
      const s2 = sessionModel.createSession(p2.id);

      sessionModel.endSession(s1.id, '성공', 900, 70);
      sessionModel.endSession(s2.id, '성공', 900, 50);

      const rankings = sessionModel.getRankedSessions();
      // Same score, shorter time first
      expect(rankings[0].player_name).toBe('동점2'); // elapsed 50
      expect(rankings[1].player_name).toBe('동점1'); // elapsed 70
    });

    it('should return top 10 only', () => {
      // Create 12 players/sessions
      for (let i = 0; i < 12; i++) {
        const p = playerModel.createPlayer(`탑텐${i}`);
        const s = sessionModel.createSession(p.id);
        sessionModel.endSession(s.id, '성공', 1000 - i * 10, 60 + i);
      }

      const top10 = sessionModel.getTop10Sessions();
      expect(top10.length).toBe(10);
      expect(top10[0].score).toBe(1000);
      expect(top10[9].score).toBe(910);
    });

    it('should not include in_progress sessions in rankings', () => {
      const p = playerModel.createPlayer('진행중');
      sessionModel.createSession(p.id); // in_progress

      const rankings = sessionModel.getRankedSessions();
      expect(rankings.length).toBe(0);
    });
  });
});

// ============ Message Model Tests ============

describe('Message Model', () => {
  let testPlayer;
  let testSession;

  beforeEach(() => {
    testPlayer = playerModel.createPlayer('메시지테스트');
    testSession = sessionModel.createSession(testPlayer.id);
  });

  describe('createMessage', () => {
    it('should create a player message', () => {
      const msg = messageModel.createMessage(testSession.id, 'player', '안녕하세요', 1);
      expect(msg).toBeDefined();
      expect(msg.session_id).toBe(testSession.id);
      expect(msg.role).toBe('player');
      expect(msg.content).toBe('안녕하세요');
      expect(msg.turn_number).toBe(1);
    });

    it('should create a cosseogi message', () => {
      const msg = messageModel.createMessage(testSession.id, 'cosseogi', '지지직... 안녕!', 1);
      expect(msg.role).toBe('cosseogi');
      expect(msg.content).toBe('지지직... 안녕!');
    });

    it('should create a system message with null turn', () => {
      const msg = messageModel.createMessage(testSession.id, 'system', '게임 시작!');
      expect(msg.role).toBe('system');
      expect(msg.turn_number).toBeNull();
    });
  });

  describe('getMessagesBySessionId', () => {
    it('should return messages in chronological order', () => {
      messageModel.createMessage(testSession.id, 'system', '게임 시작', null);
      messageModel.createMessage(testSession.id, 'player', 'AWS', 1);
      messageModel.createMessage(testSession.id, 'cosseogi', '정답!', 1);

      const messages = messageModel.getMessagesBySessionId(testSession.id);
      expect(messages.length).toBe(3);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('player');
      expect(messages[2].role).toBe('cosseogi');
    });

    it('should return empty array for session with no messages', () => {
      const messages = messageModel.getMessagesBySessionId(testSession.id);
      expect(messages).toEqual([]);
    });
  });

  describe('getMessageCount', () => {
    it('should return correct message count', () => {
      messageModel.createMessage(testSession.id, 'player', 'msg1', 1);
      messageModel.createMessage(testSession.id, 'cosseogi', 'msg2', 1);
      expect(messageModel.getMessageCount(testSession.id)).toBe(2);
    });

    it('should return 0 for session with no messages', () => {
      expect(messageModel.getMessageCount(testSession.id)).toBe(0);
    });
  });

  describe('deleteMessagesBySessionId', () => {
    it('should delete all messages for a session', () => {
      messageModel.createMessage(testSession.id, 'player', 'msg1', 1);
      messageModel.createMessage(testSession.id, 'cosseogi', 'msg2', 1);

      const deleted = messageModel.deleteMessagesBySessionId(testSession.id);
      expect(deleted).toBe(2);
      expect(messageModel.getMessagesBySessionId(testSession.id)).toEqual([]);
    });
  });
});
