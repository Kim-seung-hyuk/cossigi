/**
 * Player Model - CRUD operations for players table
 */

const { getDatabase } = require('../database/connection');

/**
 * Validate player name length (1~20 characters).
 * 
 * @param {string} name - Player name to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: '이름을 입력해주세요' };
  }

  const trimmed = name.trim();

  if (trimmed.length > 20) {
    return { valid: false, error: '이름은 20자 이하로 입력해주세요' };
  }

  return { valid: true };
}

/**
 * Check if a player name already exists in the database.
 * The UNIQUE constraint on players.name enforces uniqueness.
 * 
 * @param {string} name - Player name to check
 * @returns {boolean} True if name already exists
 */
function isNameTaken(name) {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM players WHERE name = ?').get(name.trim());
  return !!row;
}

/**
 * 전화번호 형식 검증 — 한국 휴대폰 (010/011/016/017/018/019, 9~11자리).
 * 하이픈/공백은 자동 제거 후 검증.
 *
 * @param {string} phone
 * @returns {{ valid: boolean, normalized?: string, error?: string }}
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return { valid: false, error: '전화번호를 입력해주세요' };
  }
  const digits = phone.replace(/[\s-]/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) {
    return { valid: false, error: '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)' };
  }
  return { valid: true, normalized: digits };
}

/**
 * 학번 형식 검증 — 숫자 6~10자리 (국민대 8자리 기준 + 타 대학 호환).
 * 공백 자동 제거.
 *
 * @param {string} studentId
 * @returns {{ valid: boolean, normalized?: string, error?: string }}
 */
function validateStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
    return { valid: false, error: '학번을 입력해주세요' };
  }
  const digits = studentId.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(digits)) {
    return { valid: false, error: '학번은 숫자 6~10자리로 입력해주세요' };
  }
  return { valid: true, normalized: digits };
}

/**
 * Create a new player.
 *
 * @param {string} name - Player name
 * @param {{ phone?: string, studentId?: string, consent?: boolean }} [extra] - 개인정보 (선택)
 * @returns {{ id: number, name: string } | null} Created player or null if name is taken
 * @throws {Error} If validation fails
 */
function createPlayer(name, extra = {}) {
  const validation = validateName(name);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const trimmed = name.trim();
  const db = getDatabase();

  // 개인정보 (선택): phone/학번 + 동의가 모두 있을 때만 저장
  let phoneNormalized = null;
  let studentIdNormalized = null;
  let consentAt = null;
  if (extra.phone || extra.studentId || extra.consent) {
    if (!extra.consent) {
      throw new Error('개인정보 수집·이용 동의가 필요합니다');
    }
    const phoneValidation = validatePhone(extra.phone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error);
    }
    const studentIdValidation = validateStudentId(extra.studentId);
    if (!studentIdValidation.valid) {
      throw new Error(studentIdValidation.error);
    }
    phoneNormalized = phoneValidation.normalized;
    studentIdNormalized = studentIdValidation.normalized;
    consentAt = new Date().toISOString();
  }

  try {
    const result = db.prepare(
      'INSERT INTO players (name, phone, student_id, consent_at) VALUES (?, ?, ?, ?)'
    ).run(trimmed, phoneNormalized, studentIdNormalized, consentAt);
    return { id: result.lastInsertRowid, name: trimmed };
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('UNIQUE constraint failed')) {
      // partial unique index: 'idx_players_phone' / 'idx_players_student_id'
      if (msg.includes('phone')) {
        throw new Error('이미 등록된 전화번호입니다. 다른 번호로 시도해주세요');
      }
      if (msg.includes('student_id')) {
        throw new Error('이미 등록된 학번입니다. 다른 학번으로 시도해주세요');
      }
      // 안전망 (예상 못 한 UNIQUE 위반)
      throw new Error('중복된 정보가 있습니다. 입력값을 확인해주세요');
    }
    throw err;
  }
}

/**
 * Get a player by ID.
 * 
 * @param {number} id - Player ID
 * @returns {object|undefined} Player record or undefined
 */
function getPlayerById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
}

/**
 * Get a player by name.
 * 
 * @param {string} name - Player name
 * @returns {object|undefined} Player record or undefined
 */
function getPlayerByName(name) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM players WHERE name = ?').get(name.trim());
}

/**
 * Delete a player by ID (used when browser disconnects to allow name reuse).
 * 
 * @param {number} id - Player ID
 * @returns {boolean} True if player was deleted
 */
function deletePlayer(id) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM players WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  validateName,
  validatePhone,
  validateStudentId,
  isNameTaken,
  createPlayer,
  getPlayerById,
  getPlayerByName,
  deletePlayer
};
