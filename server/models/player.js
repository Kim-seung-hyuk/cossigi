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

  // 🏷️ 재도전 허용: phone/student_id에 '성공' 세션이 이미 있으면 차단 (race 방어).
  //   precheck에서 1차 검사했지만 사용자가 인트로 거치는 동안 같은 번호로 성공할 수도 있음.
  if (phoneNormalized) {
    const phoneSuccess = db.prepare(`
      SELECT 1 FROM sessions s
      JOIN players p ON p.id = s.player_id
      WHERE p.phone = ? AND s.status = '성공' LIMIT 1
    `).get(phoneNormalized);
    if (phoneSuccess) throw new Error('이미 성공한 전화번호입니다. 다른 번호로 도전해주세요');
  }
  if (studentIdNormalized) {
    const sidSuccess = db.prepare(`
      SELECT 1 FROM sessions s
      JOIN players p ON p.id = s.player_id
      WHERE p.student_id = ? AND s.status = '성공' LIMIT 1
    `).get(studentIdNormalized);
    if (sidSuccess) throw new Error('이미 성공한 학번입니다. 다른 학번으로 도전해주세요');
  }

  // UNIQUE 제거됨 → INSERT 항상 성공. 같은 phone/student_id의 새 player row 허용.
  const result = db.prepare(
    'INSERT INTO players (name, phone, student_id, consent_at) VALUES (?, ?, ?, ?)'
  ).run(trimmed, phoneNormalized, studentIdNormalized, consentAt);
  return { id: result.lastInsertRowid, name: trimmed };
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

/**
 * 관리자 페이지용 — 플레이어 목록 + 시도 횟수/베스트 점수 집계.
 *
 * 한 player row = 한 도전(재도전 정책상 같은 phone/student_id로 여러 row 가능).
 * 각 row마다 그 player_id에 묶인 sessions로부터 LEFT JOIN 집계.
 *
 * @param {{limit?: number, offset?: number, q?: string}} opts
 * @returns {{ total: number, players: object[] }}
 */
function listPlayersWithStats({ limit = 50, offset = 0, q = '' } = {}) {
  const db = getDatabase();
  const trimmedQ = (q || '').trim();
  const like = `%${trimmedQ}%`;
  const where = trimmedQ
    ? 'WHERE p.name LIKE ? OR p.phone LIKE ? OR p.student_id LIKE ?'
    : '';
  const whereParams = trimmedQ ? [like, like, like] : [];

  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM players p ${where}`
  ).get(...whereParams).c;

  // best_status: 성공 > 시간초과 > 포기 > in_progress 순으로 우선.
  // 같은 등급 안에선 score DESC. CASE 식으로 정렬 후 LIMIT 1.
  const players = db.prepare(`
    SELECT
      p.id, p.name, p.phone, p.student_id, p.consent_at, p.created_at,
      COUNT(s.id)         AS session_count,
      MAX(s.score)        AS best_score,
      MAX(CASE WHEN s.status = '성공' THEN 1 ELSE 0 END) AS has_success,
      (
        SELECT s2.status FROM sessions s2
         WHERE s2.player_id = p.id
         ORDER BY CASE s2.status
                    WHEN '성공'     THEN 0
                    WHEN '시간초과' THEN 1
                    WHEN '포기'     THEN 2
                    ELSE 3 END ASC,
                  s2.score DESC
         LIMIT 1
      ) AS best_status
    FROM players p
    LEFT JOIN sessions s ON s.player_id = p.id
    ${where}
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...whereParams, limit, offset);

  return { total, players };
}

module.exports = {
  validateName,
  validatePhone,
  validateStudentId,
  isNameTaken,
  createPlayer,
  getPlayerById,
  getPlayerByName,
  deletePlayer,
  listPlayersWithStats
};
