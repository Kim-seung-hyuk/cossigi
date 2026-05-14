/**
 * Integration tests for REST API routes
 */

const request = require('supertest');
const { app } = require('../server/index');
const { getDatabase, closeDatabase } = require('../server/database/connection');

// Set test DB path
process.env.DB_PATH = ':memory:';

let db;

beforeAll(() => {
  db = getDatabase();
});

afterAll(() => {
  closeDatabase();
});

beforeEach(() => {
  // Clean up tables before each test
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM players');
});

describe('POST /api/sessions', () => {
  it('should create a new session with valid name', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ playerName: '테스트유저' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.phase).toBe(1);
    expect(res.body.noiseLevel).toBe(100);
    expect(res.body).toHaveProperty('startedAt');
    expect(res.body).toHaveProperty('remainingSeconds');
    expect(res.body.remainingSeconds).toBeLessThanOrEqual(180);
  });

  it('should reject empty name', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ playerName: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('이름');
  });

  it('should reject name longer than 20 chars', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ playerName: 'a'.repeat(21) });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('20자');
  });

  it('should reject duplicate name', async () => {
    await request(app)
      .post('/api/sessions')
      .send({ playerName: '중복이름' });

    const res = await request(app)
      .post('/api/sessions')
      .send({ playerName: '중복이름' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('이미 사용 중인 이름');
  });
});

describe('GET /api/sessions/:id', () => {
  it('should return session state', async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: '조회유저' });

    const sessionId = createRes.body.sessionId;

    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.phase).toBe(1);
    expect(res.body.noiseLevel).toBe(100);
    expect(res.body.status).toBe('in_progress');
    expect(res.body).toHaveProperty('messages');
    expect(res.body.messages.length).toBeGreaterThan(0); // initial greeting
  });

  it('should return 404 for non-existent session', async () => {
    const res = await request(app).get('/api/sessions/non-existent-id');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/sessions/:id/quit', () => {
  it('should quit the game with score 0', async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: '포기유저' });

    const sessionId = createRes.body.sessionId;

    const res = await request(app).post(`/api/sessions/${sessionId}/quit`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('포기');
    expect(res.body.score).toBe(0);
  });

  it('should reject quit for already ended session', async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: '이중포기' });

    const sessionId = createRes.body.sessionId;

    await request(app).post(`/api/sessions/${sessionId}/quit`);
    const res = await request(app).post(`/api/sessions/${sessionId}/quit`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('이미 종료');
  });
});

describe('POST /api/sessions/:id/messages', () => {
  let sessionId;

  beforeEach(async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: `메시지유저${Date.now()}` });
    sessionId = createRes.body.sessionId;
  });

  it('should accept correct keyword for phase 1', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: 'AWS' });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.phase).toBe(2);
    expect(res.body.noiseLevel).toBe(70);
    expect(res.body.keyword).toBe('AWS');
    expect(res.body.keywords).toContain('AWS');
  });

  it('should accept case-insensitive keyword', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: 'aws' });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.phase).toBe(2);
  });

  it('should reject incorrect message and return AI response', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: '안녕하세요' });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body).toHaveProperty('response');
    expect(res.body.phase).toBe(1);
    expect(res.body.noiseLevel).toBe(100);
  });

  it('should reject empty message', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: '' });

    expect(res.status).toBe(400);
  });

  it('should progress through all phases', async () => {
    // Phase 1: AWS
    let res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: 'AWS' });
    expect(res.body.phase).toBe(2);
    expect(res.body.noiseLevel).toBe(70);

    // Phase 2: 5G
    res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: '5G' });
    expect(res.body.phase).toBe(3);
    expect(res.body.noiseLevel).toBe(40);

    // Phase 3: 통신
    res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ message: '통신' });
    expect(res.body.phase).toBe(4);
    expect(res.body.noiseLevel).toBe(10);
    expect(res.body.isRebootPhase).toBe(true);
  });
});

describe('POST /api/sessions/:id/reboot', () => {
  let sessionId;

  beforeEach(async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: `리부트유저${Date.now()}` });
    sessionId = createRes.body.sessionId;

    // Progress to phase 4
    await request(app).post(`/api/sessions/${sessionId}/messages`).send({ message: 'AWS' });
    await request(app).post(`/api/sessions/${sessionId}/messages`).send({ message: '5G' });
    await request(app).post(`/api/sessions/${sessionId}/messages`).send({ message: '통신' });
  });

  it('should succeed with correct reboot code', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/reboot`)
      .send({ code: 'AWS 5G 통신' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.completionStatus).toBe('성공');
    expect(res.body.noiseLevel).toBe(0);
    expect(res.body).toHaveProperty('score');
    expect(res.body.score).toBeGreaterThan(0);
  });

  it('should reject incorrect reboot code (lowercase)', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/reboot`)
      .send({ code: 'aws 5g 통신' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('올바르지 않');
  });

  it('should reject reboot when not in phase 4', async () => {
    // Create a new session that's still in phase 1
    const newRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: `페이즈1유저${Date.now()}` });

    const res = await request(app)
      .post(`/api/sessions/${newRes.body.sessionId}/reboot`)
      .send({ code: 'AWS 5G 통신' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('리부트 단계가 아닙니다');
  });

  it('should allow retry after failed reboot', async () => {
    // First attempt - wrong code
    let res = await request(app)
      .post(`/api/sessions/${sessionId}/reboot`)
      .send({ code: 'wrong code' });
    expect(res.body.success).toBe(false);

    // Second attempt - correct code
    res = await request(app)
      .post(`/api/sessions/${sessionId}/reboot`)
      .send({ code: 'AWS 5G 통신' });
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/rankings', () => {
  it('should return empty rankings initially', async () => {
    const res = await request(app).get('/api/rankings');

    expect(res.status).toBe(200);
    expect(res.body.rankings).toEqual([]);
  });

  it('should return rankings after sessions complete', async () => {
    // Create and complete a session
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ playerName: '랭킹유저' });
    const sessionId = createRes.body.sessionId;

    await request(app).post(`/api/sessions/${sessionId}/messages`).send({ message: 'AWS' });
    await request(app).post(`/api/sessions/${sessionId}/messages`).send({ message: '5G' });
    await request(app).post(`/api/sessions/${sessionId}/messages`).send({ message: '통신' });
    await request(app).post(`/api/sessions/${sessionId}/reboot`).send({ code: 'AWS 5G 통신' });

    const res = await request(app).get('/api/rankings');

    expect(res.status).toBe(200);
    expect(res.body.rankings.length).toBe(1);
    expect(res.body.rankings[0].playerName).toBe('랭킹유저');
    expect(res.body.rankings[0].status).toBe('성공');
    expect(res.body.rankings[0].score).toBeGreaterThan(0);
  });
});

describe('GET /api/rankings/top10', () => {
  it('should return top 10 rankings', async () => {
    const res = await request(app).get('/api/rankings/top10');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rankings');
    expect(Array.isArray(res.body.rankings)).toBe(true);
  });
});
