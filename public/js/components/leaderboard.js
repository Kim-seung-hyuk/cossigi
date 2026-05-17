/**
 * Leaderboard Component — minimal table style
 *
 * 시상 기준:
 *  - 1~3등  → 1등상 (gold, 등수별 화려도 다름: #1=왕관, #2=메달, #3=메달)
 *  - 4~30등 → 2등상 (silver)
 *  - 31등~  → 시상 없음
 *  자격: status !== '포기' AND score > 0 (시간초과도 시상 대상 포함)
 *  정렬: 성공 → 시간초과 → 포기 (server/models/session.js getRankedSessions)
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

  function isPrizeEligible(status, score) {
    if (status === '포기') return false;
    if (!score || score <= 0) return false;
    return true; // 성공 / 시간초과 (score > 0)
  }

  function getPrizeTier(rank, status, score) {
    if (!isPrizeEligible(status, score)) return null;
    if (rank === 1) return 'gold-1';
    if (rank === 2) return 'gold-2';
    if (rank === 3) return 'gold-3';
    if (rank <= PRIZE_SILVER_MAX) return 'silver';
    return null;
  }

  function getPrizeTag(tier) {
    if (tier === 'gold-1') return '<span class="prize-tag prize-tag--gold prize-tag--gold-1"><span class="prize-tag__icon">👑</span> 1등상</span>';
    if (tier === 'gold-2') return '<span class="prize-tag prize-tag--gold prize-tag--gold-2"><span class="prize-tag__icon">🥈</span> 1등상</span>';
    if (tier === 'gold-3') return '<span class="prize-tag prize-tag--gold prize-tag--gold-3"><span class="prize-tag__icon">🥉</span> 1등상</span>';
    if (tier === 'silver')  return '<span class="prize-tag prize-tag--silver"><span class="prize-tag__icon">🎁</span> 2등상</span>';
    return '<span class="prize-tag prize-tag--none">—</span>';
  }

  function getRankDisplay(rank, tier) {
    // Top 3는 왕관·메달 아이콘으로, 그 외는 숫자만
    if (tier === 'gold-1') return '<span class="rank-medal rank-medal--gold-1">👑</span><span class="rank-num-text">1</span>';
    if (tier === 'gold-2') return '<span class="rank-medal rank-medal--gold-2">🥈</span><span class="rank-num-text">2</span>';
    if (tier === 'gold-3') return '<span class="rank-medal rank-medal--gold-3">🥉</span><span class="rank-num-text">3</span>';
    return `<span class="rank-num-text">${rank}</span>`;
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
      <span class="prize-tag prize-tag--gold prize-tag--gold-1"><span class="prize-tag__icon">👑</span> 1등상</span> 1~3등 &nbsp;·&nbsp;
      <span class="prize-tag prize-tag--silver"><span class="prize-tag__icon">🎁</span> 2등상</span> 4~30등 &nbsp;·&nbsp;
      <span class="prize-legend__note">시간초과도 시상 대상 (포기·0점 제외)</span>
    </div>`;

    html += '<table class="minimal-table minimal-table--prizes"><thead><tr>';
    html += '<th>#</th><th>이름</th><th>턴</th><th>시간</th><th>상태</th><th>점수</th><th>상품</th>';
    html += '</tr></thead><tbody>';

    rankings.forEach(r => {
      const tier = getPrizeTier(r.rank, r.status, r.score);
      const rowClass = tier ? `prize-row prize-row--${tier}` : '';
      html += `<tr class="${rowClass}">
        <td class="rank-num">${getRankDisplay(r.rank, tier)}</td>
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
