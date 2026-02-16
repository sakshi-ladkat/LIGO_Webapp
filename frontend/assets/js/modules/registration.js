// Imports utils from the registration-utils 
import {
    FIELD_MAP,
    getFieldId,
    validateEmail,
    validateField,
    showFieldError,
    hideFieldError,
    showError
} from '../utils/registrationutils.js';


/* -------------------------------------
      Global Sate and constants 
   ------------------------------------- */

let verificationToken = null;
let verifiedEmail = null;

// Use window.registrationCurrentStep to ensure consistency
window.registrationCurrentStep = window.registrationCurrentStep || 1;
const totalSteps = 5;

// Cache for reference data
let cachedInstitutes = null;
let cachedContinents = null;
let isFetchingInstitutes = false;
let isFetchingContinents = false;

// Abort controllers for API requests
let continentsAbortController = null;
let countriesAbortController = null;

// Use window.isProgrammaticChange to ensure consistency across all functions
window.isProgrammaticChange = false;

/* -------------------------------------
       sessionStorage Keys  
   ------------------------------------- */
export const STORAGE = {
    FORM: 'registration_form_data',
    STEP: 'registration_current_step',
    TOKEN: 'registration_verification_token',
    EMAIL: 'registration_verified_email',
    VERIFIED_STATUS: 'registration_verified_status',
    VERIFIED_TIMESTAMP: 'registration_verified_timestamp',
};

/* -------------------------------------
     Save form data to sessionStorage
   ------------------------------------- */
function saveFormData() {
    const formData = {};

    Object.keys(FIELD_MAP).forEach((backendKey) => {
        const fieldId = getFieldId(backendKey);
        const el = document.getElementById(fieldId);

        formData[backendKey] = el?.value || '';
    });

    sessionStorage.setItem(STORAGE.FORM, JSON.stringify(formData));

    // Safeguard: Don't save a lower step than what's already saved
    // This prevents going backwards if saveFormData is called during page reload
    const existingSavedStep = sessionStorage.getItem(STORAGE.STEP);
    const existingStep = existingSavedStep ? parseInt(existingSavedStep, 10) : 1;
    const currentStep = window.registrationCurrentStep || 1;

    if (currentStep >= existingStep) {
        sessionStorage.setItem(STORAGE.STEP, currentStep.toString());
    } else {
        console.log(`[saveFormData] Not saving step ${currentStep} (existing: ${existingStep})`);
    }

    if (verificationToken) {
        sessionStorage.setItem(STORAGE.TOKEN, verificationToken);
    }
    if (verifiedEmail) {
        sessionStorage.setItem(STORAGE.EMAIL, verifiedEmail);
        sessionStorage.setItem(STORAGE.VERIFIED_STATUS, 'true');
        // Only set timestamp if not already set, to preserve original verification time
        if (!sessionStorage.getItem(STORAGE.VERIFIED_TIMESTAMP)) {
            sessionStorage.setItem(STORAGE.VERIFIED_TIMESTAMP, new Date().toISOString());
        }
    }
}



/* -------------------------------------
     restore form data from sessionStorage
   ------------------------------------- */
