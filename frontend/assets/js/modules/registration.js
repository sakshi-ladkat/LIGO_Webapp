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
      Global State and Constants 
------------------------------------- */
let verificationToken = null;
let verifiedEmail = null;
const totalSteps = 5;

let cachedInstitutes = null;
let cachedContinents = null;
let isFetchingInstitutes = false;
let isFetchingContinents = false;

let continentsAbortController = null;
let countriesAbortController = null;

window.isProgrammaticChange = false;
window.isLoadingCountries = false;
window.continentsLoadPromise = null;
window.continentsLoaded = false;
window.lastProcessedContinentId = null;
window.currentLoadedContinentId = null;
let continentChangeHandlerAttached = false;
let currentCountriesLoadPromise = null;
let currentFetchingContinentId = null;

// Debounce timer
let autoSaveTimer;
let lastFetchedDraftEmail = null;

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
   Helper: Safe programmatic continent setter
------------------------------------- */
async function setContinentValue(continentId) {
    const continentSelect = document.getElementById('continent');
    if (!continentSelect || !continentId) return;

    window.isProgrammaticChange = true;

    if (window.lastProcessedContinentId !== continentId) {
        window.lastProcessedContinentId = continentId;
        continentSelect.value = continentId;
        console.log('[setContinentValue] Programmatically set continent:', continentId);

        await loadCountries();
    }

    window.isProgrammaticChange = false;
}

/* -------------------------------------
   Save form data
------------------------------------- */
function saveFormData() {
    const formData = {};
    Object.keys(FIELD_MAP).forEach(key => {
        const el = document.getElementById(getFieldId(key));
        formData[key] = el?.value || '';
    });

    sessionStorage.setItem(STORAGE.FORM, JSON.stringify(formData));

    const existingStep = parseInt(sessionStorage.getItem(STORAGE.STEP) || '1', 10);
    const currentStep = window.registrationCurrentStep || 1;

    if (currentStep >= existingStep) {
        sessionStorage.setItem(STORAGE.STEP, currentStep.toString());
    }

    if (verificationToken) sessionStorage.setItem(STORAGE.TOKEN, verificationToken);
    if (verifiedEmail) {
        sessionStorage.setItem(STORAGE.EMAIL, verifiedEmail);
        sessionStorage.setItem(STORAGE.VERIFIED_STATUS, 'true');
        if (!sessionStorage.getItem(STORAGE.VERIFIED_TIMESTAMP)) {
            sessionStorage.setItem(STORAGE.VERIFIED_TIMESTAMP, new Date().toISOString());
        }
    }
}



/* -------------------------------------
   Restore form data
------------------------------------- */
async function restoreFormData(skipStepRestore = false) {
    const savedData = sessionStorage.getItem(STORAGE.FORM);
    if (!savedData) return;

    // Restore verification state
    const savedToken = sessionStorage.getItem(STORAGE.TOKEN);
    const savedEmail = sessionStorage.getItem(STORAGE.EMAIL);
    const savedStatus = sessionStorage.getItem(STORAGE.VERIFIED_STATUS);

    if (savedToken && savedEmail) {
        verificationToken = savedToken;
        verifiedEmail = savedEmail;

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
            if (verifiedEmailInput) verifiedEmailInput.value = verifiedEmail;
            if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
            if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
            if (nextBtn) nextBtn.disabled = false;
        }
    }

    window.isProgrammaticChange = true;

    try {
        const formData = JSON.parse(savedData);

        // Restore non-dependent fields
        Object.keys(FIELD_MAP).forEach(key => {
            if (['continent', 'country', 'institute_id'].includes(key)) return;
            const el = document.getElementById(getFieldId(key));
            if (el && formData[key] !== undefined) el.value = formData[key];
        });

        // Restore institute
        const instSelect = document.getElementById('institute');
        if (instSelect && formData.institute_id) instSelect.value = formData.institute_id;

        // Restore continent -> country chain safely
        if (formData.continent) {
            if (window.continentsLoadPromise) await window.continentsLoadPromise;
            await setContinentValue(formData.continent);

            // Set country after countries loaded
            const countrySelect = document.getElementById('country');
            if (countrySelect && formData.country) countrySelect.value = formData.country;
        }

        // Restore step
        const savedStepNum = parseInt(sessionStorage.getItem(STORAGE.STEP) || '1', 10);
        const hasTokenInUrl = window.location.hash.includes('token=');
        const shouldSkipStepRestore = skipStepRestore || (hasTokenInUrl && savedStepNum <= 3);

        if (!shouldSkipStepRestore) {
            const currentStep = window.registrationCurrentStep || 1;
            if (savedStepNum >= currentStep && savedStepNum > 1) goToStep(savedStepNum);
        }

    } catch (e) {
        console.error('[Restore] Error:', e);
    } finally {
        window.isProgrammaticChange = false;
    }
}


