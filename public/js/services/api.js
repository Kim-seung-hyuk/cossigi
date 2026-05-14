/**
 * API Service - fetch wrappers for all backend endpoints
 */
const ApiService = (() => {
  const BASE_URL = '/api';

  async function request(url, options = {}) {
    try {
      const response = await fetch(BASE_URL + url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '요청 처리 중 오류가 발생했습니다');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
      }
      throw err;
    }
  }

  return {
    // Session APIs
    createSession(playerName, phone, studentId, consent) {
      return request('/sessions', {
        method: 'POST',
        body: JSON.stringify({ playerName, phone, studentId, consent })
      });
    },

    getSession(sessionId) {
      return request(`/sessions/${sessionId}`);
    },

    quitSession(sessionId) {
      return request(`/sessions/${sessionId}/quit`, {
        method: 'POST'
      });
    },

    // Message APIs
    sendMessage(sessionId, message) {
      return request(`/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
    },

    submitAnswer(sessionId, answer) {
      return request(`/sessions/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer })
      });
    },

    submitRebootCode(sessionId, code) {
      return request(`/sessions/${sessionId}/reboot`, {
        method: 'POST',
        body: JSON.stringify({ code })
      });
    },

    // Ranking APIs
    getTop10() {
      return request('/rankings/top10');
    },

    getAllRankings() {
      return request('/rankings');
    }
  };
})();
