/**
 * Sessions API Routes
 * 
 * POST /api/sessions       - Create a new game session
 * GET  /api/sessions/:id   - Get session state
 * POST /api/sessions/:id/quit - Quit the game
 */

const express = require('express');
const router = express.Router();
const playerModel = require('../models/player');
const sessionModel = require('../models/session');
const messageModel = require('../models/message');
const timerService = require('../services/timerService');

/**
 * POST /api/sessions
 * Create a new game session.
 * 
 * Request body: { playerName: string }
 * Response: { sessionId, phase, noiseLevel, startedAt, remainingSeconds }
 */
router.post('/', (req, res) => {
  try {
    const { playerName, phone, studentId, consent } = req.body;

    // 1. Validate name (1-20 chars)
    const validation = playerModel.validateName(playerName);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // 2. Check if name is already taken
    if (playerModel.isNameTaken(playerName)) {
      return res.status(400).json({ error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요' });
    }

    // 3. Create player record (phone + 학번 + 동의는 보상 추첨용 옵션 정보)
    let player;
    try {
      player = playerModel.createPlayer(playerName, { phone, studentId, consent: !!consent });
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }
    if (!player) {
      return res.status(400).json({ error: '이미 사용 중인 이름입니다. 다른 이름을 입력해주세요' });
    }

    // 4. Create session record
    const session = sessionModel.createSession(player.id);

    // 5. Save initial cosseogi greeting (in-character intro) — phase 1로 소속
    const greeting = '으윽... 모든 보안 취약점이 드러나서 우리 학생들의 정보가 위험해...! 지지직... 머릿속이 흐려... 누구야? 나 좀 도와줄 수 있어?';
    messageModel.createMessage(session.id, 'cosseogi', greeting, null, 1);

    // 6. Return session info
    const remainingSeconds = timerService.getRemainingSeconds(session.started_at);

    res.status(201).json({
      sessionId: session.id,
      phase: session.phase,
      noiseLevel: session.noise_level,
      startedAt: session.started_at,
      remainingSeconds
    });
  } catch (err) {
    console.error('[Sessions] Error creating session:', err.message);
    res.status(500).json({ error: '세션 생성 중 오류가 발생했습니다. 다시 시도해주세요' });
  }
});

/**
 * GET /api/sessions/:id
 * Get session state.
 * 
 * Response: session details with remaining time
 */
router.get('/:id', (req, res) => {
  try {
    const session = sessionModel.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }

    const remainingSeconds = session.status === 'in_progress'
      ? timerService.getRemainingSeconds(session.started_at)
      : 0;

    const messages = messageModel.getMessagesBySessionId(session.id);

    res.json({
      sessionId: session.id,
      phase: session.phase,
      noiseLevel: session.noise_level,
      turnCount: session.turn_count,
      status: session.status,
      score: session.score,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      elapsedSeconds: session.elapsed_seconds,
      remainingSeconds,
      keywordsCollected: JSON.parse(session.keywords_collected || '[]'),
      messages
    });
  } catch (err) {
    console.error('[Sessions] Error getting session:', err.message);
    res.status(500).json({ error: '세션 조회 중 오류가 발생했습니다' });
  }
});

/**
 * POST /api/sessions/:id/quit
 * Quit the game. Score = 0, status = '포기'
 */
router.post('/:id/quit', (req, res) => {
  try {
    const session = sessionModel.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }

    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: '이미 종료된 세션입니다' });
    }

    // Calculate elapsed time
    const { elapsedSeconds } = timerService.checkTimeLimit(session.started_at);

    // End session with score 0 and status '포기'
    const updatedSession = sessionModel.endSession(session.id, '포기', 0, elapsedSeconds);

    res.json({
      sessionId: updatedSession.id,
      status: updatedSession.status,
      score: 0,
      elapsedSeconds: updatedSession.elapsed_seconds
    });
  } catch (err) {
    console.error('[Sessions] Error quitting session:', err.message);
    res.status(500).json({ error: '게임 종료 중 오류가 발생했습니다' });
  }
});

module.exports = router;
