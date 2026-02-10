import { SPARouter, showToast, createSpinner } from '../utils/utils.js';
import { loadLayout } from './layout.js';


// Helper to load page content
const loadPage = async (page) => {
  try {
    const url = `./pages/${page}.html`;
    console.log(`[SPA] Loading page: ${page} from ${url}`);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${page}: ${res.status} ${res.statusText}`);
    const text = await res.text();
    // Remove injected scripts (like live-server) to prevent rendering breakage
    return text
      .replace(/<!-- Code injected by live-server -->/g, "")
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
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
    view: () => loadPage('register')
  },
  {
    path: '*',
    view: () => loadPage('home') // Default fallback
  }
];

window.addEventListener("load", () => {
  loadLayout();
  // Initialize Router
  new SPARouter(routes);
});