/* -------------------------------------
   Clear registration
------------------------------------- */
function clearRegistrationData() {
    Object.values(STORAGE).forEach(key => sessionStorage.removeItem(key));
}


/* -------------------------------------
     Check URL parameters for email verification
   ------------------------------------- */

async function checkURLParams() {

    // For hash-based routing, parameters come in the hash fragment
    // Format: #/multi-step-register?token=...&email=...
    // NOT in window.location.search

    let urlParams = new URLSearchParams();
    let token = null;
    let email = null;
    let error = null;

    // First, try to parse from hash (this is the correct way for SPA routing)
    if (window.location.hash.includes('?')) {
        const hashQueryString = window.location.hash.split('?')[1];
        urlParams = new URLSearchParams(hashQueryString);
        token = urlParams.get('token');
        email = urlParams.get('email');
        error = urlParams.get('error');
        console.log('[checkURLParams] Parsed from hash:', { token: !!token, email, error });
    }

    // Fallback: check regular URL search params (for backwards compatibility)
    if (!token && !email && !error && window.location.search) {
        urlParams = new URLSearchParams(window.location.search);
        token = urlParams.get('token');
        email = urlParams.get('email');
        error = urlParams.get('error');
        console.log('[checkURLParams] Parsed from search:', { token: !!token, email, error });
    }

    // GUARD: If we're on Step 4+ and there's no token/error in URL, skip redirect logic
    // This prevents unwanted redirects when user is filling out Step 4 (continent/country selection)
    // Read from sessionStorage first since global variable might not be set yet
    const savedStep = sessionStorage.getItem(STORAGE.STEP);
    const currentStep = savedStep ? parseInt(savedStep, 10) : (window.registrationCurrentStep || 1);

    const hasUrlParams = token || email || error;

    console.log('[checkURLParams] Debug:', {
        savedStep,
        currentStep,
        globalStep: window.registrationCurrentStep,
        hasUrlParams,
        token: !!token,
        email: !!email,
        error: !!error,
        hash: window.location.hash,
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
            if (email) {
                emailInput.value = decodeURIComponent(email);
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

            // CRITICAL FIX: Only go to step 3 if user hasn't progressed past it
            // This prevents redirecting from Step 4+ back to Step 3 when selecting continent
            if (currentStep <= 3) {
                console.log('[checkURLParams] User on Step 1-3, navigating to Step 3 to show verification');
                goToStep(3);
                restoreFormData(true);
            } else {
                console.log('[checkURLParams] User already on Step 4+, staying on current step');
                // Just restore form data without changing the step
                restoreFormData();
            }
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

        // IMPORTANT: Set step to 3 BEFORE any restore operations
        sessionStorage.setItem(STORAGE.STEP, '3');
        window.registrationCurrentStep = 3;

        // Restore draft data from backend before rendering form
        await getDraft(verifiedEmail);

        // Restore form data (but skip step restore since we already set it)
        restoreFormData(true);

        // Navigate to step 3 to show the email verification step
        goToStep(3);

        // Update UI to show verified state AFTER navigation
        const emailVerifiedDiv = document.getElementById('emailVerified');
        const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
        const nextBtn = document.getElementById('emailNextBtn');
        const verifiedInput = document.getElementById('verifiedEmail');

        if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
        if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
        if (nextBtn) nextBtn.disabled = false;
        if (verifiedInput) verifiedInput.value = verifiedEmail;

        if (window.showToast) window.showToast('Email Verified Successfully!', 'success');
        else if (window.toastr) window.toastr.success('Email Verified Successfully!');
    } else {
        // No email verification in URL, just restore form data normally
        restoreFormData();
    }
}


/* -------------------------------------
      Load institutes from API
   ------------------------------------- */

const REF_CACHE_KEY = 'reference_data_cache';

/* -------------------------------------
   Load Institutes
------------------------------------- */
async function loadInstitutes() {
    const select = document.getElementById('institute');
    if (!select) return;

    if (cachedInstitutes) {
        populateInstitutesSelect(select, cachedInstitutes);
        return;
    }

    const sessionCache = JSON.parse(sessionStorage.getItem('reference_data_cache') || '{}');
    if (sessionCache.institutes?.length > 0) {
        cachedInstitutes = sessionCache.institutes;
        populateInstitutesSelect(select, cachedInstitutes);
        return;
    }

    if (isFetchingInstitutes) return;
    isFetchingInstitutes = true;

    select.disabled = true;
    select.innerHTML = '<option>Loading...</option>';

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/reference/institutes`);
        if (!res.ok) throw new Error(res.statusText);

        const data = await res.json();
        const institutes = Array.isArray(data) ? data : data.institutes || [];

        cachedInstitutes = institutes;
        sessionCache.institutes = institutes;
        sessionStorage.setItem('reference_data_cache', JSON.stringify(sessionCache));

        populateInstitutesSelect(select, institutes);
    } catch (e) {
        console.error('Error loading institutes:', e);
        select.innerHTML = '<option value="">-- Failed --</option>';
        showError('Failed to load institutes');
    } finally {
        isFetchingInstitutes = false;
        select.disabled = false;
    }
}

function populateInstitutesSelect(select, institutes) {
    select.innerHTML = '<option value="">-- Select Institute --</option>';
    institutes.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = `${i.name} (${i.city}, ${i.country})`;
        select.appendChild(opt);
    });

    // Restore saved selection
    const saved = JSON.parse(sessionStorage.getItem(STORAGE.FORM) || '{}');
    if (saved.institute_id) select.value = saved.institute_id;
}

/* -------------------------------------
   Load Continents
------------------------------------- */
async function loadContinents(force = false) {
    if (!force && window.continentsLoaded) return;
    if (!force && window.continentsLoadPromise) return window.continentsLoadPromise;

    window.continentsLoadPromise = (async () => {
        const continentSelect = document.getElementById('continent');
        if (!continentSelect) return;

        if (!force && cachedContinents?.length > 0) {
            populateContinentsSelect(continentSelect, cachedContinents);
            window.continentsLoaded = true;
            return;
        }

        const sessionCache = JSON.parse(sessionStorage.getItem('reference_data_cache') || '{}');
        if (!force && sessionCache.continents?.length > 0) {
            cachedContinents = sessionCache.continents;
            populateContinentsSelect(continentSelect, cachedContinents);
            window.continentsLoaded = true;
            return;
        }

        // Session Storage circuit breaker to survive full page reloads
        const now = Date.now();
        let cFetchStart = parseInt(sessionStorage.getItem('_continentFetchWindowStart') || '0', 10);
        let cFetchCount = parseInt(sessionStorage.getItem('_continentFetchCount') || '0', 10);

        if (now - cFetchStart > 3000) {
            sessionStorage.setItem('_continentFetchWindowStart', now.toString());
            sessionStorage.setItem('_continentFetchCount', '1');
            cFetchCount = 1;
        } else {
            cFetchCount++;
            sessionStorage.setItem('_continentFetchCount', cFetchCount.toString());
        }

        if (cFetchCount > 10) {
            console.error('[loadContinents] HARD LOOP DETECTED. Blocking API calls for 10 seconds.');
            sessionStorage.setItem('_continentFetchWindowStart', (now + 10000).toString());
            return;
        }

        isFetchingContinents = true;
        continentSelect.innerHTML = '<option>Loading...</option>';

        if (continentsAbortController) continentsAbortController.abort();
        continentsAbortController = new AbortController();

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/reference/continents`, {
                signal: continentsAbortController.signal
            });
            if (!res.ok) throw new Error(res.statusText);

            const data = await res.json();
            const continents = Array.isArray(data) ? data : data.continents || [];

            cachedContinents = continents;
            sessionCache.continents = continents;
            sessionStorage.setItem('reference_data_cache', JSON.stringify(sessionCache));
            window.continentsLoaded = true;

            populateContinentsSelect(continentSelect, continents);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Error loading continents:', e);
                continentSelect.innerHTML = '<option>Failed to load</option>';
            }
        } finally {
            isFetchingContinents = false;
        }
    })();

    return window.continentsLoadPromise;
}

