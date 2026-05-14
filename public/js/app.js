/**
 * App.js - SPA Hash Router & App Initialization
 * Routes: #landing, #intro, #game, #result, #ranking
 */
const App = (() => {
  const appEl = document.getElementById('app');
  let currentPage = null;

  const routes = {
    landing: LandingPage,
    intro: IntroPage,
    game: GamePage,
    result: ResultPage,
    ranking: RankingPage
  };

  function getRoute() {
    const hash = window.location.hash.replace('#', '') || 'landing';
    return hash;
  }

  function navigate() {
    const route = getRoute();
    const page = routes[route];

    if (!page) {
      window.location.hash = '#landing';
      return;
    }

    // Destroy previous page if needed
    if (currentPage && currentPage.destroy) {
      currentPage.destroy();
    }

    // Render new page
    appEl.innerHTML = page.render();
    currentPage = page;

    // Initialize page
    if (page.init) {
      page.init();
    }
  }

  function init() {
    // Listen for hash changes
    window.addEventListener('hashchange', navigate);

    // Prevent back button during game
    window.addEventListener('popstate', (e) => {
      const route = getRoute();
      if (route === 'game' || (currentPage === GamePage && route !== 'result')) {
        // Push state back to prevent leaving game accidentally
        if (window.gameState && window.gameState.sessionId) {
          history.pushState(null, '', '#game');
        }
      }
    });

    // Push initial state for back button prevention
    history.pushState(null, '', window.location.href);

    // Initial route
    navigate();
  }

  return { init };
})();

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
