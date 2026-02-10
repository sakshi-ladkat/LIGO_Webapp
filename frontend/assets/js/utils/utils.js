/**
 * SPARouter
 * Handles hash-based client-side routing with optional dynamic params
 */
export class SPARouter {
    constructor(routes, rootId = 'content') {
        this.routes = routes;        // array of route objects { path, view, onMount }
        this.root = document.getElementById(rootId);
        this.currentRoute = null;

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Listen for link clicks with data-link
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                const href = e.target.getAttribute('href');
                window.location.hash = href.replace('#', '');
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
        await this.renderView(route, params);
    }

    async renderView(route, params) {
        // Show loading spinner first
        this.root.innerHTML = createSpinner();

        let html = '';
        if (typeof route.view === 'function') html = await route.view(params);
        else html = route.view;

        // Insert HTML
        this.root.innerHTML = html;

        // Call onMount if exists
        if (route.onMount) route.onMount(params);
    }

    getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) result[key] = value;
        return result;
    }
}

/**
 * Show toast notification
 * type: 'info' | 'success' | 'error' | 'warning'
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');

    // Create container if not exists
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.background = '#333';
    toast.style.color = 'white';
    toast.style.padding = '10px 15px';
    toast.style.marginTop = '10px';
    toast.style.borderRadius = '5px';
    toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';

    toast.textContent = message;
    container.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => toast.style.opacity = '1');

    // Auto-remove after 4s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Create loading spinner HTML
 */
export function createSpinner() {
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
