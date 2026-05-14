/**
 * Messages API Routes
 *
 * POST /api/sessions/:id/messages - Free chat with 코쓱이 (AI only, no keyword check)
 * POST /api/sessions/:id/answer   - Submit a keyword guess for current phase
 * POST /api/sessions/:id/reboot   - Submit reboot code (phase 4)
 *
 * 채팅과 정답 제출이 분리되어 있다. 둘 다 turn 카운트를 증가시켜서,
 * 적은 시도/적은 질문으로 정답을 맞출수록 점수가 높아진다.
 */

const express = require('express');
const router = express.Router();
const sessionModel = require('../models/session');
const messageModel = require('../models/message');
const gameManager = require('../services/gameManager');
// AI 서비스: USE_BEDROCK 환경변수 켜져 있으면 Bedrock 단독 모드.
// (server/index_bedrock.js 진입점에서 켬)
const aiService = process.env.USE_BEDROCK
  ? require('../services/aiServiceBedrock')
  : require('../services/aiService');
const timerService = require('../services/timerService');

/**
 * 세션 시간 만료 시 자동 종료 후 응답 생성.
 * @returns {object|null} 만료 시 응답 객체, 아니면 null
 */
function handleTimeoutIfExpired(session) {
  const timeCheck = timerService.checkTimeLimit(session.started_at);
  if (!timeCheck.isExpired) return { expired: false, timeCheck };

  const timeoutSession = { ...session, status: '시간초과' };
  const score = gameManager.calculateScore(timeoutSession);
  const updatedSession = sessionModel.endSession(
    session.id,
    '시간초과',
    score,
    timerService.getTimeoutElapsed()
  );

  return {
    expired: true,
    payload: {
      isCorrect: false,
      phase: updatedSession.phase,
      noiseLevel: updatedSession.noise_level,
      turn: updatedSession.turn_count,
      keywords: JSON.parse(updatedSession.keywords_collected || '[]'),
      isGameOver: true,
      gameOverReason: '시간초과',
      score,
      elapsedSeconds: timerService.getTimeoutElapsed(),
      remainingSeconds: 0
    }
  };
}

/**
 * POST /api/sessions/:id/messages
 * 코쓱이와 자유 대화. 키워드 체크는 하지 않는다.
 *
 * Request body: { message: string }
 * Response: { response, phase, noiseLevel, turn, keywords, remainingSeconds, isGameOver }
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: '메시지를 입력해주세요' });
    }

    const session = sessionModel.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: '이미 종료된 세션입니다' });
    }

    const timeoutResult = handleTimeoutIfExpired(session);
    if (timeoutResult.expired) {
      return res.json(timeoutResult.payload);
    }
    const { timeCheck } = timeoutResult;

    // Chat increments turn count (penalizes excessive chatter, rewards efficiency)
    const newTurnCount = (session.turn_count || 0) + 1;
    const currentPhaseTurnsKey = `phase${session.phase}_turns`;
    const currentPhaseTurns = (session[currentPhaseTurnsKey] || 0) + 1;

    sessionModel.updateSession(session.id, {
      turn_count: newTurnCount,
      [currentPhaseTurnsKey]: currentPhaseTurns
    });

    messageModel.createMessage(session.id, 'player', message.trim(), newTurnCount);

    const messages = messageModel.getMessagesBySessionId(session.id);
    const conversationHistory = messages
      .filter(m => m.role === 'player' || m.role === 'cosseogi')
      .map(m => ({ role: m.role, content: m.content }));

    let aiResponse;
    try {
      const result = await aiService.generateResponse({
        phase: session.phase,
        noiseLevel: session.noise_level,
        playerMessage: message.trim(),
        conversationHistory
      });
      // Bedrock 모드는 {text, usage}, 일반 모드는 string 반환
      if (typeof result === 'string') {
        aiResponse = result;
      } else {
        aiResponse = result.text;
        if (result.usage) {
          sessionModel.addBedrockUsage(
            session.id,
            result.usage.input_tokens,
            result.usage.output_tokens
          );
        }
      }
    } catch (aiError) {
      console.error('[Messages] AI service error:', aiError.message);
      aiResponse = '지직... 응답 생성에 실패했어... 다시 한번 말해줄래?';
    }

    messageModel.createMessage(session.id, 'cosseogi', aiResponse, newTurnCount);

    return res.json({
      response: aiResponse,
      phase: session.phase,
      noiseLevel: session.noise_level,
      turn: newTurnCount,
      keywords: JSON.parse(session.keywords_collected || '[]'),
      isGameOver: false,
      remainingSeconds: timeCheck.remainingSeconds
    });
  } catch (err) {
    console.error('[Messages] Error processing chat:', err.message);
    res.status(500).json({ error: '메시지 처리 중 오류가 발생했습니다. 다시 시도해주세요' });
  }
});

/**
 * POST /api/sessions/:id/answer
 * 정답 키워드 제출. 현재 페이즈의 키워드와 일치하는지 검증한다.
 *
 * Request body: { answer: string }
 * Response: { isCorrect, phase, noiseLevel, keyword?, keywords, turn, isRebootPhase, remainingSeconds, feedback }
 */
