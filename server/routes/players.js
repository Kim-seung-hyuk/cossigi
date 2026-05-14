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

    const db = getDatabase();
    const phoneDup = db.prepare('SELECT id FROM players WHERE phone = ?').get(phoneValidation.normalized);
    if (phoneDup) {
      return res.status(409).json({ error: '이미 등록된 전화번호입니다. 다른 번호로 시도해주세요' });
    }
    const sidDup = db.prepare('SELECT id FROM players WHERE student_id = ?').get(sidValidation.normalized);
    if (sidDup) {
      return res.status(409).json({ error: '이미 등록된 학번입니다. 다른 학번으로 시도해주세요' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Players] precheck error:', err.message);
    res.status(500).json({ error: '확인 중 오류가 발생했습니다. 다시 시도해주세요' });
  }
});

module.exports = router;
