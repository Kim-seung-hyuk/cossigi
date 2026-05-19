/**
 * Intro Page — pre-game briefing with typing effect
 *
 * Shown after the player enters their name on the landing page and clicks
 * "미션 시작". The session is NOT created here — it is created at the very
 * end when the player clicks "미션 시작" on the last panel, so the timer
 * only begins when the briefing is fully read.
 *
 * Flow:
 *  1. Cinematic full-screen background, 코쓱이 illustration on top.
 *  2. Four text panels appear sequentially with a typing effect (~20ms/char).
 *  3. Click anywhere (or "▸ 계속") advances to the next panel after typing
 *     completes. Clicking during typing skips ahead to the fully-typed state.
 *  4. After the last panel, the "→ 미션 시작" button calls createSession and
 *     navigates to #game.
 *  5. Top-right "스킵" link bypasses the briefing entirely.
 */
const IntroPage = (() => {
  const TYPING_SPEED_MS = 20;
  let currentPanel = 0;
  let isTyping = false;
  let typingTimer = null;
  let panels = [];
  let creatingSession = false;

  function buildPanels(name) {
    return [
      {
        eyebrow: '▣ SITUATION 01',
        body: `차세대통신 사업단의 양자 보안 시스템에\n원인 모를 노이즈가 발생했다.\n\n시스템에 치명적인 취약점이 드러났고,\n학생들의 정보가 위험에 처했다.`
      },
      {
        eyebrow: '▣ SITUATION 02',
        body: `양자 보안 시스템의 관리자 'AI 코쓱이'는\n노이즈에 갇혀 정상 작동을 멈췄다.\n\n당신은 이 시스템을 복구할 수 있는\n유일한 사람이다.`
      },
      {
        eyebrow: '▣ MISSION',
        body: `코쓱이와 대화하여 시스템 리부트에\n필요한 3개의 키워드를 알아내라.\n\n키워드는 '정답 입력란'에 별도로 제출.\n모든 키워드를 모으면 리부트 코드를 입력할 수 있다.`
      },
      {
        eyebrow: '▣ TACTICS',
        body: `코쓱이는 노이즈에 시달려 단편적으로 답한다.\n구체적인 질문을 던질수록 더 명확한 단서가 나온다.\n\n다만 강하게 추궁하면 더 못 떠올리니,\n부드럽게 접근하라.\n\n준비됐는가, ${name || '요원'}?`,
        isFinal: true
      }
    ];
  }

  function render() {
    const name = window.pendingPlayerName || '';
    if (!name) {
      // No name set — bounce back to landing
      window.location.hash = '#landing';
      return '<div></div>';
    }
    return `
      <div class="cinematic-bg" style="background-image: url('/assets/images/bg-phase1.jpg');"></div>

      <button class="intro__skip btn-link" id="intro-skip">스킵 →</button>

      <div class="intro" id="intro-root">
        <div class="intro__inner">
          <img src="/assets/images/cosseogi.png" alt="코쓱이" class="intro__hero" onerror="this.style.display='none'">

          <div class="intro__panel" id="intro-panel">
            <div class="intro__eyebrow" id="intro-eyebrow"></div>
            <div class="intro__body" id="intro-body"></div>
            <div class="intro__hint" id="intro-hint">
              <span id="intro-hint-text">▸ 화면을 클릭하면 계속</span>
            </div>
          </div>

          <div class="intro__progress" id="intro-progress"></div>

          <div class="intro__cta" id="intro-cta" style="display:none;">
            <button id="intro-start-btn" class="btn-arrow btn-arrow--primary">미션 시작</button>
          </div>

          <div id="intro-error" class="error-msg" style="display:none; text-align:center;"></div>
        </div>
      </div>
    `;
  }

  function init() {
    const name = window.pendingPlayerName;
    if (!name) {
      window.location.hash = '#landing';
      return;
    }

    panels = buildPanels(name);
    currentPanel = 0;

    renderProgress();
    typePanel(0);

    document.getElementById('intro-root').addEventListener('click', handleAdvance);
    document.getElementById('intro-skip').addEventListener('click', (e) => {
      e.stopPropagation();
      handleSkip();
    });
    document.getElementById('intro-start-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      handleConfirm();
    });
  }

  function renderProgress() {
    const container = document.getElementById('intro-progress');
    if (!container) return;
    let html = '';
    panels.forEach((_, i) => {
      const cls = i < currentPanel ? 'intro__dot intro__dot--done'
        : i === currentPanel ? 'intro__dot intro__dot--active'
        : 'intro__dot';
      html += `<span class="${cls}"></span>`;
    });
    container.innerHTML = html;
  }

  function typePanel(index) {
    const panel = panels[index];
    if (!panel) return;

    const eyebrowEl = document.getElementById('intro-eyebrow');
    const bodyEl = document.getElementById('intro-body');
    const hintEl = document.getElementById('intro-hint');
    const ctaEl = document.getElementById('intro-cta');

    eyebrowEl.textContent = panel.eyebrow;
    eyebrowEl.classList.remove('visible');
    requestAnimationFrame(() => eyebrowEl.classList.add('visible'));

    bodyEl.innerHTML = '';
    hintEl.style.opacity = '0';
    ctaEl.style.display = 'none';

    isTyping = true;
    let i = 0;
    const text = panel.body;

    function typeNext() {
      if (i >= text.length) {
        isTyping = false;
        // 마지막 패널: CTA 버튼 + "화면 클릭으로도 시작" 안내 둘 다 표시.
        if (panel.isFinal) {
          ctaEl.style.display = 'flex';
          requestAnimationFrame(() => ctaEl.classList.add('visible'));
          document.getElementById('intro-hint-text').textContent = '▸ 화면을 클릭해도 시작';
        } else {
          document.getElementById('intro-hint-text').textContent = '▸ 화면을 클릭하면 계속';
        }
        hintEl.style.opacity = '1';
        return;
      }
      const ch = text[i];
      if (ch === '\n') {
        bodyEl.appendChild(document.createElement('br'));
      } else {
        // append as a text node — preserves whitespace & doesn't reflow whole element
        bodyEl.appendChild(document.createTextNode(ch));
      }
      i++;
      typingTimer = setTimeout(typeNext, TYPING_SPEED_MS);
    }

    if (typingTimer) clearTimeout(typingTimer);
    typeNext();
  }

  function fastForwardCurrent() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    const panel = panels[currentPanel];
    if (!panel) return;
    const bodyEl = document.getElementById('intro-body');
    const hintEl = document.getElementById('intro-hint');
    const ctaEl = document.getElementById('intro-cta');

    bodyEl.innerHTML = '';
    panel.body.split('\n').forEach((line, idx, arr) => {
      bodyEl.appendChild(document.createTextNode(line));
      if (idx < arr.length - 1) bodyEl.appendChild(document.createElement('br'));
    });

    isTyping = false;
    if (panel.isFinal) {
      ctaEl.style.display = 'flex';
      requestAnimationFrame(() => ctaEl.classList.add('visible'));
      document.getElementById('intro-hint-text').textContent = '▸ 화면을 클릭해도 시작';
    } else {
      document.getElementById('intro-hint-text').textContent = '▸ 화면을 클릭하면 계속';
    }
    hintEl.style.opacity = '1';
  }

  function handleAdvance() {
    if (isTyping) {
      // First click during typing — fast-forward
      fastForwardCurrent();
      return;
    }
    if (currentPanel >= panels.length - 1) {
      // 마지막 패널 — 화면 클릭도 미션 시작으로 처리 (CTA 버튼과 동등).
      handleConfirm();
      return;
    }
    currentPanel += 1;
    renderProgress();
    typePanel(currentPanel);
  }

  function handleSkip() {
    if (creatingSession) return;
    if (typingTimer) clearTimeout(typingTimer);
    currentPanel = panels.length - 1;
    renderProgress();
    fastForwardCurrent();
  }

  async function handleConfirm() {
    if (creatingSession) return;
    const name = window.pendingPlayerName;
    if (!name) {
      window.location.hash = '#landing';
      return;
    }
    creatingSession = true;
    const btn = document.getElementById('intro-start-btn');
    const errorEl = document.getElementById('intro-error');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '접속 중...';
    }

    try {
      const data = await ApiService.createSession(
        name,
        window.pendingPlayerPhone,
        window.pendingPlayerStudentId,
        window.pendingPlayerConsent
      );
      window.gameState = {
        sessionId: data.sessionId,
        phase: data.phase,
        noiseLevel: data.noiseLevel,
        startedAt: data.startedAt,
        remainingSeconds: data.remainingSeconds,
        turnCount: 0,
        keywords: [],
        playerName: name
      };
      window.pendingPlayerName = null;
      window.pendingPlayerStudentId = null;
      window.pendingPlayerPhone = null;
      window.pendingPlayerConsent = null;
      window.location.hash = '#game';
    } catch (err) {
      creatingSession = false;
      if (errorEl) {
        errorEl.textContent = err.message || '세션 생성 실패. 다시 시도해주세요.';
        errorEl.style.display = 'block';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = '미션 시작';
      }
    }
  }

  function destroy() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    isTyping = false;
    creatingSession = false;
  }

  return { render, init, destroy };
})();
