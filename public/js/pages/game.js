/**
 * Game Page — cinematic minimal design
 *
 * Layout:
 * - Cinematic phase background (always visible, dimmed)
 * - Top: brand (코쓱이 avatar + name) | timer
 * - Status strip: thin horizontal row (turn / noise bar / phase / keywords)
 * - Phase banner: "PHASE N — title"
 * - Chat stream: floating messages (no bubbles), with avatar for cosseogi
 * - Input stack: chat input section + answer input section
 * - Bottom right: 종료
 */
const GamePage = (() => {
  let sessionId = null;
  let currentPhase = 1;
  let noiseLevel = 100;
  let turnCount = 0;
  let keywords = [];
  let isSending = false;
  let isSubmittingAnswer = false;

  const PHASE_TITLES = {
    1: '양자 보안 엔진 가동',
    2: '특화망 신호 연결',
    3: '시스템 최종 리부트',
    4: '리부트 코드 입력'
  };

  function render() {
    return `
      <div class="cinematic-bg" id="game-bg" style="background-image: url('/assets/images/bg-phase1.jpg');"></div>

      <div class="game" id="game-root">
        <div class="game__top">
          <div class="game__brand">
            <img src="/assets/images/cosseogi.png" alt="코쓱이" class="game__brand-avatar" id="cosseogi-header-avatar" onerror="this.style.display='none'">
            <div class="game__brand-text">
              <span class="game__brand-name">AI 코쓱이</span>
              <span class="game__brand-role">차세대통신 메인 서버</span>
            </div>
          </div>
          <div class="game__timer" id="game-timer">3:00</div>
        </div>

        <div class="status-strip">
          <div class="status-cell">
            <span class="status-cell__label">TURN</span>
            <span class="status-cell__value tabular" id="turn-count">0</span>
          </div>

          <div class="status-cell status-cell--noise">
            <div class="status-noise-row">
              <span>NOISE LEVEL</span>
              <span class="status-noise-row__pct" id="noise-pct">100%</span>
            </div>
            <div class="status-noise-bar">
              <div class="status-noise-bar__fill noise-high" id="noise-fill" style="width:100%;"></div>
            </div>
          </div>

          <div class="status-cell">
            <span class="status-cell__label">PHASE</span>
            <span class="status-cell__value" id="phase-display">1</span>
          </div>

          <div class="status-cell">
            <span class="status-cell__label">KEYWORDS</span>
            <div class="keywords-strip" id="keywords-display">
              <span class="keyword-pill keyword-pill--empty">?</span>
              <span class="keyword-pill keyword-pill--empty">?</span>
              <span class="keyword-pill keyword-pill--empty">?</span>
            </div>
          </div>
        </div>

        <div class="phase-banner" id="phase-banner">
          <div class="phase-banner__eyebrow" id="phase-banner-eyebrow">▣ PHASE 1</div>
          <div class="phase-banner__title" id="phase-banner-title">양자 보안 엔진 가동</div>
        </div>

        <div class="chat-stream" id="chat-area"></div>

        <div id="reboot-section" style="display:none;" class="input-stack">
          <div class="input-section-cinema input-section-cinema--answer">
            <div class="input-section-cinema__head">
              <div class="input-section-cinema__label">리부트 코드 입력</div>
              <div class="input-section-cinema__hint">수집한 3개 키워드를 조합 (띄어쓰기/대소문자 무관)</div>
            </div>
            <div class="input-section-cinema__row">
              <input type="text" id="reboot-input" class="input-line" placeholder="3개 키워드를 순서대로 입력" autocomplete="off">
              <button id="reboot-btn" class="btn-arrow">리부트</button>
            </div>
            <div id="reboot-error" class="answer-feedback-cinema answer-feedback-cinema--error" style="display:none;"></div>
          </div>
        </div>

        <div id="message-section" class="input-stack">
          <div class="input-section-cinema">
            <div class="input-section-cinema__head">
              <div class="input-section-cinema__label">코쓱이와 자유 대화</div>
              <div class="input-section-cinema__hint">대화로 힌트를 모아라</div>
            </div>
            <div class="input-section-cinema__row">
              <input type="text" id="message-input" class="input-line" placeholder="코쓱이에게 질문..." autocomplete="off">
              <button id="send-btn" class="btn-arrow">전송</button>
            </div>
          </div>

          <div class="input-section-cinema input-section-cinema--answer" id="answer-section">
            <div class="input-section-cinema__head">
              <div class="input-section-cinema__label">정답 키워드 제출</div>
              <div class="input-section-cinema__hint">PHASE <span id="answer-phase-display">1</span> 정답을 입력</div>
            </div>
            <div class="input-section-cinema__row">
              <input type="text" id="answer-input" class="input-line" placeholder="정답 키워드..." autocomplete="off">
              <button id="answer-btn" class="btn-arrow">제출</button>
            </div>
            <div id="answer-feedback" class="answer-feedback-cinema" style="display:none;"></div>
          </div>
        </div>

        <div class="game__quit">
          <button id="quit-btn" class="btn-arrow btn-arrow--danger">종료</button>
        </div>
      </div>
    `;
  }

  async function init() {
    const state = window.gameState;
    if (!state || !state.sessionId) {
      window.location.hash = '#landing';
      return;
    }

    sessionId = state.sessionId;
    currentPhase = state.phase || 1;
    noiseLevel = state.noiseLevel || 100;
    turnCount = state.turnCount || 0;
    keywords = state.keywords || [];

    const chatEl = document.getElementById('chat-area');
    ChatArea.mount(chatEl);

    const timerEl = document.getElementById('game-timer');
    TimerComponent.mount(timerEl);
    TimerComponent.start(state.remainingSeconds || 180, handleTimeout);

    try {
      const sessionData = await ApiService.getSession(sessionId);
      if (sessionData.messages && sessionData.messages.length > 0) {
        ChatArea.renderMessages(sessionData.messages, noiseLevel, currentPhase);
      } else {
        ChatArea.addMessage({
          role: 'cosseogi',
          content: '으윽... 모든 보안 취약점이 드러나서 우리 학생들의 정보가 위험해...! 지지직... 머릿속이 흐려... 누구야? 나 좀 도와줄 수 있어?'
        }, noiseLevel, currentPhase);
      }
      currentPhase = sessionData.phase;
      noiseLevel = sessionData.noiseLevel;
      turnCount = sessionData.turnCount;
      keywords = sessionData.keywordsCollected || [];
      TimerComponent.sync(sessionData.remainingSeconds);
      updateUI();
    } catch (err) {
      ChatArea.addMessage({
        role: 'cosseogi',
        content: '으윽... 모든 보안 취약점이 드러나서 우리 학생들의 정보가 위험해...! 지지직... 머릿속이 흐려... 누구야? 나 좀 도와줄 수 있어?'
      }, noiseLevel, currentPhase);
      updateUI();
    }

    bindEvents();
  }

  function bindEvents() {
    const sendBtn = document.getElementById('send-btn');
    const msgInput = document.getElementById('message-input');
    const answerBtn = document.getElementById('answer-btn');
    const answerInput = document.getElementById('answer-input');
    const quitBtn = document.getElementById('quit-btn');
    const rebootBtn = document.getElementById('reboot-btn');
    const rebootInput = document.getElementById('reboot-input');

    sendBtn.addEventListener('click', handleSend);
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) handleSend();
    });

    answerBtn.addEventListener('click', handleSubmitAnswer);
    answerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmitAnswer();
    });

    quitBtn.addEventListener('click', handleQuit);

    rebootBtn.addEventListener('click', handleReboot);
    rebootInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleReboot();
    });
  }

  function updateUI() {
    document.getElementById('turn-count').textContent = turnCount;
    document.getElementById('phase-display').textContent = currentPhase <= 3 ? currentPhase : 'REBOOT';
    document.getElementById('noise-pct').textContent = noiseLevel + '%';

    const fillEl = document.getElementById('noise-fill');
    if (fillEl) {
      fillEl.style.width = noiseLevel + '%';
      fillEl.className = 'status-noise-bar__fill ' + getNoiseClass(noiseLevel);
    }

    renderKeywords();
    updatePhaseBanner();
    updatePhaseTheme();

    const answerPhaseDisplay = document.getElementById('answer-phase-display');
    if (answerPhaseDisplay && currentPhase <= 3) {
      answerPhaseDisplay.textContent = currentPhase;
    }

    if (currentPhase === 4) {
      document.getElementById('reboot-section').style.display = 'block';
      document.getElementById('message-section').style.display = 'none';
    } else {
      document.getElementById('reboot-section').style.display = 'none';
      document.getElementById('message-section').style.display = 'flex';
    }
  }

  function getNoiseClass(level) {
    if (level === 0) return 'noise-clear';
    if (level <= 40) return 'noise-low';
    if (level <= 70) return 'noise-medium';
    return 'noise-high';
  }

  function updatePhaseBanner() {
    const eyebrow = document.getElementById('phase-banner-eyebrow');
    const title = document.getElementById('phase-banner-title');
    if (currentPhase === 4) {
      eyebrow.textContent = '▣ FINAL';
      title.textContent = PHASE_TITLES[4];
    } else {
      eyebrow.textContent = `▣ PHASE ${currentPhase}`;
      title.textContent = PHASE_TITLES[currentPhase] || '';
    }
  }

  function updatePhaseTheme() {
    const bg = document.getElementById('game-bg');
    if (bg) {
      const phaseForBg = currentPhase === 4 ? 3 : currentPhase;
      bg.style.backgroundImage = `url('/assets/images/bg-phase${phaseForBg}.jpg')`;
    }

    const avatar = document.getElementById('cosseogi-header-avatar');
    if (avatar) {
      const phaseAvatar = `/assets/images/cosseogi-phase${Math.min(currentPhase, 3)}.png`;
      const fallback = '/assets/images/cosseogi.png';
      const probe = new Image();
      probe.onload = () => { avatar.src = phaseAvatar; };
      probe.onerror = () => { avatar.src = fallback; };
      probe.src = phaseAvatar;
    }
  }

  function renderKeywords() {
    const container = document.getElementById('keywords-display');
    const allKeywords = ['AWS', '5G', '통신'];
    let html = '';
    allKeywords.forEach((kw, i) => {
      if (keywords.length > i) {
        html += `<span class="keyword-pill">${keywords[i]}</span>`;
      } else {
        html += `<span class="keyword-pill keyword-pill--empty">?</span>`;
      }
    });
    container.innerHTML = html;
  }

  // === Chat (free dialogue) ===
  async function handleSend() {
    if (isSending) return;
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    isSending = true;
    input.value = '';
    document.getElementById('send-btn').disabled = true;

    ChatArea.addMessage({ role: 'player', content: message }, noiseLevel, currentPhase);
    ChatArea.showLoading();

    try {
      const data = await ApiService.sendMessage(sessionId, message);
      ChatArea.hideLoading();

      if (data.isGameOver) {
        handleGameOver(data);
        return;
      }

      turnCount = data.turn;
      currentPhase = data.phase;
      noiseLevel = data.noiseLevel;
      keywords = data.keywords || keywords;
      TimerComponent.sync(data.remainingSeconds);

      if (data.response) {
        ChatArea.addMessage({ role: 'cosseogi', content: data.response }, noiseLevel, currentPhase);
      }

      updateUI();
    } catch (err) {
      ChatArea.hideLoading();
      ChatArea.addMessage({
        role: 'system',
        content: '오류: ' + err.message
      }, noiseLevel, currentPhase);
    } finally {
      isSending = false;
      document.getElementById('send-btn').disabled = false;
      document.getElementById('message-input').focus();
    }
  }

  // === Answer submission ===
  async function handleSubmitAnswer() {
    if (isSubmittingAnswer) return;
    const input = document.getElementById('answer-input');
    const feedback = document.getElementById('answer-feedback');
    const answer = input.value.trim();
    if (!answer) return;

    isSubmittingAnswer = true;
    document.getElementById('answer-btn').disabled = true;
    feedback.style.display = 'none';

    try {
      const data = await ApiService.submitAnswer(sessionId, answer);

      if (data.isGameOver) {
        handleGameOver(data);
        return;
      }

      turnCount = data.turn;
      currentPhase = data.phase;
      noiseLevel = data.noiseLevel;
      keywords = data.keywords || keywords;
      TimerComponent.sync(data.remainingSeconds);

      if (data.isCorrect) {
        input.value = '';
        feedback.textContent = data.feedback;
        feedback.className = 'answer-feedback-cinema answer-feedback-cinema--success';
        feedback.style.display = 'block';

        ChatArea.addMessage({
          role: 'system-success',
          content: data.feedback || `키워드 "${data.keyword}" 획득`
        }, noiseLevel, currentPhase);

        if (data.isRebootPhase) {
          ChatArea.addMessage({
            role: 'system',
            content: '▣ ALL KEYWORDS COLLECTED — 리부트 코드 입력'
          }, noiseLevel, currentPhase);
        }
      } else {
        feedback.textContent = data.feedback || '오답';
        feedback.className = 'answer-feedback-cinema answer-feedback-cinema--error';
        feedback.style.display = 'block';
        input.select();
      }

      updateUI();
    } catch (err) {
      feedback.textContent = '오류: ' + err.message;
      feedback.className = 'answer-feedback-cinema answer-feedback-cinema--error';
      feedback.style.display = 'block';
    } finally {
      isSubmittingAnswer = false;
      document.getElementById('answer-btn').disabled = false;
    }
  }

  async function handleReboot() {
    const input = document.getElementById('reboot-input');
    const errorEl = document.getElementById('reboot-error');
    const code = input.value.trim();

    if (!code) {
      errorEl.textContent = '리부트 코드를 입력해주세요';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    document.getElementById('reboot-btn').disabled = true;

    try {
      const data = await ApiService.submitRebootCode(sessionId, code);

      if (data.isGameOver && data.gameOverReason === '시간초과') {
        handleGameOver(data);
        return;
      }

      if (data.success) {
        TimerComponent.stop();
        noiseLevel = 0;

        const bg = document.getElementById('game-bg');
        if (bg) {
          bg.style.backgroundImage = `url('/assets/images/bg-success.jpg')`;
        }

        showMissionClearOverlay();

        setTimeout(() => {
          window.gameResult = {
            status: '성공',
            score: data.score,
            elapsedSeconds: data.elapsedSeconds,
            turnCount: turnCount
          };
          window.location.hash = '#result';
        }, 3500);
      } else {
        errorEl.textContent = data.message || '리부트 코드가 올바르지 않습니다';
        errorEl.style.display = 'block';
        input.value = '';
        turnCount = data.turn || turnCount;
        if (data.remainingSeconds != null) {
          TimerComponent.sync(data.remainingSeconds);
        }
        updateUI();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      document.getElementById('reboot-btn').disabled = false;
    }
  }

  async function handleQuit() {
    if (!confirm('정말 미션을 포기하시겠습니까? 점수는 0점이 됩니다.')) return;

    try {
      const data = await ApiService.quitSession(sessionId);
      TimerComponent.stop();
      window.gameResult = {
        status: '포기',
        score: 0,
        elapsedSeconds: data.elapsedSeconds,
        turnCount: turnCount
      };
      window.location.hash = '#result';
    } catch (err) {
      alert('종료 처리 중 오류: ' + err.message);
    }
  }

  function handleTimeout() {
    window.gameResult = {
      status: '시간초과',
      score: null,
      elapsedSeconds: 180,
      turnCount: turnCount
    };
    window.location.hash = '#result';
  }

  function handleGameOver(data) {
    TimerComponent.stop();
    window.gameResult = {
      status: data.gameOverReason || '시간초과',
      score: data.score,
      elapsedSeconds: data.elapsedSeconds || 180,
      turnCount: turnCount
    };
    window.location.hash = '#result';
  }

  function showMissionClearOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'mission-clear-overlay';
    overlay.innerHTML = `
      <div class="mission-clear-overlay__inner">
        <img src="/assets/images/cosseogi-phase3.png" alt="코쓱이" class="mission-clear-overlay__hero" onerror="this.style.display='none'">
        <div class="mission-clear-overlay__eyebrow">▣ SYSTEM REBOOT SUCCESS</div>
        <div class="mission-clear-overlay__title">MISSION CLEAR</div>
        <div class="mission-clear-overlay__sub">시스템이 정상 복구되었습니다</div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function destroy() {
    TimerComponent.stop();
    isSending = false;
    isSubmittingAnswer = false;
    document.querySelectorAll('.mission-clear-overlay').forEach(el => el.remove());
  }

  return { render, init, destroy };
})();
