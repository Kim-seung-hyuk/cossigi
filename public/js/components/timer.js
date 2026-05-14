/**
 * Timer Component - 180-second countdown
 */
const TimerComponent = (() => {
  let intervalId = null;
  let remainingSeconds = 180;
  let onTimeoutCallback = null;
  let element = null;

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function render() {
    if (!element) return;
    element.textContent = formatTime(remainingSeconds);
    
    if (remainingSeconds <= 30) {
      element.classList.add('warning');
    } else {
      element.classList.remove('warning');
    }
  }

  function tick() {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      stop();
      render();
      if (onTimeoutCallback) onTimeoutCallback();
      return;
    }
    render();
  }

  function start(seconds, onTimeout) {
    stop();
    remainingSeconds = Math.max(0, Math.floor(seconds));
    onTimeoutCallback = onTimeout;
    render();
    intervalId = setInterval(tick, 1000);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function sync(serverRemainingSeconds) {
    remainingSeconds = Math.max(0, Math.floor(serverRemainingSeconds));
    render();
  }

  function mount(el) {
    element = el;
    render();
  }

  function getRemaining() {
    return remainingSeconds;
  }

  return { start, stop, sync, mount, getRemaining, formatTime };
})();
