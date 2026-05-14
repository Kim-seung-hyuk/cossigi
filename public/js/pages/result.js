/**
 * Result Page — cinematic minimal design
 *
 * Layout:
 * - Cinematic background (success → bg-success, else bg-phase3)
 * - Large headline: MISSION SUCCESS / FAILED / TIMEOUT
 * - Stat rows (thin lines)
 * - Benefits list (numbered, bordered rows)
 * - Arrow-text actions
 */
const ResultPage = (() => {

  function render() {
    const result = window.gameResult || {};
    const status = result.status || '시간초과';
    const score = result.score != null ? result.score : 0;
    const elapsed = result.elapsedSeconds || 0;
    const turns = result.turnCount || 0;

    const isSuccess = status === '성공';
    const titleClass = isSuccess ? 'result__title--success'
      : status === '시간초과' ? 'result__title--timeout' : 'result__title--fail';
    const titleText = isSuccess ? 'MISSION SUCCESS'
      : status === '시간초과' ? 'MISSION TIMEOUT' : 'MISSION ABORTED';
    const subtitleText = isSuccess ? '시스템 정상 복구 완료'
      : status === '시간초과' ? '제한 시간 초과 — 노이즈 제거 실패' : '미션 포기 — 시스템 잠김 상태 유지';

    const bgImage = isSuccess ? '/assets/images/bg-success.jpg' : '/assets/images/bg-phase3.jpg';

    return `
      <div class="cinematic-bg" style="background-image: url('${bgImage}');"></div>

      <div class="cinema result">
        <div class="cinema__inner">
          <div class="eyebrow ${isSuccess ? 'eyebrow-amber' : 'eyebrow-red'} result__eyebrow">
            ${isSuccess ? 'SYSTEM ONLINE' : 'EMERGENCY BROADCAST'}
          </div>

          <h1 class="result__title ${titleClass}">${titleText}</h1>
          <div class="result__subtitle">${subtitleText}</div>

          <div class="result__stats">
            <div class="stat-row stat-row--amber">
              <span class="stat-row__label">점수</span>
              <span class="stat-row__value">${score}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row__label">턴 수</span>
              <span class="stat-row__value">${turns}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row__label">소요 시간</span>
              <span class="stat-row__value">${formatElapsed(elapsed)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row__label">상태</span>
              <span class="stat-row__value">
                <span class="status-tag ${getStatusTag(status)}">${status}</span>
              </span>
            </div>
          </div>

          <div class="result__benefits">
            <div class="result__benefits-title">▣ AWS 양자통신융합전공 이수자 혜택</div>
            <div class="result__benefit-item"><span class="result__benefit-num">01</span><span class="result__benefit-text">학위증에 AWS 양자통신융합전공 취득사항 기재</span></div>
            <div class="result__benefit-item"><span class="result__benefit-num">02</span><span class="result__benefit-text">AWS 파트너사 인턴십 프로그램 연계</span></div>
            <div class="result__benefit-item"><span class="result__benefit-num">03</span><span class="result__benefit-text">JOB Fair 진행 (AWS 파트너사 및 고객사 참여)</span></div>
            <div class="result__benefit-item"><span class="result__benefit-num">04</span><span class="result__benefit-text">연 2회 AWS 직무 멘토링</span></div>
            <div class="result__benefit-item"><span class="result__benefit-num">05</span><span class="result__benefit-text">우수 학생 대상 AWS 공식 행사 초대</span></div>
            <div class="result__benefit-item"><span class="result__benefit-num">06</span><span class="result__benefit-text">AWS 리쿠르팅 팀 방문</span></div>
          </div>

          <div class="result__actions">
            <a href="#ranking" class="btn-arrow">랭킹 보기</a>
            <a href="#landing" class="btn-arrow btn-arrow--primary" id="restart-btn">다시 시작</a>
          </div>
        </div>
      </div>
    `;
  }

  function init() {
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        window.gameState = null;
        window.gameResult = null;
      });
    }
  }

  function getStatusTag(status) {
    switch (status) {
      case '성공': return 'status-tag--success';
      case '시간초과': return 'status-tag--timeout';
      case '포기': return 'status-tag--quit';
      default: return '';
    }
  }

  function formatElapsed(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return { render, init };
})();