async function restoreFormData(skipStepRestore = false) {
    const savedData = sessionStorage.getItem(STORAGE.FORM);
    const savedStep = sessionStorage.getItem(STORAGE.STEP);
    const savedToken = sessionStorage.getItem(STORAGE.TOKEN);
    const savedEmail = sessionStorage.getItem(STORAGE.EMAIL);
    const savedStatus = sessionStorage.getItem(STORAGE.VERIFIED_STATUS);
    const savedTimestamp = sessionStorage.getItem(STORAGE.VERIFIED_TIMESTAMP);

    if (savedToken && savedEmail) {
        verificationToken = savedToken;
        verifiedEmail = savedEmail;

        // If verified, ensure UI reflects it even if we are on step 3
        if (savedStatus === 'true') {
            const emailInput = document.getElementById('email');
            const verifiedEmailInput = document.getElementById('verifiedEmail');
            const emailVerifiedDiv = document.getElementById('emailVerified');
            const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
            const nextBtn = document.getElementById('emailNextBtn');

            if (emailInput) {
                emailInput.value = verifiedEmail;
                emailInput.readOnly = true;
            }

            if (verifiedEmailInput) {
                verifiedEmailInput.value = verifiedEmail;
                verifiedEmailInput.readOnly = true;
            }

            if (emailNotVerifiedDiv) {
                emailNotVerifiedDiv.style.display = 'none';
            }
            if (emailVerifiedDiv) {
                emailVerifiedDiv.style.display = 'block';
                // Optional: Show timestamp
                if (savedTimestamp) {
                    // Can add a timestamp display here if needed
                }
            }
            if (nextBtn) nextBtn.disabled = false;
        }
    }

    if (savedData) {
        try {
            const formData = JSON.parse(savedData);

            // 1️⃣ Restore all fields EXCEPT continent & country
            Object.keys(FIELD_MAP).forEach((backendKey) => {
                if (backendKey === 'continent' || backendKey === 'country') return;

                const fieldId = getFieldId(backendKey);
                const el = document.getElementById(fieldId);

                if (el && formData[backendKey]) {
                    el.value = formData[backendKey];

                    if (el.tagName === 'SELECT') {
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });
            if (formData.continent) {
                // Wait for continents to load first
                if (window.continentsLoadPromise) {
                    try {
                        await window.continentsLoadPromise;
                    } catch (e) {
                        console.error('Wait for continents failed', e);
                    }
                }
                const continentVal = formData.continent;
                const continentSelect = document.getElementById('continent');

                if (continentSelect) {
                    window.isProgrammaticChange = true;
                    continentSelect.display = 'none'; // Temporarily hide to reduce flicker if needed, but primarily locking logic
                    continentSelect.value = continentVal;

                    // Reset tracker so restore works properly
                    window.currentLoadedContinentId = null;

                    await loadCountries(); // wait for countries API
                    window.isProgrammaticChange = false;

                    if (formData.country) {
                        const countrySelect = document.getElementById('country');
                        if (countrySelect) {
                            countrySelect.value = formData.country;
                        }
                    }
                    continentSelect.display = '';
                }
            }

        } catch (e) {
            console.error('Error restoring form data:', e);
        }
    }

    // 3️⃣ Restore step
    if (
        !skipStepRestore &&
        savedStep &&
        !window.location.hash.includes('token=') &&
        !window.location.hash.includes('email=')
    ) {
        const step = parseInt(savedStep, 10);
        const currentStep = window.registrationCurrentStep || 1;

        // Only restore if it's a forward step or same step, never go backwards
        if (step > 1 && step <= totalSteps && step >= currentStep) {
            console.log(`[restoreFormData] Restoring step ${step} (current: ${currentStep})`);
            goToStep(step);
        } else if (step < currentStep) {
            console.log(`[restoreFormData] Skipping step restore: saved=${step}, current=${currentStep} (won't go backwards)`);
        }
    }
}


/* -------------------------------------
     Clear saved registration data
   ------------------------------------- */

function clearRegistrationData() {
    sessionStorage.removeItem(STORAGE.FORM);
    sessionStorage.removeItem(STORAGE.STEP);
    sessionStorage.removeItem(STORAGE.TOKEN);
    sessionStorage.removeItem(STORAGE.EMAIL);
}


/* -------------------------------------
     Check URL parameters for email verification
   ------------------------------------- */

/* -------------------------------------
     Check URL parameters for email verification
   ------------------------------------- */

async function checkURLParams() {

    // Read token and email from URL query parameters 
    let urlParams = new URLSearchParams(window.location.search);

    // GUARD: If we're on Step 4+ and there's no token/error in URL, skip redirect logic
    // This prevents unwanted redirects when user is filling out Step 4 (continent/country selection)
    // Read from sessionStorage first since global variable might not be set yet
    const savedStep = sessionStorage.getItem(STORAGE.STEP);
    const currentStep = savedStep ? parseInt(savedStep, 10) : (window.registrationCurrentStep || 1);
    const error = urlParams.get('error');
    let token = urlParams.get('token');
    let email = urlParams.get('email');

    // Check hash params too
    let hasHashParams = false;
    if (window.location.hash.includes('?')) {
        hasHashParams = window.location.hash.includes('token=') || window.location.hash.includes('error=');
    }

    const hasUrlParams = token || email || error || hasHashParams;

    console.log('[checkURLParams] Debug:', {
        savedStep,
        currentStep,
        globalStep: window.registrationCurrentStep,
        hasUrlParams,
        token: !!token,
        email: !!email,
        error: !!error,
        hasHashParams,
        willSkipRedirect: currentStep >= 4 && !hasUrlParams
    });

    if (currentStep >= 4 && !hasUrlParams) {
        console.log('[checkURLParams] On Step 4+, no URL params to process. Skipping redirect logic.');
        restoreFormData();
        return;
    }

    // Handle error params (e.g. invalid or expired token from backend redirect)
    if (error) {
        if (error === 'expired') {
            showError('Your verification link has expired. Please enter your email to get a new one.');
        } else if (error === 'invalid') {
            showError('Invalid verification link.');
        }

        // Reset to Step 3 (Email) so user can enter email again
        goToStep(3);

        // Unlock email field if it was locked
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.readOnly = false;
            // Pre-fill if email came back in params
            const emailParam = urlParams.get('email');
            if (emailParam) {
                emailInput.value = decodeURIComponent(emailParam);
            }
            emailInput.focus();
        }

        // Reset verification state
        const emailVerifiedDiv = document.getElementById('emailVerified');
        const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
        if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'none';
        if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'block';

        return; // Stop processing other params
    }

    token = urlParams.get('token');
    email = urlParams.get('email');

    // If not found, check hash params (common in SPAs with hash routing)
    if (!token && window.location.hash.includes('?')) {
        try {
            const hashQueryString = window.location.hash.split('?')[1];
            const hashParams = new URLSearchParams(hashQueryString);

            // Allow error check in hash params too
            const hashError = hashParams.get('error');
            if (hashError) {
                if (hashError === 'expired') showError('Link expired. Please enter your email to get a new one.');
                else showError('Invalid verification link.');

                goToStep(3);
                // Unlock email field logic... (reuse logic or extract)
                const emailInput = document.getElementById('email');
                if (emailInput) {
                    emailInput.readOnly = false;
                    // Pre-fill
                    const emailParam = hashParams.get('email');
                    if (emailParam) {
                        emailInput.value = decodeURIComponent(emailParam);
                    }
                    emailInput.focus();
                }
                const emailVerifiedDiv = document.getElementById('emailVerified');
                const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
                if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'none';
                if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'block';

                return;
            }

            token = hashParams.get('token');
            email = hashParams.get('email');
        } catch (e) {
            console.error('Error parsing hash params:', e);
        }
    }

    if (token && email) {
        if (sessionStorage.getItem('last_verified_token') === token) {
            console.log('Token already verified in this session, skipping re-verification logic');

            // Ensure UI is updated even if we skip logic
            const emailVerifiedDiv = document.getElementById('emailVerified');
            const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
            const nextBtn = document.getElementById('emailNextBtn');
            const verifiedInput = document.getElementById('verifiedEmail');

            if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
            if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
            if (nextBtn) nextBtn.disabled = false;
            if (verifiedInput) verifiedInput.value = decodeURIComponent(email);

            // Restore to saved step (don't force step 3 if user is already further)
            restoreFormData();
            return;
        }

        console.log('Verification successful via params.');
        verificationToken = token;
        verifiedEmail = decodeURIComponent(email);

        // Save to session storage
        sessionStorage.setItem(STORAGE.TOKEN, verificationToken);
        sessionStorage.setItem(STORAGE.EMAIL, verifiedEmail);
        sessionStorage.setItem('last_verified_token', token);
        sessionStorage.setItem(STORAGE.VERIFIED_STATUS, 'true');
        sessionStorage.setItem(STORAGE.VERIFIED_TIMESTAMP, new Date().toISOString());

        // Update UI to show verified state
        const emailVerifiedDiv = document.getElementById('emailVerified');
        const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
        const nextBtn = document.getElementById('emailNextBtn');
        const verifiedInput = document.getElementById('verifiedEmail');

        if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
        if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
        if (nextBtn) nextBtn.disabled = false;
        if (verifiedInput) verifiedInput.value = verifiedEmail;

        if (window.showToast) window.showToast('Email Verified Successfully!', 'success');

        // Restore draft data from backend before rendering form
        await getDraft(verifiedEmail);

        // Restore form data from sessionStorage
        restoreFormData(true);

        // Only go to step 3 if no saved step exists, otherwise restore will handle it
        const savedStep = sessionStorage.getItem(STORAGE.STEP);
        if (!savedStep || parseInt(savedStep, 10) <= 3) {
            goToStep(3);
        }
    } else {
        // No email verification in URL, just restore form data normally
        restoreFormData();
    }
}


/* -------------------------------------
      Load institutes from API
   ------------------------------------- */

const REF_CACHE_KEY = 'reference_data_cache';

function getRefCache() {
    try {
        return JSON.parse(sessionStorage.getItem(REF_CACHE_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function setRefCache(key, data) {
    const cache = getRefCache();
    cache[key] = data;
    sessionStorage.setItem(REF_CACHE_KEY, JSON.stringify(cache));
}

async function loadInstitutes() {
    console.log('loadInstitutes() called');

    const select = document.getElementById('institute');
    if (!select) return;

    // 1. Check module cache
    if (cachedInstitutes) {
        console.log('Using memory cached institutes');
        populateInstitutesSelect(select, cachedInstitutes);
        return;
    }

    // 2. Check session storage cache
    const sessionCache = getRefCache();
    if (sessionCache.institutes && Array.isArray(sessionCache.institutes) && sessionCache.institutes.length > 0) {
        console.log('Using session cached institutes');
        cachedInstitutes = sessionCache.institutes;
        populateInstitutesSelect(select, cachedInstitutes);
        return;
    }

    if (isFetchingInstitutes) return;
    isFetchingInstitutes = true;

    // Add loading state
    select.disabled = true;
    select.innerHTML = '<option>Loading...</option>';

    try {
        const url = `${CONFIG.API_BASE_URL}/api/reference/institutes`;
        console.log('Fetching institutes from:', url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const institutes = Array.isArray(data) ? data : (data.institutes || []);

        if (institutes.length === 0) {
            showError('No institutes available.');
            select.innerHTML = '<option value="">-- No Institutes --</option>';
            return;
        }

        // Update caches
        cachedInstitutes = institutes;
        setRefCache('institutes', institutes);

        populateInstitutesSelect(select, cachedInstitutes);

    } catch (error) {
        console.error('Error loading institutes:', error);
        showError('Failed to load institutes.');
        select.innerHTML = '<option value="">-- Failed to load --</option>';
    } finally {
        isFetchingInstitutes = false;
        select.disabled = false;
    }
}

function populateInstitutesSelect(select, institutes) {
    select.innerHTML = '<option value="">-- Select Institute --</option>';

    institutes.forEach(institute => {
        const option = document.createElement('option');
        option.value = institute.id;
        option.textContent = `${institute.name} (${institute.city}, ${institute.country})`;
        select.appendChild(option);
    });

    console.log('Successfully populated', institutes.length, 'institutes');

    // After institutes are loaded, restore the selected value from sessionStorage
    const savedData = sessionStorage.getItem(STORAGE.FORM);
    if (savedData) {
        try {
            const formData = JSON.parse(savedData);
            if (formData.institute_id) {
                select.value = formData.institute_id;
                console.log('Restored institute selection:', formData.institute_id);
            }
        } catch (e) {
            console.error('Error restoring institute:', e);
        }
    }
}

const CONTINENT_LOADED_FLAG = 'continents_loaded_flag';

// Flag for synchronization
window.continentsLoadPromise = null;

async function loadContinents(force = false) {
    if (!force && window.continentsLoaded) {
        console.log('Continents globally marked as loaded. Skipping.');
        return;
    }

    if (!force && window.continentsLoadPromise) {
        return window.continentsLoadPromise;
    }

    window.continentsLoadPromise = (async () => {
        console.log('loadContinents() called', { force });

        const continentSelect = document.getElementById('continent');
        if (!continentSelect) {
            console.error('Continent select missing');
            return;
        }

        // 0. Check if already populated
        if (!force && continentSelect.options.length > 1) {
            console.log('Continents already populated');
            window.continentsLoaded = true;
            return;
        }

        // 1. Check module cache
        if (!force && cachedContinents) {
            populateContinentsSelect(continentSelect, cachedContinents);
            window.continentsLoaded = true;
            return;
        }

        // 2. Check session storage cache
        const sessionCache = getRefCache();
        if (!force && sessionCache.continents?.length > 0) {
            cachedContinents = sessionCache.continents;
            populateContinentsSelect(continentSelect, cachedContinents);
            window.continentsLoaded = true;
            return;
        }

        // 3. Fetch
        isFetchingContinents = true;
        continentSelect.innerHTML = '<option value="">Loading...</option>';

        if (continentsAbortController) continentsAbortController.abort();
        continentsAbortController = new AbortController();

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/reference/continents`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: continentsAbortController.signal
            });

            if (!response.ok) throw new Error(`HTTP ${response.status} - Failed to load continents`);

            const data = await response.json();
            const continents = Array.isArray(data) ? data : (data.continents || []);

            // Update caches
            cachedContinents = continents;
            setRefCache('continents', continents);
            window.continentsLoaded = true;

            populateContinentsSelect(document.getElementById('continent'), cachedContinents);

        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Error loading continents:', error);
            if (continentSelect) continentSelect.innerHTML = '<option>Failed to load</option>';
        } finally {
            isFetchingContinents = false;
        }
    })();

    return window.continentsLoadPromise;
}

// FIXED VERSION - Add this at the top with your global state
let continentChangeHandlerAttached = false;

// FIXED: populateContinentsSelect function
function populateContinentsSelect(selectElement, continents) {
    // Store current value before clearing
    const currentValue = selectElement.value;

    selectElement.innerHTML = '<option value="">-- Select Continent --</option>';

    continents.forEach(continent => {
        const option = document.createElement('option');
        option.value = String(continent.id);
        option.textContent = continent.name;
        selectElement.appendChild(option);
    });

    // Restore value if it was set
    if (currentValue) {
        selectElement.value = currentValue;
    }

    // CRITICAL FIX: Only attach handler ONCE
    if (!continentChangeHandlerAttached) {
        selectElement.addEventListener('change', async function (e) {
            // Prevent duplicate triggers
            if (window.isProgrammaticChange) {
                console.log('[Continent] Skipping programmatic change');
                return;
            }

            const selectedValue = this.value;
            console.log('[Continent] User selected:', selectedValue);

            if (!selectedValue) {
                const countrySelect = document.getElementById('country');
                if (countrySelect) {
                    countrySelect.innerHTML = '<option value="">-- Select Continent First --</option>';
                    countrySelect.disabled = true;
                }
                return;
            }

            // Reset country dropdown immediately
            const countrySelect = document.getElementById('country');
            if (countrySelect) {
                countrySelect.innerHTML = '<option value="">Loading...</option>';
                countrySelect.disabled = true;
            }

            // Reset the loaded continent tracker to allow new load
            window.currentLoadedContinentId = null;

            // Load countries
            try {
                await loadCountries();
            } catch (err) {
                console.error('[Continent] Error loading countries:', err);
            }
        });

        continentChangeHandlerAttached = true;
        console.log('[Continent] Change handler attached');
    }
}

// FIXED: loadCountries function with race condition prevention
let currentCountriesLoadPromise = null;

async function loadCountries() {
    const continentSelect = document.getElementById('continent');
    const countrySelect = document.getElementById('country');
    const continentId = continentSelect?.value;

    console.log('[loadCountries] Called with ID:', continentId);

    // Guard 1: Missing elements
    if (!continentSelect || !countrySelect) {
        console.error('[loadCountries] Required elements missing');
        return;
    }

    // Guard 2: Invalid continent ID
    if (!continentId || continentId === 'Loading...' || continentId === 'undefined' || continentId === '') {
        console.log('[loadCountries] Invalid continent ID, resetting');
        countrySelect.innerHTML = '<option value="">-- Select Continent First --</option>';
        countrySelect.disabled = true;
        window.currentLoadedContinentId = null;
        return;
    }

    // Guard 3: Already loaded for this continent AND not programmatic (restoration)
    if (String(window.currentLoadedContinentId) === String(continentId) &&
        countrySelect.options.length > 1 &&
        !window.isProgrammaticChange) {
        console.log('[loadCountries] Countries already loaded for:', continentId);
        return;
    }

    // Guard 4: If there's already a load in progress for this continent, wait for it
    if (currentCountriesLoadPromise && window.lastRequestedContinentId === continentId) {
        console.log('[loadCountries] Waiting for existing load promise');
        return currentCountriesLoadPromise;
    }

    // Cancel previous request if it's for a different continent
    if (countriesAbortController && window.lastRequestedContinentId !== continentId) {
        console.log('[loadCountries] Aborting previous request for different continent');
        countriesAbortController.abort();
    }

    // Create new abort controller for this request
    countriesAbortController = new AbortController();
    window.lastRequestedContinentId = continentId;

    // Set loading state
    countrySelect.innerHTML = '<option value="">Loading...</option>';
    countrySelect.disabled = true;

    // Create and store the promise to prevent concurrent loads
    currentCountriesLoadPromise = (async () => {
        try {
            const response = await fetch(
                `${CONFIG.API_BASE_URL}/api/reference/countries?continent_id=${continentId}`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: countriesAbortController.signal
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const countries = Array.isArray(data) ? data : (data.countries || []);

            // Check if this request is still relevant (continent hasn't changed)
            if (continentSelect.value !== continentId) {
                console.log('[loadCountries] Continent changed during fetch, discarding results');
                return;
            }

            // Populate dropdown
            countrySelect.innerHTML = '<option value="">-- Select Country --</option>';

            if (countries.length === 0) {
                countrySelect.innerHTML = '<option value="">-- No Countries Available --</option>';
                console.warn('[loadCountries] No countries for continent:', continentId);
            } else {
                countries.forEach(country => {
                    const option = document.createElement('option');
                    option.value = String(country.id);
                    option.textContent = country.name;
                    if (country.phone_code) {
                        option.dataset.phoneCode = country.phone_code;
                    }
                    countrySelect.appendChild(option);
                });
            }

            countrySelect.disabled = false;

            // Mark as successfully loaded AFTER population
            window.currentLoadedContinentId = continentId;
            console.log('[loadCountries] Successfully loaded countries for:', continentId);

            // DON'T auto-restore here - let the caller handle restoration
            // This prevents double-setting values during restore operations

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[loadCountries] Request aborted');
                return;
            }

            console.error('[loadCountries] Error:', error);

            // Only show error if this continent is still selected
            if (continentSelect.value === continentId) {
                countrySelect.innerHTML = '<option value="">-- Error Loading --</option>';
                if (typeof toastr !== 'undefined') {
                    toastr.error('Failed to load countries. Please try again.');
                }
            }
        } finally {
            countrySelect.disabled = false;
            currentCountriesLoadPromise = null;
        }
    })();

    return currentCountriesLoadPromise;
}

// FIXED: handleContinentRestore function
async function handleContinentRestore(continentId, countryId) {
    const continentSelect = document.getElementById('continent');
    if (!continentSelect) return;

    console.log('[Restore] Restoring continent:', continentId, 'country:', countryId);

    // Wait for continents to be loaded
    if (window.continentsLoadPromise) {
        await window.continentsLoadPromise;
    }

    // Set flag to prevent triggering change handler
    window.isProgrammaticChange = true;

    try {
        // Set continent value
        continentSelect.value = continentId;

        // Reset tracker to allow load (since we're in programmatic mode)
        window.currentLoadedContinentId = null;

        // Load countries and WAIT for completion
        await loadCountries();

        // Now set country value AFTER countries are loaded
        if (countryId) {
            const countrySelect = document.getElementById('country');
            if (countrySelect) {
                // Small delay to ensure DOM is updated
                await new Promise(resolve => setTimeout(resolve, 50));
                countrySelect.value = countryId;
                console.log('[Restore] Set country to:', countryId);
            }
        }
    } finally {
        // Always reset flag
        window.isProgrammaticChange = false;
    }
}



// Debounce timer for auto-save
let autoSaveTimer;

function autoSaveFormData() {
    saveFormData();

    // Auto-save draft to server with debounce (1s)
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveDraft();
    }, 1000);
}

function initializeAutoSave() {
    if (!FIELD_MAP) {
        console.warn('FIELD_MAP not found, auto-save skipped');
        return;
    }

    Object.values(FIELD_MAP).forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (!el) return;

        // Skip change/input event for continent/country to prevent double-firing/loops
        if (fieldId !== 'continent' && fieldId !== 'country') {
            el.addEventListener('input', autoSaveFormData);

            el.addEventListener('change', () => {
                if (window.isProgrammaticChange) {
                    console.log('Skip autosave (programmatic)');
                    return;
                }
                autoSaveFormData();
            });
        }

        // Manual listener for country to just save form data, not full draft auto-save which might differ
        // Or actually, let's just let user save manually or on next step. 
        // But preventing the redirect is key. If saveDraft is innocent, then what?

        // Wait, if country select has NO onchange, then data isn't saved to session?
        // We should add a simple listener for country that respects lock.
        if (fieldId === 'country') {
            const handleCountryChange = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (window.isProgrammaticChange) return;
                saveFormData();
            };
            el.addEventListener('change', handleCountryChange);
            el.addEventListener('input', handleCountryChange);
        }

        // Special handling for email: check for draft on blur
        if (fieldId === 'email') {
            el.addEventListener('blur', function () {
                if (this.value && validateEmail(this.value)) {
                    if (this.value !== lastFetchedDraftEmail) {
                        getDraft(this.value);
                    }
                }
            });
        }


    });

    console.log('Auto-save listeners attached');
}

/* -------------------------------------
     Draft Management
   ------------------------------------- */

async function saveDraft() {
    const formData = {};
    Object.keys(FIELD_MAP).forEach((backendKey) => {
        const fieldId = getFieldId(backendKey);
        const el = document.getElementById(fieldId);
        formData[backendKey] = el?.value || '';
    });

    // Ensure we have at least an email and institute
    if (!formData.email || !formData.institute_id) {
        // If mandatory fields missing, try reading from sessionStorage
        const savedData = JSON.parse(sessionStorage.getItem(STORAGE.FORM) || '{}');
        if (savedData.email) formData.email = savedData.email;
        if (savedData.institute_id) formData.institute_id = savedData.institute_id;
    }

    if (!formData.email || !formData.institute_id) return;

    // Add verification status to draft
    if (verificationToken) formData.token = verificationToken;
    if (verifiedEmail) formData.verified_email = verifiedEmail;
    if (window.registrationCurrentStep) formData.current_step = window.registrationCurrentStep;

    // Validate email format before sending
    if (!validateEmail(formData.email)) {
        // console.log('Skipping draft save: Invalid email format');
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.warn('Draft save failed:', response.status, errorData);
            return;
        }

        console.log('Draft saved successfully');
    } catch (e) {
        console.warn('Network error saving draft:', e);
    }
}

let lastFetchedDraftEmail = null;

async function getDraft(email) {
    if (!email) {
        console.warn('getDraft called with empty email');
        return false;
    }

    // Prevent refetching the same draft repeatedly
    if (email === lastFetchedDraftEmail) {
        console.log('Draft already fetched for this email, skipping');
        return true;
    }

    // Simple lock to prevent multiple simultaneous draft fetches
    if (window._isFetchingDraft) {
        console.log('Draft fetch already in progress, skipping');
        return false;
    }
    window._isFetchingDraft = true;

    try {
        console.log('Fetching draft for:', email);
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/draft/${email}`);

        if (!response.ok) {
            console.warn('Draft fetch failed:', response.status);
            return false;
        }

        const data = await response.json();
        const draft = data.draft;

        lastFetchedDraftEmail = email; // Mark as fetched

        if (draft) {
            // Restore global state from draft if available
            if (draft.token) {
                verificationToken = draft.token;
                sessionStorage.setItem(STORAGE.TOKEN, draft.token);
            }
            if (draft.verified_email || draft.is_verified) {
                verifiedEmail = draft.verified_email || email;
                sessionStorage.setItem(STORAGE.EMAIL, verifiedEmail);
            }
            if (draft.current_step) {
                window.registrationCurrentStep = parseInt(draft.current_step, 10);
                sessionStorage.setItem(STORAGE.STEP, draft.current_step);
            }

            // Merge with sessionStorage
            const currentData = JSON.parse(sessionStorage.getItem(STORAGE.FORM) || '{}');

            // Prioritize backend data, but keep local changes if any (though usually backend is source of truth here)
            const newData = { ...currentData, ...draft };
            sessionStorage.setItem(STORAGE.FORM, JSON.stringify(newData));

            console.log('Draft data retrieved and merged into session storage');
            return true;
        } else {
            console.log('No draft found for this email');
        }
    } catch (e) {
        console.error('Error fetching draft:', e);
    } finally {
        window._isFetchingDraft = false;
    }
    return false;
}

/* -------------------------------------
    Send verification email
   ------------------------------------- */

async function sendVerificationEmail() {
    console.log('[sendVerificationEmail] Called');

    const email = document.getElementById('email').value;

    if (!email || !validateEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        return;
    }

    // CRITICAL: Save current step BEFORE any async operations
    const currentStep = window.registrationCurrentStep || 3;
    sessionStorage.setItem(STORAGE.STEP, currentStep.toString());
    console.log('[sendVerificationEmail] Saved current step:', currentStep);

    // Save draft before sending verification email to prevent data loss 
    // if user opens link in a new tab/device
    // REMOVED: await saveDraft(); - This might be causing issues
    // Instead, just save form data locally
    saveFormData();

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/send-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            if (window.toastr) {
                window.toastr.success('Verification email sent! Please check your inbox.');
            } else if (window.showToast) {
                window.showToast('Verification email sent! Please check your inbox.', 'success');
            } else {
                alert('Verification email sent! Please check your inbox.');
            }
        } else {
            // Check for pending registration
            if (data.message && (data.message.toLowerCase().includes('pending') || data.message.toLowerCase().includes('already exists'))) {
                if (window.toastr) {
                    window.toastr.warning(
                        `<div>${data.message}</div><div style="margin-top:10px;"><button class="btn-sm btn-light" onclick="resendVerification('${email}')">Resend Link & Continue</button></div>`,
                        'Pending Registration',
                        { timeOut: 0, extendedTimeOut: 0 }
                    );
                } else if (window.showToast) {
                    window.showToast(data.message + ' (Check console to resend)', 'warning');
                    // fallback for button action
                    console.warn('Pending registration. Run resendVerification("' + email + '") in console.');
                }
            } else {
                if (window.toastr) window.toastr.error(data.message || 'Failed to send verification email');
                else if (window.showToast) window.showToast(data.message || 'Failed to send verification email', 'error');
                else alert(data.message || 'Failed to send verification email');
            }
        }
    } catch (error) {
        console.error('Error sending verification email:', error);
        if (window.toastr) window.toastr.error('Failed to send verification email. Please try again.');
        else if (window.showToast) window.showToast('Failed to send verification email. Please try again.', 'error');
        else alert('Failed to send verification email. Please try again.');
    }

    console.log('[sendVerificationEmail] Completed');
}


/* -------------------------------------
     Resend verification for pending registration
   ------------------------------------- */

async function resendVerification(email) {
    if (!email) return;

    // Use the same endpoint or a specific resend endpoint if available
    // Assuming the same endpoint handles resending logic or we can trigger it
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/resend-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            toastr.clear(); // Clear the warning toast
            toastr.success('Verification link sent again. Please check your email to continue.');
        } else {
            // Fallback to standard send if resend endpoint doesn't exist
            const retryResponse = await fetch(`${CONFIG.API_BASE_URL}/api/registration/send-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            if (retryResponse.ok) {
                toastr.clear();
                toastr.success('Verification link sent again. Please check your email to continue.');
            } else {
                toastr.error('Could not resend verification email.');
            }
        }
    } catch (e) {
        toastr.error('Network error. Please try again.');
    }
}


/* -------------------------------------
     Submit registration
   ------------------------------------- */

async function submitRegistration() {
    if (!validateStep(4)) return;

    if (!verificationToken || !verifiedEmail) {
        toastr.error('Email verification required.');
        // goToStep(3); // Don't force redirect, just warn
        return;
    }

    const savedFormData = JSON.parse(sessionStorage.getItem(STORAGE.FORM) || '{}');

    const formData = {
        token: verificationToken,
        email: verifiedEmail,
    };

    // Build payload dynamically from fieldMap
    Object.keys(FIELD_MAP).forEach(apiKey => {
        const fieldId = getFieldId(apiKey);
        const el = document.getElementById(fieldId);
        formData[apiKey] = el?.value || savedFormData[apiKey] || '';
    });

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/save-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            toastr.error(data?.message || 'Registration failed');
            return;
        }

        if (window.showToast) window.showToast('Registration successful!', 'success');
        else if (window.toastr) toastr.success('Registration successful!');

        showRegistrationSummary(formData);

        clearRegistrationData();
        nextStep();
    } catch (error) {
        console.error(error);
        if (window.showToast) window.showToast('Network error. Please try again.', 'error');
        else if (window.toastr) toastr.error('Network error. Please try again.');
    }
}

function showRegistrationSummary(data) {
    const container = document.querySelector('.step-content[data-step="5"]');
    if (!container) return;

    let html = '<div class="summary-card" style="margin-top:20px; text-align:left; background:#f8fafc; padding:20px; border-radius:8px;">';
    html += '<h3 style="margin-bottom:15px; color:#334155;">Registration Details</h3>';
    html += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">';

    const labels = {
        first_name: 'First Name', last_name: 'Last Name', email: 'Email',
        institute_id: 'Institute', continent: 'Continent', country: 'Country',
        city: 'City', state: 'State', postal_code: 'Zip Code',
        address_line1: 'Address', office_number: 'Phone'
    };

    for (const [key, val] of Object.entries(data)) {
        if (!val || key === 'token') continue;
        const label = labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<div style="font-size:14px; color:#64748b;">${label}:</div>`;
        html += `<div style="font-size:14px; font-weight:600; color:#0f172a; word-break: break-all;">${val}</div>`;
    }
    html += '</div></div>';

    const existing = container.querySelector('.summary-card');
    if (existing) existing.remove();

    const btn = container.querySelector('button');
    if (btn) btn.insertAdjacentHTML('beforebegin', html);
    else container.insertAdjacentHTML('beforeend', html);
}
/* -------------------------------------
   Navigation functions
------------------------------------- */

function nextStep() {
    // Validate current step before moving forward
    if (!validateStep(window.registrationCurrentStep)) return;

    saveFormData();

    if (window.registrationCurrentStep < totalSteps) {
        goToStep(window.registrationCurrentStep + 1);
    }
}

function prevStep() {
    saveFormData();

    if (window.registrationCurrentStep > 1) {
        goToStep(window.registrationCurrentStep - 1);
    }
}

function goToStep(step) {
    const currentStepEl = document.querySelector(`.step-content[data-step="${window.registrationCurrentStep}"]`);
    const currentProgressEl = document.querySelector(`.progress-step[data-step="${window.registrationCurrentStep}"]`);

    currentStepEl?.classList.remove('active');
    currentProgressEl?.classList.remove('active');

    // Mark previous steps completed
    for (let i = 1; i < step; i++) {
        document
            .querySelector(`.progress-step[data-step="${i}"]`)
            ?.classList.add('completed');
    }

    window.registrationCurrentStep = step;

    document
        .querySelector(`.step-content[data-step="${step}"]`)
        ?.classList.add('active');

    document
        .querySelector(`.progress-step[data-step="${step}"]`)
        ?.classList.add('active');

    sessionStorage.setItem(STORAGE.STEP, String(step));

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Lock institute selection if moving past step 1
    const instituteSelect = document.getElementById('institute');
    if (instituteSelect) {
        instituteSelect.disabled = (step > 1);

        // Handle persistent display
        const formContainer = document.querySelector('.form-container');
        let banner = document.getElementById('lockedInstituteBanner');

        if (step > 1) {
            const selectedText = instituteSelect.options[instituteSelect.selectedIndex]?.text;
            if (selectedText && selectedText !== '-- Select Institute --') {
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'lockedInstituteBanner';
                    banner.style.cssText = 'background: #f8fafc; padding: 12px 16px; border: 1px solid #e2e8f0; font-weight: 500; color: #475569; margin-bottom: 20px; border-radius: 8px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; user-select: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05);';
                    banner.onmouseover = () => { banner.style.borderColor = '#cbd5e1'; banner.style.background = '#f1f5f9'; };
                    banner.onmouseout = () => { banner.style.borderColor = '#e2e8f0'; banner.style.background = '#f8fafc'; };
                    banner.onclick = () => goToStep(1);

                    // Insert at top of form container
                    if (formContainer) formContainer.insertBefore(banner, formContainer.firstChild);
                }

                banner.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:center; width:32px; height:32px; background:#e2e8f0; border-radius:50%; color:#64748b;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-start; line-height:1.2;">
                        <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8;">Affiliated Institute</span>
                        <strong style="color:#334155; font-size:14px;">${selectedText}</strong>
                    </div>
                    <div style="margin-left:auto; padding: 4px 10px; background:white; border:1px solid #e2e8f0; border-radius:4px; font-size:12px; color:#64748b;">
                        Change
                    </div>
                `;
                banner.style.display = 'flex';
            }
        } else {
            if (banner) banner.style.display = 'none';
        }
    }
}

/* -------------------------------------
   Validation functions
------------------------------------- */

function validateStep(step) {
    switch (step) {
        case 1:
            return validateField('institute', 'Please select an institute');

        case 2:
            return (
                validateField('firstName', 'First name is required') &&
                validateField('lastName', 'Last name is required')
            );

        case 3:
            if (!verificationToken || !verifiedEmail) {
                toastr.error('Please verify your email before proceeding');
                return false;
            }
            return true;

        case 4:
            return (
                validateField('addressLine1', 'Address is required') &&
                validateField('city', 'City is required') &&
                validateField('state', 'State is required') &&
                validateField('postalCode', 'Postal code is required') &&
                validateField('continent', 'Please select a continent') &&
                validateField('country', 'Please select a country') &&
                validateField('officeCountryCode', 'Country code is required') &&
                validateField('officeNumber', 'Office number is required')
            );

        default:
            return true;
    }
}

// (Auto-initialization removed - handled by multiStepRegisterMount)

// Multi-step-registration mount 
function multiStepRegisterMount() {
    // ----------------------------------------------------
    // CIRCUIT BREAKER: Prevent rapid re-mounting
    // ----------------------------------------------------
    const now = Date.now();
    if (window.registrationMountedTimestamp && (now - window.registrationMountedTimestamp < 2000)) {
        console.warn('Prevented rapid re-mount of registration form.');
        return;
    }
    window.registrationMountedTimestamp = now;
    // ----------------------------------------------------

    console.log(`[${new Date().toISOString()}] === multiStepRegisterMount() ===`);
    console.trace('multiStepRegisterMount called via:');

    // Initialize current step from sessionStorage
    const savedStep = sessionStorage.getItem(STORAGE.STEP);
    if (savedStep) {
        window.registrationCurrentStep = parseInt(savedStep, 10);
        console.log('[Mount] Restored step from storage:', window.registrationCurrentStep);
    } else {
        window.registrationCurrentStep = 1;
        console.log('[Mount] No saved step, defaulting to 1');
    }

    // Double-check DOM elements exist before proceeding
    if (!document.getElementById('institute')) {
        console.error('Registration DOM not ready (institute select missing)');
        return;
    }

    try {
        // Load Institutes
        if (!cachedInstitutes && !isFetchingInstitutes) {
            // Check session storage one last time before deciding to fetch
            const sessionCache = getRefCache();
            if (sessionCache.institutes?.length > 0) {
                console.log('Mount: Found session cached institutes');
                cachedInstitutes = sessionCache.institutes;
                populateInstitutesSelect(document.getElementById('institute'), cachedInstitutes);
            } else {
                console.log('Mount: Initiating loadInstitutes');
                loadInstitutes?.();
            }
        } else {
            console.log('Mount: Skipping loadInstitutes (ready or fetching)');
            // Ensure UI is populated if we have cache
            if (cachedInstitutes) {
                populateInstitutesSelect(document.getElementById('institute'), cachedInstitutes);
            }
        }

        // Load Continents
        // Load Continents
        const continentSelect = document.getElementById('continent');

        if (!cachedContinents && !isFetchingContinents) {
            const sessionCache = getRefCache();
            if (sessionCache.continents?.length > 0) {
                console.log('Mount: Found session cached continents');
                cachedContinents = sessionCache.continents;
                if (continentSelect) {
                    populateContinentsSelect(continentSelect, cachedContinents);
                }
            } else {
                console.log('Mount: Initiating loadContinents');
                loadContinents?.();
            }
        } else {
            if (cachedContinents && continentSelect) {
                populateContinentsSelect(continentSelect, cachedContinents);
            }
        }

        checkURLParams?.();
        initializeAutoSave?.();

        console.log('Registration mounted successfully');
    } catch (err) {
        console.error('Error mounting registration:', err);
    }
}

// Helper function to clear country fetch loop detection
function clearCountryFetchLock() {
    sessionStorage.removeItem('country_fetch_count');
    sessionStorage.removeItem('country_fetch_window_start');
    sessionStorage.removeItem('last_country_fetch_id');
    window.lastCountryFetchTime = null;
    window.lastRequestedContinentId = null;
    window.currentLoadedContinentId = null;
    console.log('[clearCountryFetchLock] Loop detection counters cleared');
}

// Expose functions to window object for SPA access
window.loadInstitutes = loadInstitutes;
window.loadContinents = loadContinents;
window.loadCountries = loadCountries;
window.checkURLParams = checkURLParams;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.sendVerificationEmail = sendVerificationEmail;
window.resendVerification = resendVerification;
window.submitRegistration = submitRegistration;
window.initializeAutoSave = initializeAutoSave;
window.multiStepRegisterMount = multiStepRegisterMount;
window.saveDraft = saveDraft;
window.getDraft = getDraft;
window.showRegistrationSummary = showRegistrationSummary;
window.clearRegistrationData = clearRegistrationData;
window.clearCountryFetchLock = clearCountryFetchLock;
