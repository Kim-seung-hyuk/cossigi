/**
 * Leaderboard Component — minimal table style
 *
 * 시상 기준 (성공자 한정):
 *  - 1~3등  → 1등상 (gold)
 *  - 4~30등 → 2등상 (silver)
 *  - 31등~  → 시상 없음
 *  - 시간초과/포기 → 시상 없음 (랭킹 위치와 무관)
 */
const PRIZE_TOP = 3;
const PRIZE_SILVER_MAX = 30;

const Leaderboard = (() => {

  function getStatusTag(status) {
    switch (status) {
      case '성공':
        return '<span class="status-tag status-tag--success">성공</span>';
      case '시간초과':
        return '<span class="status-tag status-tag--timeout">시간초과</span>';
      case '포기':
        return '<span class="status-tag status-tag--quit">포기</span>';
      default:
        return '<span class="status-tag">' + status + '</span>';
    }
  }

  function getPrizeTier(rank, status) {
    if (status !== '성공') return null;
    if (rank <= PRIZE_TOP) return 'gold';
    if (rank <= PRIZE_SILVER_MAX) return 'silver';
    return null;
  }

  function getPrizeTag(tier) {
    if (tier === 'gold')   return '<span class="prize-tag prize-tag--gold">🏆 1등상</span>';
    if (tier === 'silver') return '<span class="prize-tag prize-tag--silver">🎁 2등상</span>';
    return '<span class="prize-tag prize-tag--none">—</span>';
  }

  function formatTime(seconds) {
    if (seconds == null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function renderTable(rankings) {
    if (!rankings || rankings.length === 0) {
      return '<div class="empty-state">아직 도전한 참가자가 없습니다</div>';
    }

    let html = '';
    // 시상 안내 헤더 (랭킹 페이지 상단)
    html += `<div class="prize-legend">
      <span class="prize-tag prize-tag--gold">🏆 1등상</span> 1~3등 &nbsp;·&nbsp;
      <span class="prize-tag prize-tag--silver">🎁 2등상</span> 4~30등 &nbsp;·&nbsp;
      <span class="prize-legend__note">성공한 도전자만 시상</span>
    </div>`;

    html += '<table class="minimal-table"><thead><tr>';
    html += '<th>#</th><th>이름</th><th>턴</th><th>시간</th><th>상태</th><th>점수</th><th>상품</th>';
    html += '</tr></thead><tbody>';

    rankings.forEach(r => {
      const tier = getPrizeTier(r.rank, r.status);
      const rowClass = tier ? `prize-row prize-row--${tier}` : '';
      html += `<tr class="${rowClass}">
        <td class="rank-num">${r.rank}</td>
        <td class="player-name">${escapeHtml(r.playerName)}</td>
        <td>${r.turnCount ?? '-'}</td>
        <td>${formatTime(r.elapsedSeconds)}</td>
        <td>${getStatusTag(r.status)}</td>
        <td class="score">${r.score ?? 0}</td>
        <td>${getPrizeTag(tier)}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    return html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { renderTable, formatTime, getStatusTag, getPrizeTier };
})();