function populateContinentsSelect(select, continents) {
    const current = select.value;
    select.innerHTML = '<option value="">-- Select Continent --</option>';
    continents.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.name;
        select.appendChild(opt);
    });
    if (current) select.value = current;

    if (!continentChangeHandlerAttached) {
        select.addEventListener('change', async function () {
            if (window.isProgrammaticChange || window.isLoadingCountries) return;
            const val = this.value;
            if (val === window.lastProcessedContinentId) return;
            window.lastProcessedContinentId = val;
            window.isLoadingCountries = true;
            saveFormData();
            await loadCountries();
            window.isLoadingCountries = false;
        });
        continentChangeHandlerAttached = true;
    }
}

/* -------------------------------------
   Load Countries
------------------------------------- */
async function loadCountries() {
    const continentSelect = document.getElementById('continent');
    const continentId = continentSelect?.value;
    if (!continentId) return;

    // Session Storage circuit breaker to survive full page reloads and back/forward caching loops
    const now = Date.now();
    let fetchStart = parseInt(sessionStorage.getItem('_countryFetchWindowStart') || '0', 10);
    let fetchCount = parseInt(sessionStorage.getItem('_countryFetchCount') || '0', 10);

    if (now - fetchStart > 3000) {
        sessionStorage.setItem('_countryFetchWindowStart', now.toString());
        sessionStorage.setItem('_countryFetchCount', '1');
        fetchCount = 1;
    } else {
        fetchCount++;
        sessionStorage.setItem('_countryFetchCount', fetchCount.toString());
    }

    if (fetchCount > 10) {
        console.error('[loadCountries] HARD LOOP DETECTED. Blocking API calls for 10 seconds.');
        sessionStorage.setItem('_countryFetchWindowStart', (now + 10000).toString()); // Block for 10 secs
        return;
    }

    if (window.currentLoadedContinentId === continentId) return;
    if (currentCountriesLoadPromise && currentFetchingContinentId === continentId) return currentCountriesLoadPromise;

    currentFetchingContinentId = continentId;
    window.isLoadingCountries = true;

    const countrySelect = document.getElementById('country');
    if (countrySelect) {
        countrySelect.innerHTML = '<option value="">Loading...</option>';
        countrySelect.disabled = true;
    }

    currentCountriesLoadPromise = (async () => {
        if (countriesAbortController) countriesAbortController.abort();
        countriesAbortController = new AbortController();

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/api/reference/countries?continent_id=${continentId}`, {
                signal: countriesAbortController.signal
            });
            if (!res.ok) throw new Error(res.statusText);

            const data = await res.json();
            const countries = Array.isArray(data) ? data : data.countries || [];

            window.currentLoadedContinentId = continentId;

            if (countrySelect) {
                const wasLock = window.isProgrammaticChange;
                window.isProgrammaticChange = true;
                countrySelect.innerHTML = '<option value="">-- Select Country --</option>';
                countries.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = String(c.id);
                    opt.textContent = c.name;
                    if (c.phone_code) opt.dataset.phoneCode = c.phone_code;
                    countrySelect.appendChild(opt);
                });
                countrySelect.disabled = false;
                window.isProgrammaticChange = wasLock;
            }

            return countries;
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('[loadCountries] Error:', e);
                if (countrySelect) countrySelect.innerHTML = '<option>-- Error --</option>';
            }
        } finally {
            window.isLoadingCountries = false;
            if (currentFetchingContinentId === continentId) {
                currentCountriesLoadPromise = null;
                currentFetchingContinentId = null;
            }
        }
    })();

    return currentCountriesLoadPromise;
}





/* -------------------------------------
   Auto-Save
------------------------------------- */
function autoSaveFormData() {
    if (window.isProgrammaticChange || window.isLoadingCountries || window._isFetchingDraft) return;
    saveFormData();
    // Removed automatic API save Draft here
    // Draft will only be saved when clicking "Next"
}

function initializeAutoSave() {
    Object.values(FIELD_MAP).forEach(fid => {
        const el = document.getElementById(fid);
        if (!el) return;

        if (fid !== 'continent' && fid !== 'country') {
            el.addEventListener('input', autoSaveFormData);
            el.addEventListener('change', autoSaveFormData);
        }

        if (fid === 'country') {
            const handler = () => { if (!window.isProgrammaticChange) saveFormData(); };
            el.addEventListener('input', handler);
            el.addEventListener('change', handler);
        }

        if (fid === 'email') {
            el.addEventListener('blur', function () {
                if (this.value && validateEmail(this.value) && this.value !== lastFetchedDraftEmail) getDraft(this.value);
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
    Object.keys(FIELD_MAP).forEach(key => {
        const el = document.getElementById(getFieldId(key));
        formData[key] = el?.value || '';
    });

    if (!formData.email || !formData.institute_id) {
        const saved = JSON.parse(sessionStorage.getItem(STORAGE.FORM) || '{}');
        formData.email ||= saved.email;
        formData.institute_id ||= saved.institute_id;
    }

    if (!formData.email || !formData.institute_id || !validateEmail(formData.email)) return;

    if (verificationToken) formData.token = verificationToken;
    if (verifiedEmail) formData.verified_email = verifiedEmail;
    if (window.registrationCurrentStep) formData.current_step = window.registrationCurrentStep;

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/registration/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (!res.ok) console.warn('Draft save failed', res.status);
        else console.log('Draft saved successfully');
    } catch (e) {
        console.warn('Network error saving draft', e);
    }
}

async function getDraft(email) {
    if (!email || email === lastFetchedDraftEmail || window._isFetchingDraft) return;
    window._isFetchingDraft = true;

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/registration/draft/${email}`);
        if (!res.ok) return;

        const data = await res.json();
        const draft = data.draft;
        lastFetchedDraftEmail = email;

        if (draft) {
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

            const currentData = JSON.parse(sessionStorage.getItem(STORAGE.FORM) || '{}');
            sessionStorage.setItem(STORAGE.FORM, JSON.stringify({ ...currentData, ...draft }));
        }
    } catch (e) { console.error('Error fetching draft:', e); }
    finally { window._isFetchingDraft = false; }
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

    // Find the button to disable it
    // We don't have a direct ID for the button in the HTML provided (Step 661), 
    // it's an onclick handler on a generic button. 
    // So we'll try to find it by context or add an ID if possible, but simplest is 
    // to search for the button within the step-content[data-step="3"] container.
    const step3 = document.querySelector('.step-content[data-step="3"]');
    const sendBtn = step3 ? step3.querySelector('button[onclick*="sendVerificationEmail"]') : null;
    let originalText = '';

    if (sendBtn) {
        sendBtn.disabled = true;
        originalText = sendBtn.innerText;
        sendBtn.innerText = 'Sending...';
    }

    // CRITICAL: Save current step BEFORE any async operations
    const currentStep = window.registrationCurrentStep || 3;
    sessionStorage.setItem(STORAGE.STEP, currentStep.toString());
    console.log('[sendVerificationEmail] Saved current step:', currentStep);

    // Save draft before sending verification email to prevent data loss 
    // if user opens link in a new tab/device
    saveFormData();
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
            const successMsg = `Verification email sent to ${email}! Please check your inbox.`;
            if (window.toastr) {
                window.toastr.success(successMsg);
            } else if (window.showToast) {
                window.showToast(successMsg, 'success');
            } else {
                alert(successMsg);
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
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerText = originalText || 'Send Verification Link';
        }
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

async function nextStep() {
    // Validate current step before moving forward
    if (!validateStep(window.registrationCurrentStep)) return;

    saveFormData();
    await saveDraft();

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
    // Remove active class from ALL steps (not just the current one)
    // This ensures we don't have multiple steps visible at once
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach(el => el.classList.remove('active'));

    // Mark previous steps completed
    for (let i = 1; i < step; i++) {
        document
            .querySelector(`.progress-step[data-step="${i}"]`)
            ?.classList.add('completed');
    }

    // Update current step
    window.registrationCurrentStep = step;

    // Activate the new step
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
                // Modified: Using window.showToast or alert since toastr might not be available
                if (window.showToast) window.showToast('Please verify your email before proceeding', 'error');
                else if (window.toastr) window.toastr.error('Please verify your email before proceeding');
                else alert('Please verify your email before proceeding');
                return false;
            }
            return true;

        case 4:
            return (
                validateField('continent', 'Please select a continent') &&
                validateField('country', 'Please select a country') &&
                validateField('addressLine1', 'Address is required') &&
                validateField('city', 'City is required') &&
                validateField('state', 'State is required') &&
                validateField('postalCode', 'Postal code is required') &&
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
    if (window._registrationMountLock) {
        console.log('Mount prevented (already mounting)');
        return;
    }

    window._registrationMountLock = true;

    setTimeout(() => {
        window._registrationMountLock = false;
    }, 500);
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
        console.log('[Mount] No saved step, default to 1');
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
            const sessionCache = JSON.parse(sessionStorage.getItem('reference_data_cache') || '{}');
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
        const continentSelect = document.getElementById('continent');

        // Reset the flag since SPARouter destroys the DOM and the event listener is lost!
        continentChangeHandlerAttached = false;

        if (!cachedContinents && !isFetchingContinents) {
            const sessionCache = JSON.parse(sessionStorage.getItem('reference_data_cache') || '{}');
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
    // window.currentLoadedContinentId = null; // DISABLED: Prevent aggressive clearing
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
