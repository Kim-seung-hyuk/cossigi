/**
 * Game Manager - Core game logic for Mission: Zero Noise
 * 
 * Handles keyword validation, score calculation, noise level management,
 * phase transitions, and reboot code verification.
 */

const config = require('../config');

// Phase keywords definition
const PHASE_KEYWORDS = {
  1: 'AWS',
  2: '양자',
  3: '보안'
};

// Noise levels after each phase completion
// Start: 100% → Phase 1 done: 70% → Phase 2 done: 40% → Phase 3 done: 10% → Reboot: 0%
const NOISE_LEVELS = {
  start: 100,
  phase1Complete: 70,
  phase2Complete: 40,
  phase3Complete: 10,
  rebootComplete: 0
};

// The exact reboot code (case-sensitive, uppercase only)
const REBOOT_CODE = 'AWS 양자 보안';

/**
 * Check if a player's message matches the keyword for the given phase.
 * Case-insensitive exact match after trimming. Only standalone text is accepted.
 * 
 * @param {number} phase - Current mission phase (1, 2, or 3)
 * @param {string} message - Player's input message
 * @returns {boolean} Whether the message matches the phase keyword
 */
function checkKeyword(phase, message) {
  if (!message || typeof message !== 'string') return false;
  if (!PHASE_KEYWORDS[phase]) return false;

  const trimmed = message.trim();
  const keyword = PHASE_KEYWORDS[phase];

  // Case-insensitive exact match (standalone text only)
  return trimmed.toLowerCase() === keyword.toLowerCase();
}

/**
 * Calculate the score for a completed session.
 * 
 * Success: Score = 1000 - (Turn × 10) - (elapsed_seconds × 1.5)
 * Timeout: Score = 1000 - (completed phases turns sum × 10) - (GAME_TIME_LIMIT × 1.5)
 *          Only turns from fully completed phases are counted.
 *          The phase that was in progress at timeout is NOT included.
 *          시간초과 패널티는 config.GAME_TIME_LIMIT(2분=120s)에 비례.
 * Quit: Score = 0
 * 
 * @param {object} session - Session data object
 * @param {string} session.status - 'success', 'timeout', or 'quit'
 * @param {number} session.turn_count - Total turn count
 * @param {number} session.elapsed_seconds - Total elapsed time in seconds
 * @param {number} session.phase1_completed - Whether phase 1 was completed (0 or 1)
 * @param {number} session.phase2_completed - Whether phase 2 was completed (0 or 1)
 * @param {number} session.phase3_completed - Whether phase 3 was completed (0 or 1)
 * @param {number} session.phase1_turns - Turns used in phase 1
 * @param {number} session.phase2_turns - Turns used in phase 2
 * @param {number} session.phase3_turns - Turns used in phase 3
 * @returns {number} Calculated score
 */
function calculateScore(session) {
  if (!session) return 0;

  const status = session.status;

  // Quit: always 0
  if (status === 'quit' || status === '포기') {
    return 0;
  }

  // Success: Score = 1000 - (Turn × 10) - (elapsed_seconds × 1.5)
  if (status === 'success' || status === '성공') {
    const turns = session.turn_count || 0;
    const elapsed = session.elapsed_seconds || 0;
    return Math.max(0, Math.round(1000 - (turns * 10) - (elapsed * 1.5)));
  }

  // Timeout: Only count turns from completed phases + 시간초과 패널티 (GAME_TIME_LIMIT * 1.5)
  if (status === 'timeout' || status === '시간초과') {
    let completedTurns = 0;
    if (session.phase1_completed) {
      completedTurns += session.phase1_turns || 0;
    }
    if (session.phase2_completed) {
      completedTurns += session.phase2_turns || 0;
    }
    if (session.phase3_completed) {
      completedTurns += session.phase3_turns || 0;
    }
    return Math.max(0, Math.round(1000 - (completedTurns * 10) - (config.GAME_TIME_LIMIT * 1.5)));
  }

  return 0;
}

/**
 * Get the noise level for a given phase state.
 * 
 * @param {number} phase - Current phase (1-4, where 4 is reboot phase)
 * @param {boolean} phaseCompleted - Whether the current phase was just completed
 * @returns {number} Noise level percentage (0-100)
 */