router.post('/:id/answer', (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({ error: '정답을 입력해주세요' });
    }

    const session = sessionModel.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: '이미 종료된 세션입니다' });
    }
    if (session.phase >= 4) {
      return res.status(400).json({ error: '이미 모든 키워드를 수집했습니다. 리부트 코드를 입력해주세요.' });
    }

    const timeoutResult = handleTimeoutIfExpired(session);
    if (timeoutResult.expired) {
      return res.json(timeoutResult.payload);
    }
    const { timeCheck } = timeoutResult;

    const result = gameManager.processMessage(session, answer.trim());
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const updates = {
      turn_count: result.turn,
      [`phase${session.phase}_turns`]: result.currentPhaseTurns
    };

    if (result.isCorrect) {
      updates.phase = result.phase;
      updates.noise_level = result.noiseLevel;
      updates.keywords_collected = JSON.stringify(result.keywords);
      updates[`phase${session.phase}_completed`] = 1;

      sessionModel.updateSession(session.id, updates);

      const feedbackMsg = result.isRebootPhase
        ? `✓ 키워드 "${result.keyword}" 획득! 모든 키워드를 수집했어. 이제 리부트 코드를 입력해줘!`
        : `✓ 키워드 "${result.keyword}" 획득! 노이즈 레벨이 ${result.noiseLevel}%로 감소했어.`;
      messageModel.createMessage(session.id, 'system', feedbackMsg, result.turn);

      // 페이즈 전환 안내 (코쓱이 캐릭터 메시지로) — 사용자가 어떤 문제 푸는지 인지하도록
      const phaseGuide = {
        2: '(눈을 반짝이며) 노이즈가 좀 줄었어! 이제 두 번째 문제야 — **우리넷 동글이 쓰는 통신망 기술 이름**을 맞춰야 해. LTE 다음 세대인 그 빠른 거 있잖아... 알지? 부스 자료에도 있어!',
        3: '(한숨 돌리며) 휴... 좀 살 것 같아! 마지막 문제야 — **\'국민대학교 차세대OO 사업단\'** 빈칸 두 글자를 맞춰야 해. 신호 주고받는 그 분야 말이야. 부스 안 전공 홍보 자료 표지에 큼지막하게 적혀있어, 거기 봐!',
        4: '(밝게 웃으며) 와! 모든 키워드 다 모았어!! 이제 세 키워드를 순서대로 띄어서 **리부트 코드 입력란**에 넣으면 시스템이 정상 복구돼. 너가 마지막 열쇠야!'
      };
      const guideMsg = phaseGuide[result.phase];
      if (guideMsg) {
        messageModel.createMessage(session.id, 'cosseogi', guideMsg, result.turn);
      }

      return res.json({
        isCorrect: true,
        phase: result.phase,
        noiseLevel: result.noiseLevel,
        keyword: result.keyword,
        keywords: result.keywords,
        turn: result.turn,
        isGameOver: false,
        isRebootPhase: result.isRebootPhase,
        remainingSeconds: timeCheck.remainingSeconds,
        feedback: feedbackMsg
      });
    }

    // Wrong answer: count the turn but stay in current phase
    sessionModel.updateSession(session.id, updates);

    const wrongMsg = `✗ "${answer.trim()}"은(는) 정답이 아니야. 다시 한번 코쓱이와 대화해보고 시도해봐!`;
    messageModel.createMessage(session.id, 'system', wrongMsg, result.turn);

    return res.json({
      isCorrect: false,
      phase: result.phase,
      noiseLevel: result.noiseLevel,
      turn: result.turn,
      keywords: result.keywords,
      isGameOver: false,
      remainingSeconds: timeCheck.remainingSeconds,
      feedback: wrongMsg
    });
  } catch (err) {
    console.error('[Messages] Error processing answer:', err.message);
    res.status(500).json({ error: '정답 처리 중 오류가 발생했습니다. 다시 시도해주세요' });
  }
});

