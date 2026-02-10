function initRegistration() {
    if (typeof loadInstitutes === 'function') loadInstitutes();
    if (typeof loadContinents === 'function') loadContinents();
    if (typeof checkURLParams === 'function') checkURLParams();
    if (typeof setupAutoSave === 'function') setupAutoSave();

    // Load draft after a short delay to ensure form is ready
    setTimeout(() => {
        if (typeof loadDraft === 'function') loadDraft();
    }, 500);
}

function multiStepRegisterMount() {

    // If already loaded, just initialize
    if (typeof loadInstitutes === 'function') {
        initRegistration();
        return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src="./assets/js/registration.js"]');

    if (!existingScript) {
        const script = document.createElement('script');
        script.src = './assets/js/registration.js';

        script.onload = function () {
            initRegistration();
        };

        script.onerror = function () {
            console.error('Failed to load registration.js');
        };

        document.head.appendChild(script);
    } else {
        // Script exists but may not be ready yet
        setTimeout(() => {
            initRegistration();
        }, 200);
    }
}
