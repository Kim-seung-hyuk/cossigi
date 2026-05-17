/**
 * Players API Routes
 *
 * POST /api/players/precheck
 *   랜딩 폼 제출 시 인트로로 넘어가기 전에 학번·전화번호 중복을 미리 확인.
 *   request body: { phone: string, studentId: string }
 *   200 { ok: true }                        — 사용 가능
 *   400 { error: '...' }                    — 형식 오류
 *   409 { error: '이미 등록된 ...' }         — 중복
 */

const express = require('express');
const router = express.Router();
const playerModel = require('../models/player');
const { getDatabase } = require('../database/connection');

router.post('/precheck', (req, res) => {
  try {
    const { phone, studentId } = req.body || {};

    const phoneValidation = playerModel.validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    const sidValidation = playerModel.validateStudentId(studentId);
    if (!sidValidation.valid) {
      return res.status(400).json({ error: sidValidation.error });
    }

    // 🏷️ '성공' 세션이 이미 있는 phone/student_id만 차단.
    //   시간초과·포기는 재도전 허용 (테이블에 player row가 남아도 OK).
    const db = getDatabase();
    const phoneSuccess = db.prepare(`
      SELECT 1 FROM sessions s
      JOIN players p ON p.id = s.player_id
      WHERE p.phone = ? AND s.status = '성공'
      LIMIT 1
    `).get(phoneValidation.normalized);
    if (phoneSuccess) {
      return res.status(409).json({ error: '이미 성공한 전화번호입니다. 다른 번호로 도전해주세요' });
    }
    const sidSuccess = db.prepare(`
      SELECT 1 FROM sessions s
      JOIN players p ON p.id = s.player_id
      WHERE p.student_id = ? AND s.status = '성공'
      LIMIT 1
    `).get(sidValidation.normalized);
    if (sidSuccess) {
      return res.status(409).json({ error: '이미 성공한 학번입니다. 다른 학번으로 도전해주세요' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Players] precheck error:', err.message);
    res.status(500).json({ error: '확인 중 오류가 발생했습니다. 다시 시도해주세요' });
  }
});

module.exports = router;
