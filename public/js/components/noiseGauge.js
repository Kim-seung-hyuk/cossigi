/**
 * Noise Gauge Component - Visual progress bar showing Noise_Level
 */
const NoiseGauge = (() => {
  let currentLevel = 100;
  let fillElement = null;
  let labelElement = null;

  function getColorClass(level) {
    if (level === 0) return 'noise-clear';
    if (level <= 40) return 'noise-low';
    if (level <= 70) return 'noise-medium';
    return 'noise-high';
  }

  function getGlitchClass(level) {
    if (level === 0) return 'glitch-0';
    if (level <= 40) return 'glitch-1';
    if (level <= 70) return 'glitch-2';
    return 'glitch-3';
  }

  function render() {
    if (fillElement) {
      fillElement.style.width = currentLevel + '%';
      fillElement.className = 'noise-gauge__fill ' + getColorClass(currentLevel);
    }
    if (labelElement) {
      labelElement.textContent = currentLevel + '%';
    }
  }

  function setLevel(level) {
    currentLevel = Math.max(0, Math.min(100, level));
    render();
  }

  function getLevel() {
    return currentLevel;
  }

  function mount(container) {
    container.innerHTML = `
      <div class="noise-gauge">
        <div class="noise-gauge__bar">
          <div class="noise-gauge__fill noise-high" style="width: ${currentLevel}%"></div>
        </div>
        <div class="noise-gauge__label">
          <span>Noise Level</span>
          <span class="noise-gauge__level-text">${currentLevel}%</span>
        </div>
      </div>
    `;
    fillElement = container.querySelector('.noise-gauge__fill');
    labelElement = container.querySelector('.noise-gauge__level-text');
  }

  return { setLevel, getLevel, getGlitchClass, getColorClass, mount };
})();
