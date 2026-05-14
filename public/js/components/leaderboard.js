/**
 * Leaderboard Component — minimal table style
 */
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

    let html = '<table class="minimal-table"><thead><tr>';
    html += '<th>#</th><th>이름</th><th>턴</th><th>시간</th><th>상태</th><th>점수</th>';
    html += '</tr></thead><tbody>';

    rankings.forEach(r => {
      html += `<tr>
        <td class="rank-num">${r.rank}</td>
        <td class="player-name">${escapeHtml(r.playerName)}</td>
        <td>${r.turnCount ?? '-'}</td>
        <td>${formatTime(r.elapsedSeconds)}</td>
        <td>${getStatusTag(r.status)}</td>
        <td class="score">${r.score ?? 0}</td>
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

  return { renderTable, formatTime, getStatusTag };
})();
