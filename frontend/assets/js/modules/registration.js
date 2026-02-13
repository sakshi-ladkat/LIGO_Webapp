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

let registrationCurrentStep = 1;       // Tracks which step user is on (multi-step form)
const totalSteps = 5;
let verificationToken = null;
let verifiedEmail = null;

// Cache for reference data
let cachedInstitutes = null;
let cachedContinents = null;
let isFetchingInstitutes = false;
let isFetchingContinents = false;

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
    sessionStorage.setItem(STORAGE.STEP, registrationCurrentStep.toString());

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
                const continentVal = formData.continent;
                const continentSelect = document.getElementById('continent');

                if (continentSelect) {
                    continentSelect.value = continentVal;

                    await loadCountries(); // wait for countries API

                    if (formData.country) {
                        const countrySelect = document.getElementById('country');
                        if (countrySelect) {
                            countrySelect.value = formData.country;
                        }
                    }
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
        if (step > 1 && step <= totalSteps) {
            goToStep(step);
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

    // Handle error params (e.g. invalid or expired token from backend redirect)
    const error = urlParams.get('error');
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

    let token = urlParams.get('token');
    let email = urlParams.get('email');

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
            restoreFormData();
            // Ensure UI is updated even if we skip logic
            const emailVerifiedDiv = document.getElementById('emailVerified');
            const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
            const nextBtn = document.getElementById('emailNextBtn');
            const verifiedInput = document.getElementById('verifiedEmail');

            if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
            if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
            if (nextBtn) nextBtn.disabled = false;
            if (verifiedInput) verifiedInput.value = decodeURIComponent(email);

            goToStep(3);
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
        goToStep(3);
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
let continentsAbortController = null;

async function loadContinents(force = false) {
    if (!force && window.continentsLoaded) {
        console.log('Continents globally marked as loaded. Skipping.');
        return;
    }

    console.log('loadContinents() called', { force });
    // console.trace('loadContinents caller'); // Uncomment for debugging

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

    // 2. Lock check
    if (isFetchingContinents) {
        return;
    }

    // 3. Check session storage cache
    const sessionCache = getRefCache();
    if (!force && sessionCache.continents?.length > 0) {
        cachedContinents = sessionCache.continents;
        populateContinentsSelect(continentSelect, cachedContinents);
        window.continentsLoaded = true;
        return;
    }

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
}



function populateContinentsSelect(selectElement, continents) {
    selectElement.innerHTML = '<option value="">-- Select Continent --</option>';

    continents.forEach(continent => {
        const option = document.createElement('option');
        option.value = String(continent.id);
        option.textContent = continent.name;
        selectElement.appendChild(option);
    });

    // Attach change listener
    // Remove old listeners by cloning (simple way) or just assume fresh mount
    // Better to use named function or check existence, but simpler to just add if we know it's fresh.
    // However, if we call this multiple times, we might stack listeners.
    // Best practice: selectElement.onchange = ... OR removeEventListener.
    // Since we are clearing innerHTML, we don't clear listeners on the element itself.
    // But `selectElement` is passed in.

    // We'll set onchange to avoid stacking
    selectElement.onchange = (e) => {
        e.stopPropagation();
        console.log('Continent Selected:', selectElement.value);

        // Reset country
        const countrySelect = document.getElementById('country');
        if (countrySelect) {
            window.currentLoadedContinentId = null;
            countrySelect.innerHTML = '<option value="">-- Select Country --</option>';
        }

        saveFormData();
        loadCountries();
    };
}

let countriesAbortController = null;
window.lastCountryFetchTime = 0;

async function loadCountries() {
    // console.group('loadCountries');
    const continentSelect = document.getElementById('continent');
    const countrySelect = document.getElementById('country');
    const continentId = continentSelect ? continentSelect.value : null;

    console.log('[loadCountries] called. ID:', continentId);

    // Throttling
    const now = Date.now();
    if (window.lastCountryFetchTime && (now - window.lastCountryFetchTime < 1000) && window.currentLoadedContinentId === continentId) {
        console.warn('Throttling country fetch');
        return;
    }
    window.lastCountryFetchTime = now;
    if (!continentSelect || !countrySelect) {
        console.error('[loadCountries] Elements missing');
        return;
    }

    // Relaxed check: Only invalid if falsy string, Loading, or undefined string
    if (!continentId || continentId === 'Loading...' || continentId === 'undefined') {
        console.warn('[loadCountries] Invalid ID. Resetting UI.', { id: continentId });
        countrySelect.innerHTML = '<option value="">-- Select Continent First --</option>';
        window.currentLoadedContinentId = null;
        countrySelect.disabled = false;
        return;
    }

    // CRITICAL FIX 2: Set tracker IMMEDIATELY to prevent re-entry
    if (window.currentLoadedContinentId === continentId && countrySelect.options.length > 1) {
        console.log('Countries for this continent already processed. Skipping fetch.');
        return;
    }

    // CRITICAL FIX 3: Check lock BEFORE setting tracker
    if (window.isFetchingCountries) {
        console.warn('Country fetch in progress. Blocking concurrent call.');
        return;
    }

    // Mark as being processed IMMEDIATELY (before async operations)
    window.currentLoadedContinentId = continentId;
    window.isFetchingCountries = true;

    // Cancel any previous pending request
    if (countriesAbortController) {
        countriesAbortController.abort();
    }
    countriesAbortController = new AbortController();

    // Show loading state
    countrySelect.innerHTML = '<option value="">Loading countries...</option>';
    countrySelect.disabled = true;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/reference/countries?continent_id=${continentId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: countriesAbortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - Failed to load countries`);
        }

        const data = await response.json();
        const countries = Array.isArray(data) ? data : (data.countries || []);

        countrySelect.innerHTML = '<option value="">-- Select Country --</option>';

        if (!countries.length) {
            showError('No countries available for selected continent');
            return; // Keep dataset.loadedContinent set to prevent retry
        }

        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = String(country.id);
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });

        // CRITICAL FIX 4: Remove the onchange handler that saves form data
        // This was causing the loop. We'll handle saving elsewhere.
        // countrySelect.onchange = () => saveFormData(); // REMOVED

        // Restore previously selected country (if exists)
        const savedData = sessionStorage.getItem(STORAGE.FORM);
        if (savedData) {
            try {
                const formData = JSON.parse(savedData);
                console.log('Restoring country choice:', formData.country);
                if (formData?.country) {
                    const countryVal = String(formData.country);
                    countrySelect.value = countryVal;

                    if (countrySelect.value !== countryVal) {
                        console.warn('Could not restore country value. ID mismatch?', {
                            saved: countryVal,
                            currentValue: countrySelect.value
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to restore country:', e);
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('Previous loadCountries request aborted');
            return;
        }
        console.error('Error loading countries:', error);
        showError('Failed to load countries');
        if (window.toastr) {
            toastr.error(error.message || 'Failed to load countries');
        }
        countrySelect.innerHTML = '<option value="">-- Failed to load countries --</option>';

        // CRITICAL FIX 5: Clear global tracker on error so user can retry
        window.currentLoadedContinentId = null;

    } finally {
        countrySelect.disabled = false;
        window.isFetchingCountries = false;
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

        el.addEventListener('input', autoSaveFormData);
        el.addEventListener('change', autoSaveFormData);

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
    if (registrationCurrentStep) formData.current_step = registrationCurrentStep;

    try {
        await fetch(`${CONFIG.API_BASE_URL}/api/registration/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(formData)
        });
        console.log('Draft saved successfully');
    } catch (e) {
        console.warn('Failed to save draft', e);
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
                registrationCurrentStep = parseInt(draft.current_step, 10);
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
    const email = document.getElementById('email').value;

    if (!email || !validateEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        return;
    }

    // Save draft before sending verification email to prevent data loss 
    // if user opens link in a new tab/device
    await saveDraft();

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
        goToStep(3);
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
    if (!validateStep(registrationCurrentStep)) return;

    saveFormData();

    if (registrationCurrentStep < totalSteps) {
        goToStep(registrationCurrentStep + 1);
    }
}

function prevStep() {
    saveFormData();

    if (registrationCurrentStep > 1) {
        goToStep(registrationCurrentStep - 1);
    }
}

function goToStep(step) {
    const currentStepEl = document.querySelector(`.step-content[data-step="${registrationCurrentStep}"]`);
    const currentProgressEl = document.querySelector(`.progress-step[data-step="${registrationCurrentStep}"]`);

    currentStepEl?.classList.remove('active');
    currentProgressEl?.classList.remove('active');

    // Mark previous steps completed
    for (let i = 1; i < step; i++) {
        document
            .querySelector(`.progress-step[data-step="${i}"]`)
            ?.classList.add('completed');
    }

    registrationCurrentStep = step;

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
/* -------------------------------------
   Debounce + Auto-save
------------------------------------- */

function debounce(fn, delay = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

const autoSaveFormData = debounce(saveFormData, 500);




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