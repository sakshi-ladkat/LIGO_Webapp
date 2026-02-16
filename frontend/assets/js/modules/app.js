// Helper to load page content
const loadPage = async (page) => {
  try {
    const url = `./pages/${page}.html`;
    console.log(`[SPA] Loading page: ${page} from ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[SPA] Fetch failed:`, res.status, res.statusText);
      throw new Error(`Failed to load ${page}: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    console.log(`[SPA] Page loaded successfully, length: ${text.length} chars`);

    // Load page-specific CSS
    if (typeof window.loadPageCSS === 'function') {
      console.log(`[SPA] Loading CSS for page: ${page}`);
      window.loadPageCSS(page);
    } else {
      console.warn('[SPA] loadPageCSS function not available');
    }

    // Remove injected scripts (like live-server) to prevent rendering breakage
    const cleanedText = text
      .replace(/<!-- Code injected by live-server -->/g, "")
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

    console.log(`[SPA] Returning cleaned HTML for ${page}`);
    return cleanedText;
  } catch (error) {
    console.error(`[SPA] Error loading page ${page}:`, error);
    return `<div class="container text-center" style="padding: 50px;">
            <h3>Failed to load content</h3>
            <p class="text-danger">${error.message}</p>
            <p class="text-muted small">Check console for details.</p>
        </div>`;
  }
};

const routes = [
  {
    path: '/',
    view: () => loadPage('home')
  },
  {
    path: '/login',
    view: () => loadPage('login')
  },
  {
    path: '/multi-step-register',
    view: () => loadPage('register'),
    onMount: () => {
      // Initialize registration when the page is mounted
      if (typeof window.multiStepRegisterMount === 'function') {
        window.multiStepRegisterMount();
      }
    }
  },
  {
    path: '/setup-password',
    view: () => loadPage('setup-password'),
    onMount: async () => {
      // Dynamic import for code splitting
      const module = await import('./setup-password.js');
      if (module && typeof module.mountSetupPassword === 'function') {
        module.mountSetupPassword();
      }
    }
  },
  {
    path: '*',
    view: () => loadPage('home') // Default fallback
  }
];

// Guard to prevent multiple initializations
let appInitialized = false;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}

function initializeApp() {
  if (appInitialized) {
    console.log('[App] Already initialized, skipping...');
    return;
  }

  appInitialized = true;
  console.log('[App] Initializing application...');

  if (typeof window.loadLayout === 'function') {
    window.loadLayout();
  }

  // Initialize Router (SPARouter is now available from utils.js)
  if (typeof window.SPARouter === 'function') {
    new window.SPARouter(routes);
  } else {
    console.error('[App] SPARouter not available!');
  }
}