/**
 * POST /api/sessions/:id/reboot
 * 리부트 코드 제출 (Phase 4).
 *
 * Request body: { code: string }
 * Response: { success, score?, completionStatus?, elapsedSeconds?, message?, remainingSeconds }
 */
router.post('/:id/reboot', (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ error: '리부트 코드를 입력해주세요' });
    }

    const session = sessionModel.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: '이미 종료된 세션입니다' });
    }
    if (session.phase !== 4) {
      return res.status(400).json({ error: '리부트 단계가 아닙니다. 모든 키워드를 먼저 수집해주세요.' });
    }

    const timeCheck = timerService.checkTimeLimit(session.started_at);
    if (timeCheck.isExpired) {
      const timeoutSession = { ...session, status: '시간초과' };
      const score = gameManager.calculateScore(timeoutSession);
      sessionModel.endSession(session.id, '시간초과', score, timerService.getTimeoutElapsed());

      return res.json({
        success: false,
        isGameOver: true,
        gameOverReason: '시간초과',
        score,
        elapsedSeconds: timerService.getTimeoutElapsed(),
        remainingSeconds: 0
      });
    }

    const newTurnCount = (session.turn_count || 0) + 1;
    sessionModel.updateSession(session.id, { turn_count: newTurnCount });

    const rebootResult = gameManager.verifyRebootCode(code);

    if (rebootResult.success) {
      const updatedSession = sessionModel.getSessionById(session.id);
      const finalSession = {
        ...updatedSession,
        status: '성공',
        turn_count: newTurnCount,
        elapsed_seconds: timeCheck.elapsedSeconds // 점수 계산에 시간 반영 (버그 수정)
      };
      const score = gameManager.calculateScore(finalSession);
      sessionModel.endSession(session.id, '성공', score, timeCheck.elapsedSeconds);

      messageModel.createMessage(session.id, 'player', code.trim(), newTurnCount);
      messageModel.createMessage(session.id, 'system', 'System Reboot Success! 🎉', newTurnCount);

      return res.json({
        success: true,
        score,
        completionStatus: '성공',
        elapsedSeconds: timeCheck.elapsedSeconds,
        noiseLevel: 0,
        message: rebootResult.message,
        remainingSeconds: 0
      });
    }

    messageModel.createMessage(session.id, 'player', code.trim(), newTurnCount);
    messageModel.createMessage(session.id, 'system', rebootResult.message, newTurnCount);

    return res.json({
      success: false,
      message: rebootResult.message,
      turn: newTurnCount,
      remainingSeconds: timeCheck.remainingSeconds
    });
  } catch (err) {
    console.error('[Messages] Error processing reboot:', err.message);
    res.status(500).json({ error: '리부트 코드 처리 중 오류가 발생했습니다. 다시 시도해주세요' });
  }
});

module.exports = router;
