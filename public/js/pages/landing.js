/**
 * Landing Page — cinematic minimal design
 *
 * Layout:
 * - Cinematic background image (always-on, dimmed)
 * - Centered hero: eyebrow → title → subtitle (story)
 * - Underline-style name input
 * - Arrow-text "미션 시작" button
 * - Top right: minimal Top 10 ranking widget
 */
const LandingPage = (() => {

  function render() {
    return `
      <div class="cinematic-bg" id="landing-bg" style="background-image: url('/assets/images/bg-phase1.jpg');"></div>

      <aside class="corner-rank" id="corner-rank">
        <div class="corner-rank__title">▣ MISSION RANKING</div>
        <div class="corner-rank__list" id="corner-rank-list">
          <div class="empty-state" style="padding:0.5rem 0;">로딩...</div>
        </div>
      </aside>

      <div class="cinema landing">
        <div class="cinema__inner">
          <img src="/assets/images/cosseogi.png" alt="코쓱이" class="landing__hero-img" onerror="this.style.display='none'">

          <div class="eyebrow eyebrow-amber landing__eyebrow">
            ▣ MISSION: ZERO NOISE
          </div>

          <h1 class="landing__title glitch-2">코쓱이의 비밀..?</h1>

          <p class="landing__subtitle">
            차세대통신 사업단의 양자 보안 시스템에 노이즈가 발생했습니다.<br>
            당신만이 코쓱이를 구할 수 있습니다.
          </p>

          <div class="landing__form">
            <div class="landing__form-prefix">요원명 (1~20자)</div>
            <input type="text" id="player-name-input" class="input-line" placeholder="요원명을 입력하세요" maxlength="20" autocomplete="off">

            <div class="landing__form-prefix landing__form-prefix--gap">학번 <span class="landing__form-note">(숫자만, 우수 참여자 확인용)</span></div>
            <input type="text" id="player-student-id-input" class="input-line" placeholder="예: 20231234" maxlength="10" autocomplete="off" inputmode="numeric" pattern="[0-9]*">

            <div class="landing__form-prefix landing__form-prefix--gap">전화번호 <span class="landing__form-note">(우수 참여자 보상 추첨용)</span></div>
            <input type="tel" id="player-phone-input" class="input-line" placeholder="010-1234-5678" maxlength="13" autocomplete="off" inputmode="tel">

            <label class="consent-row" for="consent-check">
              <input type="checkbox" id="consent-check" class="consent-row__box">
              <span class="consent-row__text">
                <strong>개인정보 수집·이용 동의 (필수)</strong>
                <span class="consent-row__detail">수집 항목: 요원명, 학번, 전화번호 / 목적: 우수 참여자 보상 추첨 및 안내 / 보유 기간: 행사 종료 후 1개월</span>
              </span>
            </label>

            <div id="name-error" class="error-msg" style="display:none;"></div>

            <div class="landing__cta">
              <button id="start-btn" class="btn-arrow btn-arrow--primary">미션 시작</button>
            </div>
          </div>

          <div class="landing__footer">
            배경: 생성형 AI(Gemini 2.5 Flash)로 제작됨
          </div>
        </div>

        <div class="deco-bottom-bar"></div>
      </div>
    `;
  }

  async function init() {
    try {
      const data = await ApiService.getTop10();
      const container = document.getElementById('corner-rank-list');
      if (container) {
        container.innerHTML = renderCornerRank(data.rankings);
      }
    } catch (err) {
      const container = document.getElementById('corner-rank-list');
      if (container) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.75rem;">기록 없음</div>';
      }
    }

    const startBtn = document.getElementById('start-btn');
    const nameInput = document.getElementById('player-name-input');
    const studentIdInput = document.getElementById('player-student-id-input');
    const phoneInput = document.getElementById('player-phone-input');
    const consentBox = document.getElementById('consent-check');
    const errorEl = document.getElementById('name-error');

    const submit = () => handleStart(nameInput, studentIdInput, phoneInput, consentBox, errorEl, startBtn);

    if (startBtn) {
      startBtn.addEventListener('click', submit);
    }

    [nameInput, studentIdInput, phoneInput].forEach(el => {
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      el.addEventListener('input', () => {
        errorEl.style.display = 'none';
      });
    });

    // 학번은 숫자만 허용
    if (studentIdInput) {
      studentIdInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      });
    }

    // 전화번호 자동 하이픈 포맷팅
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
        let formatted = digits;
        if (digits.length > 7) {
          formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
        } else if (digits.length > 3) {
          formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
        }
        e.target.value = formatted;
      });
    }

    if (consentBox) {
      consentBox.addEventListener('change', () => { errorEl.style.display = 'none'; });
    }

    if (nameInput) nameInput.focus();
  }

  function renderCornerRank(rankings) {
    if (!rankings || rankings.length === 0) {
      return '<div style="color:var(--text-muted);font-size:0.75rem;">기록 없음</div>';
    }
    let html = '';
    rankings.slice(0, 10).forEach(r => {
      const badgeClass = r.status === '성공' ? 'corner-rank__badge--success'
        : r.status === '포기' ? 'corner-rank__badge--quit' : '';
      const statusText = r.status === '성공' ? '구조' : r.status === '포기' ? '포기' : '시간';
      html += `
        <div class="corner-rank__item">
          <span class="corner-rank__rank">${r.rank}</span>
          <span class="corner-rank__name">${escapeHtml(r.playerName)}</span>
          <span class="corner-rank__badge ${badgeClass}">${statusText}</span>
          <span class="corner-rank__score">${r.score ?? 0}</span>
        </div>
      `;
    });
    html += `<div class="corner-rank__more"><a href="#ranking" class="btn-link" style="padding:0;">전체 →</a></div>`;
    return html;
  }

  async function handleStart(nameInput, studentIdInput, phoneInput, consentBox, errorEl, startBtn) {
    const name = nameInput.value.trim();
    const studentId = studentIdInput ? studentIdInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const consented = consentBox ? consentBox.checked : false;

    if (!name) {
      showError(errorEl, '요원명을 입력해주세요');
      nameInput.focus();
      return;
    }
    if (name.length > 20) {
      showError(errorEl, '요원명은 20자 이하로 입력해주세요');
      nameInput.focus();
      return;
    }
    if (!studentId) {
      showError(errorEl, '학번을 입력해주세요');
      studentIdInput && studentIdInput.focus();
      return;
    }
    if (!/^\d{6,10}$/.test(studentId)) {
      showError(errorEl, '학번은 숫자 6~10자리로 입력해주세요');
      studentIdInput && studentIdInput.focus();
      return;
    }
    if (!phone) {
      showError(errorEl, '전화번호를 입력해주세요 (보상 추첨용)');
      phoneInput && phoneInput.focus();
      return;
    }
    // 클라이언트 측 형식 체크 (서버에서도 검증)
    const phoneDigits = phone.replace(/\D/g, '');
    if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) {
      showError(errorEl, '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)');
      phoneInput && phoneInput.focus();
      return;
    }
    if (!consented) {
      showError(errorEl, '개인정보 수집·이용에 동의해주세요');
      consentBox && consentBox.focus();
      return;
    }

    // 서버 사전 중복 체크 — 중복이면 인트로로 넘어가지 않고 즉시 경고만 표시
    if (startBtn) { startBtn.disabled = true; }
    try {
      await ApiService.precheckPlayer(phone, studentId);
    } catch (err) {
      // 409/400 응답은 err.message에 서버 메시지가 담김
      showError(errorEl, err.message || '학번/전화번호 확인 중 오류가 발생했습니다');
      if (err.message && err.message.includes('학번')) {
        studentIdInput && studentIdInput.focus();
      } else if (err.message && err.message.includes('전화')) {
        phoneInput && phoneInput.focus();
      }
      if (startBtn) { startBtn.disabled = false; }
      return; // ⚠️ 인트로로 넘어가지 않음
    }
    if (startBtn) { startBtn.disabled = false; }

    // Defer createSession until intro confirm. Stash name/studentId/phone/consent.
    window.pendingPlayerName = name;
    window.pendingPlayerStudentId = studentId;
    window.pendingPlayerPhone = phone;
    window.pendingPlayerConsent = true;
    window.location.hash = '#intro';
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render, init };
})();
