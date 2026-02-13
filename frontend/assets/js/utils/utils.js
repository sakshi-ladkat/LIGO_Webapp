/**
 * SPARouter
 * Handles hash-based client-side routing with optional dynamic params
 */
class SPARouter {
    constructor(routes, rootId = 'content') {
        if (window._spaRouterInstance) {
            console.warn('[SPARouter] Instance already exists. Using existing instance.');
            return window._spaRouterInstance;
        }
        window._spaRouterInstance = this;

        this.routes = routes;        // array of route objects { path, view, onMount }
        this.root = document.getElementById(rootId);
        this.currentRoute = null;
        this.isNavigating = false;

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Listen for link clicks with data-link
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                const newHash = href.replace('#', '');
                if (window.location.hash.slice(1) !== newHash) {
                    window.location.hash = newHash;
                }
            }
        });

        // Handle initial load
        this.handleRoute();
    }

    getCurrentPath() {
        const hash = window.location.hash.slice(1) || '/';
        return hash.split('?')[0];
    }

    navigate(path) {
        window.location.hash = path;
    }

    async handleRoute() {
        const path = this.getCurrentPath();

        console.log('[SPARouter] Handling route:', path);

        // Prevent recursive loop and re-rendering the same route
        if (this.isNavigating) {
            console.warn('[SPARouter] Navigation already in progress, skipping:', path);
            return;
        }

        if (this.currentRoute && this.currentRoute.path === path) {
            console.log('[SPARouter] Already on this route, skipping...');
            return;
        }

        this.isNavigating = true;

        // Reset mount flags for all routes when changing route
        this.routes.forEach(r => {
            if (r._mountCalled) {
                r._mountCalled = false;
            }
        });

        // Find matching route
        let route = this.routes.find(r => {
            if (r.path === path) return true;

            // Dynamic route matching /user/:id
            const routeParts = r.path.split('/');
            const pathParts = path.split('/');
            if (routeParts.length !== pathParts.length) return false;
            return routeParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);
        });

        // 404 fallback
        if (!route) {
            route = { path: '*', view: () => '<h1>404 - Page Not Found</h1>' };
        }

        // Extract dynamic params
        const params = {};
        if (route.path.includes(':')) {
            const routeParts = route.path.split('/');
            const pathParts = path.split('/');
            routeParts.forEach((part, i) => {
                if (part.startsWith(':')) params[part.slice(1)] = pathParts[i];
            });
        }

        this.currentRoute = { ...route, params, path };

        // Render view
        try {
            await this.renderView(route, params);
        } catch (e) {
            console.error('[SPARouter] Render view failed:', e);
            this.root.innerHTML = `<div class="error">Failed to load view</div>`;
        } finally {
            this.isNavigating = false;
        }
    }

    async renderView(route, params) {
        console.log('[SPARouter] Rendering view for:', route.path);

        // Show loading spinner first
        this.root.innerHTML = createSpinner();
        console.log('[SPARouter] Spinner shown, fetching view...');

        let html = '';
        if (typeof route.view === 'function') html = await route.view(params);
        else html = route.view;

        console.log('[SPARouter] View fetched, HTML length:', html.length);

        // Insert HTML
        this.root.innerHTML = html;
        console.log('[SPARouter] HTML inserted into DOM');

        // Call onMount if exists (only once per route change)
        if (route.onMount && !route._mountCalled) {
            console.log('[SPARouter] Calling onMount for:', route.path);
            route._mountCalled = true;

            // Wait for DOM to be fully repainted/ready
            requestAnimationFrame(() => {
                route.onMount(params);
                console.log('[SPARouter] onMount completed');
            });

        } else if (route._mountCalled) {
            console.log('[SPARouter] onMount already called, skipping');
        }
    }

    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) result[key] = value;
        return result;
    }
}

// Expose SPARouter to window
window.SPARouter = SPARouter;

/**
 * Show toast notification
 * type: 'info' | 'success' | 'error' | 'warning'
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');

    // Create container if not exists
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px'; // "Right Check" / Top Right
        container.style.zIndex = '99999'; // Higher Z-index
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Sober / Standard Colors
    let bgColor = '#333';
    let textColor = 'white';

    if (type === 'success') bgColor = '#10b981'; // Green
    if (type === 'error') bgColor = '#ef4444';   // Red
    if (type === 'warning') { bgColor = '#f59e0b'; textColor = 'black'; } // Amber

    toast.style.background = bgColor;
    toast.style.color = textColor;
    toast.style.padding = '12px 20px';
    toast.style.marginTop = '10px';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontFamily = 'Inter, sans-serif';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s ease-out';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';

    // Add "Right Check" / Icon
    let icon = '';
    if (type === 'success') icon = '✓ ';
    if (type === 'error') icon = '✕ ';
    if (type === 'warning') icon = '⚠ ';

    toast.textContent = icon + message;

    container.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 50);
    });

    // Auto-remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Create loading spinner HTML
 */
function createSpinner() {
    return `
    <div class="loading-screen" style="
        display:flex;
        justify-content:center;
        align-items:center;
        height:100%;
    ">
        <div class="spinner" style="
            width:40px;
            height:40px;
            border:5px solid #f3f3f3;
            border-top:5px solid #007bff;
            border-radius:50%;
            animation: spin 1s linear infinite;
        "></div>
    </div>
    <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
    `;
}


// Expose utility functions
window.showToast = showToast;
window.createSpinner = createSpinner;

/**
 * Load page-specific CSS
 */
window.loadPageCSS = function (pageName) {
    const cssMap = {
        home: './assets/css/pages/home.css',
        register: './assets/css/pages/register.css',
        login: './assets/css/pages/login.css'
    };

    const cssPath = cssMap[pageName] || `./assets/css/pages/${pageName}.css`;
    if (!cssPath) return;

    if (document.querySelector(`link[href="${cssPath}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssPath;
    document.head.appendChild(link);
    console.log(`[CSS] Loaded ${cssPath}`);
};

// ----------------------------------
// Safety guards (SPA friendly)
// ----------------------------------
document.addEventListener('submit', (e) => {
    // Only block if not already handled
    if (!e.defaultPrevented) {
        e.preventDefault();
        console.warn('[Main] Form submission blocked (SPA mode)');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Main] Unhandled promise rejection:', e.reason);
});
