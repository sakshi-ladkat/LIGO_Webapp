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

    if (savedToken && savedEmail) {
        verificationToken = savedToken;
        verifiedEmail = savedEmail;
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

            // 2️⃣ Restore continent → load countries → restore country
            if (formData.continent) {
                const continentSelect = document.getElementById(getFieldId('continent'));

                if (continentSelect) {
                    continentSelect.value = formData.continent;

                    await loadCountries(); // wait for countries API

                    if (formData.country) {
                        const countrySelect = document.getElementById(getFieldId('country'));
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
        console.log('Verification successful via params.');
        verificationToken = token;
        verifiedEmail = decodeURIComponent(email);

        // Save to sessionStorage
        sessionStorage.setItem(STORAGE.TOKEN, verificationToken);
        sessionStorage.setItem(STORAGE.EMAIL, verifiedEmail);

        // Restore draft data from backend before rendering form
        await getDraft(verifiedEmail);

        // Restore form data from sessionStorage (which now includes backend draft)
        // Pass true to skip step restore as we force step 4
        restoreFormData(true);

        // Mark email as verified and lock fields
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

        if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
        if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
        if (nextBtn) nextBtn.disabled = false;

        // Show success message
        if (window.toastr) {
            window.toastr.success('Email verified successfully!');
        } else if (window.showToast) {
            window.showToast('Email verified successfully!', 'success');
        }

        // Navigate to Step 4 (Address/Contact Info) as requested
        goToStep(4);
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

let continentsAbortController = null;

async function loadContinents() {
    console.log('loadContinents() called');

    const select = document.getElementById('continent');
    if (!select) return;

    // 1. Check module cache
    if (cachedContinents) {
        populateContinentsSelect(select, cachedContinents);
        return;
    }

    // 2. Lock check - CRITICAL
    if (isFetchingContinents) {
        console.warn('loadContinents already in progress... skipping');
        return;
    }

    // 3. Check session storage cache
    const sessionCache = getRefCache();
    if (sessionCache.continents?.length > 0) {
        console.log('Using session cached continents');
        cachedContinents = sessionCache.continents;
        populateContinentsSelect(select, cachedContinents);
        return;
    }

    isFetchingContinents = true;

    // Add loading state
    select.disabled = true;
    select.innerHTML = '<option>Loading...</option>';

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

        populateContinentsSelect(select, cachedContinents);

    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error loading continents:', error);
        showError('Failed to load continents');
        select.innerHTML = '<option value="">-- Failed to load --</option>';
    } finally {
        isFetchingContinents = false;
        select.disabled = false;
    }
}

function populateContinentsSelect(select, continents) {
    select.innerHTML = '<option value="">-- Select Continent --</option>';

    continents.forEach(continent => {
        const option = document.createElement('option');
        option.value = continent.id; // Use ID as value
        option.textContent = continent.name;
        select.appendChild(option);
    });

    // Restore saved continent
    const savedData = sessionStorage.getItem(STORAGE.FORM);
    if (savedData) {
        const formData = JSON.parse(savedData);
        if (formData?.continent) {
            select.value = formData.continent;

            // Trigger loading of countries
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

let countriesAbortController = null;

/* -------------------------------------
   Load countries based on continent (Improved)
------------------------------------- */
async function loadCountries() {
    const continentSelect = document.getElementById('continent');
    const countrySelect = document.getElementById('country');

    if (!continentSelect || !countrySelect) {
        console.error('Continent or Country select element not found');
        return;
    }

    const continentId = continentSelect.value;

    if (!continentId) {
        countrySelect.innerHTML = '<option value="">-- Select Continent First --</option>';
        return;
    }

    // Cancel any previous pending request (prevents race condition)
    if (countriesAbortController) {
        countriesAbortController.abort();
    }
    countriesAbortController = new AbortController();

    // Show loading state
    countrySelect.innerHTML = '<option value="">Loading countries...</option>';
    countrySelect.disabled = true;

    try {
        // Use GET and query param as per api.php and LocationController
        // Also note: api.php route is 'countries', not 'countries-by-continent' (checked in previous steps)
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
        // Handle plain array response from backend
        const countries = Array.isArray(data) ? data : (data.countries || []);

        countrySelect.innerHTML = '<option value="">-- Select Country --</option>';

        if (!countries.length) {
            showError('No countries available for selected continent');
            return;
        }

        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.id; // Use ID as value
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });

        // Restore previously selected country (if exists)
        const savedData = sessionStorage.getItem(STORAGE.FORM);
        if (savedData) {
            try {
                const formData = JSON.parse(savedData);
                if (formData?.country) {
                    countrySelect.value = formData.country;
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

    } finally {
        countrySelect.disabled = false;
    }
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

        toastr.success('Registration successful!');
        clearRegistrationData();
        nextStep();

    } catch (error) {
        console.error(error);
        toastr.error('Network error. Please try again.');
    }
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
                    // Only fetch if we haven't already fetched for this email
                    if (this.value !== lastFetchedDraftEmail) {
                        getDraft(this.value);
                    }
                }
            });
        }
    });

    console.log('Auto-save listeners attached');
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
        if (!cachedContinents && !isFetchingContinents) {
            const sessionCache = getRefCache();
            if (sessionCache.continents?.length > 0) {
                console.log('Mount: Found session cached continents');
                cachedContinents = sessionCache.continents;
                populateContinentsSelect(document.getElementById('continent'), cachedContinents);
            } else {
                console.log('Mount: Initiating loadContinents');
                loadContinents?.();
            }
        } else {
            if (cachedContinents) {
                populateContinentsSelect(document.getElementById('continent'), cachedContinents);
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