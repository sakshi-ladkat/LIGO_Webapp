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

    // Call the module's mount function which handles all initialization
    // At this point, registration.js is loaded, so window.multiStepRegisterMount 
    // should be the function from the module, not the loader from main.js
    if (typeof window.multiStepRegisterMount === 'function') {
        // We need to bypass the circuit breaker or ensure we don't trip it if we act as a proxy.
        // But since this is the "real" init, we just call it.
        // WARNING: If window.multiStepRegisterMount is STILL this loader function, we get a loop.
        // We can check if it's the native function or our wrapper by checking a property or name, 
        // but simpler is to assume registration.js overwrites it.

        // However, to be safe, we can call the specific functions directly if exposed, 
        // OR rely on the fact that registration.js overwrites the global.

        // Let's call the individual functions to be safe and avoid recursion risk
        if (typeof window.loadInstitutes === 'function') window.loadInstitutes();
        if (typeof window.loadContinents === 'function') window.loadContinents();
        if (typeof window.checkURLParams === 'function') window.checkURLParams();
        if (typeof window.initializeAutoSave === 'function') window.initializeAutoSave();
    }

    // Delay draft load to ensure DOM is fully painted
    setTimeout(() => {
        if (typeof window.getDraft === 'function' && window.verifiedEmail) {
            window.getDraft(window.verifiedEmail);
        }
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
