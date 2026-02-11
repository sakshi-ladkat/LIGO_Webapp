// Import utilities
import { SPARouter, showToast, createSpinner } from './utils/utils.js';
import { initializeApp } from './modules/app.js';

// Make utilities available globally
window.SPARouter = SPARouter;
window.showToast = showToast;
window.createSpinner = createSpinner;

// -------------------------
// App bootstrap (runs once)
// -------------------------
let appInitialized = false;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function startApp() {
    if (appInitialized) {
        console.log('[Main] App already initialized');
        return;
    }
    appInitialized = true;
    console.log('[Main] Starting application...');
    initializeApp(SPARouter);
}

// ----------------------------------
// Registration lifecycle (SPA-safe)
// ----------------------------------
let registrationInitialized = false;
let registrationScriptPromise = null;

/**
 * Called after register.html is mounted into DOM
 * Ensures dropdown APIs are called only once per mount
 */
function initRegistration() {
    if (registrationInitialized) {
        console.log('[Register] Already initialized, skipping');
        return;
    }

    registrationInitialized = true;
    console.log('[Register] Initializing registration page');

    if (typeof loadInstitutes === 'function') loadInstitutes();
    if (typeof loadContinents === 'function') loadContinents();
    if (typeof checkURLParams === 'function') checkURLParams();
    if (typeof setupAutoSave === 'function') setupAutoSave();

    // Delay draft load to ensure DOM is fully painted
    setTimeout(() => {
        if (typeof loadDraft === 'function') loadDraft();
    }, 300);
}

/**
 * Called by SPA router when register page is mounted
 * Loads registration.js only once and initializes page safely
 */
function multiStepRegisterMount() {
    console.log('[Register] multiStepRegisterMount called');

    // Load script only once using Promise lock
    if (!registrationScriptPromise) {
        registrationScriptPromise = new Promise((resolve, reject) => {
            console.log('[Register] Loading registration.js...');

            const script = document.createElement('script');
            script.src = './assets/js/modules/registration.js';
            script.defer = true;

            script.onload = () => {
                console.log('[Register] registration.js loaded');
                resolve();
            };

            script.onerror = () => {
                console.error('[Register] Failed to load registration.js');
                registrationScriptPromise = null;
                reject();
            };

            document.head.appendChild(script);
        });
    }

    // Initialize after script is ready
    registrationScriptPromise.then(() => {
        initRegistration();
    });
}

/**
 * Called by router when navigating away from register page
 * Allows re-initialization when user comes back
 */
function resetRegistrationState() {
    console.log('[Register] Resetting registration state');
    registrationInitialized = false;
}

window.multiStepRegisterMount = multiStepRegisterMount;
window.resetRegistrationState = resetRegistrationState;

// ----------------------------------
// Page CSS loader
// ----------------------------------
function loadPageCSS(pageName) {
    const cssMap = {
        home: './assets/css/pages/home.css',
        register: './assets/css/pages/register.css',
        login: './assets/css/pages/login.css'
    };

    const cssPath = cssMap[pageName];
    if (!cssPath) return;

    if (document.querySelector(`link[href="${cssPath}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssPath;
    document.head.appendChild(link);
}

window.loadPageCSS = loadPageCSS;

// ----------------------------------
// Safety guards (SPA friendly)
// ----------------------------------
document.addEventListener('submit', (e) => {
    e.preventDefault();
    console.warn('[Main] Form submission blocked (SPA mode)');
});

window.addEventListener('error', (e) => {
    console.error('[Main] Global error:', e.error);
    e.preventDefault();
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Main] Unhandled promise rejection:', e.reason);
    e.preventDefault();
});
