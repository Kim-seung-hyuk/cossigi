/**
 * Chat Area Component — cinematic style (no bubbles)
 *
 * Cosseogi: avatar (left) + author label + body text
 * Player: right-aligned author label + text
 * System: thin amber line (or green/red variant) with centered text
 */
const ChatArea = (() => {
  let container = null;

  function getGlitchClass(noiseLevel) {
    return NoiseGauge.getGlitchClass(noiseLevel);
  }

  function avatarSrcForPhase(phase) {
    const safePhase = Math.min(Math.max(phase || 1, 1), 3);
    return `/assets/images/cosseogi-phase${safePhase}.png`;
  }

  function createMessageElement(msg, noiseLevel, phase) {
    if (msg.role === 'player') {
      const div = document.createElement('div');
      div.className = 'chat-msg-player';
      div.innerHTML = `
        <div class="chat-msg-player__author">YOU</div>
        <div class="chat-msg-player__text"></div>
      `;
      div.querySelector('.chat-msg-player__text').textContent = msg.content;
      return div;
    }

    if (msg.role === 'cosseogi') {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-msg-cosseogi';

      const avatar = document.createElement('img');
      avatar.className = 'chat-msg-cosseogi__avatar';
      avatar.alt = '코쓱이';
      avatar.src = avatarSrcForPhase(phase);
      avatar.onerror = () => {
        if (avatar.src.includes('cosseogi-phase')) {
          avatar.src = '/assets/images/cosseogi.png';
        } else {
          avatar.style.visibility = 'hidden';
        }
      };

      const body = document.createElement('div');
      body.className = 'chat-msg-cosseogi__body';

      const author = document.createElement('div');
      author.className = 'chat-msg-cosseogi__author';
      author.textContent = '▣ AI 코쓱이';

      const text = document.createElement('div');
      const glitchClass = getGlitchClass(noiseLevel);
      text.className = `chat-msg-cosseogi__text ${glitchClass}`;
      text.textContent = msg.content;

      body.appendChild(author);
      body.appendChild(text);
      wrapper.appendChild(avatar);
      wrapper.appendChild(body);
      return wrapper;
    }

    if (msg.role === 'system-success') {
      const div = document.createElement('div');
      div.className = 'chat-msg-system chat-msg-system--success';
      div.textContent = msg.content;
      return div;
    }

    if (msg.role === 'system-error') {
      const div = document.createElement('div');
      div.className = 'chat-msg-system chat-msg-system--error';
      div.textContent = msg.content;
      return div;
    }

    // generic system
    const div = document.createElement('div');
    div.className = 'chat-msg-system';
    div.textContent = msg.content;
    return div;
  }

  function addMessage(msg, noiseLevel, phase) {
    if (!container) return;
    const el = createMessageElement(msg, noiseLevel, phase);
    container.appendChild(el);
    scrollToBottom();
  }

  // Loading indicator intentionally suppressed — user prefers blank pause over a
  // repeating avatar+dots placeholder. The send button stays disabled while pending,
  // which is enough cue.
  function showLoading() { /* no-op */ }
  function hideLoading() { /* no-op */ }

  function scrollToBottom() {
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function renderMessages(messages, noiseLevel, phase) {
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(msg => {
      const el = createMessageElement(msg, noiseLevel, phase);
      container.appendChild(el);
    });
    scrollToBottom();
  }

  function mount(el) {
    container = el;
  }

  function clear() {
    if (container) container.innerHTML = '';
  }

  return { mount, addMessage, showLoading, hideLoading, renderMessages, scrollToBottom, clear };
})();
