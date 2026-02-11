console.log('[Init] registration-init.js LOADED (Fixed v5)');

let registrationInitialized = false;
let registrationScriptLoaded = false;
let lastMountTime = 0;

function initRegistration() {
    console.log('[Init] Checking registration init requirements...');

    // 1. Check if we have already initialized in this session/mount
    if (registrationInitialized) {
        console.log('[Init] Already marked initialized (Local Guard)');
        return;
    }

    // 2. Check if DOM elements are present
    const instSelect = document.getElementById('institute');
    if (!instSelect) {
        console.log('[Init] DOM elements not ready yet. Retrying in 100ms...');
        setTimeout(initRegistration, 100);
        return;
    }

    // 3. Check if data is already populated (Prevent double fetch)
    const contSelect = document.getElementById('continent');
    const isInstPopulated = instSelect && instSelect.options.length > 1;
    const isContPopulated = contSelect && contSelect.options.length > 1;

    if (isInstPopulated || isContPopulated) {
        console.log('[Init] Dropdowns already populated. Marking done.');
        registrationInitialized = true;
        return;
    }

    // 4. Proceed with initialization
    registrationInitialized = true;
    console.log('[Init] Starting data fetch...');

    if (typeof window.loadInstitutes === 'function') window.loadInstitutes();
    if (typeof window.loadContinents === 'function') window.loadContinents();
}

function multiStepRegisterMount() {
    console.log('[Init] multiStepRegisterMount called');

    // Hard Debounce: Prevent executing mount logic if called within 5 seconds
    const now = Date.now();
    if (now - lastMountTime < 5000) {
        console.warn('[Init] Mount called too rapidly (Potential Loop). Ignoring.');
        return;
    }
    lastMountTime = now;

    // Reset local flag because we are mounting a FRESH view
    registrationInitialized = false;

    // Remove strict reset of internal registration flags to prevent clearing cache
    // if (typeof window.resetRegistrationData === 'function') {
    //     window.resetRegistrationData();
    // }

    // Remove any strict global guards if they exist from previous attempts
    if (window.__REGISTRATION_INITIALIZED__) delete window.__REGISTRATION_INITIALIZED__;

    // If script is loaded and functions exist, init immediately
    if ((registrationScriptLoaded || typeof window.loadInstitutes === 'function')) {
        console.log('[Init] Script ready, calling init');
        initRegistration();
        return;
    }

    // Check if script tag exists in DOM (but might be old version?)
    // We try to find OUR specific script tag
    const existingScript = document.querySelector('script[src*="modules/registration.js"]');

    if (existingScript) {
        console.log('[Init] Script tag found in DOM');
        registrationScriptLoaded = true;
        setTimeout(initRegistration, 100);
        return;
    }

    console.log('[Init] Injecting registration.js...');
    const script = document.createElement('script');
    // Remove cache busting to allow browser caching
    script.src = `./assets/js/modules/registration.js`;

    script.onload = () => {
        console.log('[Init] Script loaded callback');
        registrationScriptLoaded = true;
        initRegistration();
    };

    script.onerror = () => {
        console.error('[Init] Failed to load registration.js');
    };

    document.head.appendChild(script);
}

window.multiStepRegisterMount = multiStepRegisterMount;
