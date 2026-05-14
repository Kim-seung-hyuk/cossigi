/**
 * Ranking Page — cinematic minimal design
 *
 * Layout:
 * - Cinematic background
 * - Centered title + subtitle
 * - Minimal table (no card, thin lines, hover highlight)
 * - Top left: "← 홈으로" link
 */
const RankingPage = (() => {

  function render() {
    return `
      <div class="cinematic-bg" style="background-image: url('/assets/images/bg-phase3.jpg');"></div>

      <div class="ranking__back">
        <a href="#landing" class="btn-link">← 홈으로</a>
      </div>

      <div class="cinema ranking">
        <div class="cinema__inner cinema__inner--wide">
          <h1 class="ranking__title">전체 랭킹</h1>
          <div class="ranking__subtitle">▣ MISSION RECORDS</div>

          <div id="ranking-table">
            <div class="empty-state">로딩 중...</div>
          </div>
        </div>
      </div>
    `;
  }

  async function init() {
    try {
      const data = await ApiService.getAllRankings();
      const container = document.getElementById('ranking-table');
      if (container) {
        container.innerHTML = Leaderboard.renderTable(data.rankings);
      }
    } catch (err) {
      const container = document.getElementById('ranking-table');
      if (container) {
        container.innerHTML = '<div class="empty-state">랭킹을 불러올 수 없습니다.</div>';
      }
    }
  }

  return { render, init };
})();