function getNoiseLevel(phase, phaseCompleted) {
  if (!phaseCompleted) {
    // Return the noise level for the current active phase
    switch (phase) {
      case 1: return NOISE_LEVELS.start;        // 100%
      case 2: return NOISE_LEVELS.phase1Complete; // 70%
      case 3: return NOISE_LEVELS.phase2Complete; // 40%
      case 4: return NOISE_LEVELS.phase3Complete; // 10%
      default: return NOISE_LEVELS.start;
    }
  }

  // Phase just completed - return the new noise level
  switch (phase) {
    case 1: return NOISE_LEVELS.phase1Complete; // 70%
    case 2: return NOISE_LEVELS.phase2Complete; // 40%
    case 3: return NOISE_LEVELS.phase3Complete; // 10%
    case 4: return NOISE_LEVELS.rebootComplete; // 0%
    default: return NOISE_LEVELS.start;
  }
}

/**
 * Process a player message during the game.
 * Checks keyword, updates phase/noise/turns, or delegates to AI for response.
 * 
 * This function contains the core logic. The route layer will handle
 * DB operations and AI service calls.
 * 
 * @param {object} session - Current session data from DB
 * @param {string} message - Player's input message
 * @returns {object} Result of processing the message
 */
function processMessage(session, message) {
  if (!session || session.status !== 'in_progress') {
    return { error: 'Session is not active', isGameOver: true };
  }

  const currentPhase = session.phase;
  const isCorrect = checkKeyword(currentPhase, message);

  // Increment turn count
  const newTurnCount = (session.turn_count || 0) + 1;

  if (isCorrect) {
    // Phase completed
    const newNoiseLevel = getNoiseLevel(currentPhase, true);
    const keyword = PHASE_KEYWORDS[currentPhase];
    const nextPhase = currentPhase + 1; // 1→2, 2→3, 3→4 (reboot)

    // Collect keywords
    let keywords = [];
    try {
      keywords = JSON.parse(session.keywords_collected || '[]');
    } catch (e) {
      keywords = [];
    }
    keywords.push(keyword);

    // Calculate current phase turns (existing turns for this phase + 1 for this message)
    const currentPhaseTurnsKey = `phase${currentPhase}_turns`;
    const currentPhaseTurns = (session[currentPhaseTurnsKey] || 0) + 1;

    return {
      isCorrect: true,
      phase: nextPhase,
      noiseLevel: newNoiseLevel,
      keyword,
      keywords,
      turn: newTurnCount,
      currentPhaseTurns,
      isGameOver: false,
      isRebootPhase: nextPhase === 4
    };
  }

  // Incorrect answer - AI will respond
  // Calculate current phase turns for this phase
  const currentPhaseTurnsKey = `phase${currentPhase}_turns`;
  const currentPhaseTurns = (session[currentPhaseTurnsKey] || 0) + 1;

  return {
    isCorrect: false,
    phase: currentPhase,
    noiseLevel: getNoiseLevel(currentPhase, false),
    turn: newTurnCount,
    currentPhaseTurns,
    keywords: JSON.parse(session.keywords_collected || '[]'),
    isGameOver: false,
    needsAIResponse: true
  };
}

/**
 * Verify the reboot code entered by the player.
 * Match is normalized: whitespace stripped + lowercased on both sides,
 * so "AWS 양자 보안", "aws양자보안", "Aws 양자 보안" all pass.
 *
 * @param {string} code - The reboot code entered by the player
 * @returns {object} Verification result
 */
function verifyRebootCode(code) {
  if (!code || typeof code !== 'string') {
    return { success: false, message: '리부트 코드를 입력해주세요.' };
  }

  const normalize = (s) => s.replace(/\s+/g, '').toLowerCase();

  if (normalize(code) === normalize(REBOOT_CODE)) {
    return {
      success: true,
      noiseLevel: NOISE_LEVELS.rebootComplete, // 0%
      message: 'System Reboot Success!'
    };
  }

  return {
    success: false,
    message: '리부트 코드가 올바르지 않습니다. 수집한 세 키워드를 조합해서 다시 시도해주세요.'
  };
}

module.exports = {
  PHASE_KEYWORDS,
  NOISE_LEVELS,
  REBOOT_CODE,
  checkKeyword,
  calculateScore,
  getNoiseLevel,
  processMessage,
  verifyRebootCode
};
