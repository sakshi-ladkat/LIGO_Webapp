const API = 'http://127.0.0.1:8000/api';

// Registration State
let registrationCurrentStep = 1;
const totalSteps = 5;
let verificationToken = null;
let verifiedEmail = null;

// Flags to prevent duplicate loads
let institutesLoaded = false;
let continentsLoaded = false;

// Session storage keys
const STORAGE_KEY = 'registration_form_data';
const STORAGE_STEP_KEY = 'registration_current_step';
const STORAGE_TOKEN_KEY = 'registration_verification_token';
const STORAGE_EMAIL_KEY = 'registration_verified_email';

// --- Form Data Management ---

function saveFormData() {
    const formData = {
        institute_id: document.getElementById('institute')?.value || '',
        first_name: document.getElementById('firstName')?.value || '',
        middle_name: document.getElementById('middleName')?.value || '',
        last_name: document.getElementById('lastName')?.value || '',
        suffix: document.getElementById('suffix')?.value || '',
        email: document.getElementById('email')?.value || '',
        address_line1: document.getElementById('addressLine1')?.value || '',
        address_line2: document.getElementById('addressLine2')?.value || '',
        address_line3: document.getElementById('addressLine3')?.value || '',
        city: document.getElementById('city')?.value || '',
        state: document.getElementById('state')?.value || '',
        postal_code: document.getElementById('postalCode')?.value || '',
        continent: document.getElementById('continent')?.value || '',
        country: document.getElementById('country')?.value || '',
        office_country_code: document.getElementById('officeCountryCode')?.value || '',
        office_city_code: document.getElementById('officeCityCode')?.value || '',
        office_number: document.getElementById('officeNumber')?.value || '',
        fax_number: document.getElementById('faxNumber')?.value || '',
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    sessionStorage.setItem(STORAGE_STEP_KEY, registrationCurrentStep.toString());

    if (verificationToken) sessionStorage.setItem(STORAGE_TOKEN_KEY, verificationToken);
    if (verifiedEmail) sessionStorage.setItem(STORAGE_EMAIL_KEY, verifiedEmail);
}

function restoreFormData(skipStepRestore = false) {
    const savedData = sessionStorage.getItem(STORAGE_KEY);
    const savedStep = sessionStorage.getItem(STORAGE_STEP_KEY);
    const savedToken = sessionStorage.getItem(STORAGE_TOKEN_KEY);
    const savedEmail = sessionStorage.getItem(STORAGE_EMAIL_KEY);

    if (savedToken && savedEmail) {
        verificationToken = savedToken;
        verifiedEmail = savedEmail;
    }

    if (savedData) {
        try {
            const formData = JSON.parse(savedData);
            Object.keys(formData).forEach(key => {
                const element = document.getElementById(getFieldId(key));
                if (element && formData[key]) {
                    element.value = formData[key];
                    if (element.tagName === 'SELECT' && element.id !== 'continent') {
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });

            if (formData.continent) {
                const continentSelect = document.getElementById('continent');
                if (continentSelect) {
                    continentSelect.value = formData.continent;
                    setTimeout(async () => {
                        await loadCountries(formData.continent);
                        const countrySelect = document.getElementById('country');
                        if (countrySelect && formData.country) {
                            countrySelect.value = formData.country;
                        }
                    }, 100);
                }
            }
        } catch (e) {
            console.error('Error restoring form data:', e);
        }
    }

    if (!skipStepRestore && savedStep && !window.location.hash.includes('token=') && !window.location.hash.includes('email=')) {
        const step = parseInt(savedStep);
        if (step > 1 && step <= totalSteps) {
            setTimeout(() => goToStep(step), 200);
        }
    }
}

function getFieldId(key) {
    const mapping = {
        'institute_id': 'institute',
        'first_name': 'firstName',
        'middle_name': 'middleName',
        'last_name': 'lastName',
        'suffix': 'suffix',
        'email': 'email',
        'address_line1': 'addressLine1',
        'address_line2': 'addressLine2',
        'address_line3': 'addressLine3',
        'city': 'city',
        'state': 'state',
        'postal_code': 'postalCode',
        'continent': 'continent',
        'country': 'country',
        'office_country_code': 'officeCountryCode',
        'office_city_code': 'officeCityCode',
        'office_number': 'officeNumber',
        'fax_number': 'faxNumber',
    };
    return mapping[key] || key;
}

function clearRegistrationData() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_STEP_KEY);
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_EMAIL_KEY);
}

// --- API Loading Functions (With Fixes) ---

async function loadInstitutes() {
    if (institutesLoaded) {
        console.log('[Registration] Institutes already loaded/loading, skipping');
        return;
    }
    institutesLoaded = true; // Optimistic lock
    console.trace('[Registration] loadInstitutes called');

    try {
        const res = await fetch(`${API}/reference/institutes`);
        const institutes = await res.json();

        if (!Array.isArray(institutes)) {
            console.error('[Registration] Institutes API not array:', institutes);
            // institutesLoaded remains true
            return;
        }

        const select = document.getElementById('institute');
        if (!select) return;

        select.innerHTML = '<option value="">Select Institute</option>';
        institutes.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i.id;
            opt.textContent = `${i.name} (${i.city}, ${i.country})`;
            select.appendChild(opt);
        });

        console.log('[Registration] Institutes loaded');

        // Restore selection if exists
        const savedData = sessionStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const formData = JSON.parse(savedData);
            if (formData.institute_id) select.value = formData.institute_id;
        }

    } catch (err) {
        console.error('[Registration] Failed to load institutes:', err);
        // institutesLoaded remains true
    }
}

async function loadContinents() {
    if (continentsLoaded) {
        console.log('[Registration] Continents already loaded/loading, skipping');
        return;
    }
    continentsLoaded = true; // Optimistic lock
    console.trace('[Registration] loadContinents called');

    try {
        const res = await fetch(`${API}/reference/continents`);
        const continents = await res.json();

        if (!Array.isArray(continents)) {
            console.error('[Registration] Continents API not array:', continents);
            // continentsLoaded remains true
            return;
        }

        const select = document.getElementById('continent');
        if (!select) return;

        select.innerHTML = '<option value="">Select Continent</option>';
        continents.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            select.appendChild(opt);
        });

        console.log(`[Registration] Loaded ${continents.length} continents`);

    } catch (err) {
        console.error('[Registration] Failed to load continents:', err);
        // continentsLoaded remains true
    }
}

async function loadCountries(continentId) {
    if (!continentId) {
        const continentSelect = document.getElementById('continent');
        if (continentSelect) continentId = continentSelect.value;
    }

    if (!continentId) {
        const countrySelect = document.getElementById('country');
        if (countrySelect) countrySelect.innerHTML = '<option value="">Select Continent First</option>';
        return;
    }

    try {
        console.log(`[Registration] Fetching countries for continent_id: ${continentId}`);
        const res = await fetch(`${API}/reference/countries?continent_id=${encodeURIComponent(continentId)}`);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('[Registration] Country fetch failed:', res.status, errorText);
            return;
        }

        const countries = await res.json();
        const select = document.getElementById('country');
        if (!select) return;

        select.innerHTML = '<option value="">Select Country</option>';
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            select.appendChild(opt);
        });

    } catch (err) {
        console.error('[Registration] Failed to load countries:', err);
    }
}

function resetRegistrationData() {
    console.log('[Registration] Resetting data flags');
    institutesLoaded = false;
    continentsLoaded = false;
}

// --- Verification & Submission ---

function checkURLParams() {
    let urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');
    let email = urlParams.get('email');

    if (!token && window.location.hash.includes('?')) {
        try {
            const hashQueryString = window.location.hash.split('?')[1];
            const hashParams = new URLSearchParams(hashQueryString);
            token = hashParams.get('token');
            email = hashParams.get('email');
        } catch (e) {
            console.error('Error parsing hash params:', e);
        }
    }

    if (token && email) {
        verificationToken = token;
        verifiedEmail = decodeURIComponent(email);
        sessionStorage.setItem(STORAGE_TOKEN_KEY, verificationToken);
        sessionStorage.setItem(STORAGE_EMAIL_KEY, verifiedEmail);
        restoreFormData(true);

        const emailInput = document.getElementById('email');
        const verifiedEmailInput = document.getElementById('verifiedEmail');
        const emailVerifiedDiv = document.getElementById('emailVerified');
        const emailNotVerifiedDiv = document.getElementById('emailNotVerified');
        const nextBtn = document.getElementById('emailNextBtn');

        if (emailInput) { emailInput.value = verifiedEmail; emailInput.readOnly = true; }
        if (verifiedEmailInput) { verifiedEmailInput.value = verifiedEmail; verifiedEmailInput.readOnly = true; }
        if (emailNotVerifiedDiv) emailNotVerifiedDiv.style.display = 'none';
        if (emailVerifiedDiv) emailVerifiedDiv.style.display = 'block';
        if (nextBtn) nextBtn.disabled = false;

        if (typeof toastr !== 'undefined') toastr.success('Email verified successfully!');
        goToStep(3);
    } else {
        restoreFormData();
    }
}

async function sendVerificationEmail() {
    const email = document.getElementById('email').value;
    if (!email || !validateEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        return;
    }

    try {
        const response = await fetch(`${API}/registration/send-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok) {
            toastr.success('Verification email sent! Please check your inbox.');
        } else {
            toastr.error(data.message || 'Failed to send verification email');
        }
    } catch (error) {
        console.error('Error sending verification email:', error);
        toastr.error('Failed to send verification email.');
    }
}

async function resendVerification(email) {
    if (!email) return;
    try {
        const response = await fetch(`${API}/registration/send-verification`, { // Fallback to send-verification if resend not exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (response.ok) toastr.success('Verification link sent again.');
        else toastr.error('Could not resend verification email.');
    } catch (e) {
        toastr.error('Network error.');
    }
}

async function submitRegistration() {
    if (!validateStep(4)) return;
    if (!verificationToken || !verifiedEmail) {
        toastr.error('Email verification required.');
        goToStep(3);
        return;
    }

    const savedData = sessionStorage.getItem(STORAGE_KEY);
    let savedFormData = {};
    if (savedData) {
        try { savedFormData = JSON.parse(savedData); } catch (e) { }
    }
    const getFieldValue = (fieldId, storageKey) => {
        return document.getElementById(fieldId)?.value || savedFormData[storageKey] || '';
    };

    const formData = {
        token: verificationToken,
        email: verifiedEmail,
        institute_id: getFieldValue('institute', 'institute_id'),
        first_name: getFieldValue('firstName', 'first_name'),
        middle_name: getFieldValue('middleName', 'middle_name'),
        last_name: getFieldValue('lastName', 'last_name'),
        suffix: getFieldValue('suffix', 'suffix'),
        address_line1: getFieldValue('addressLine1', 'address_line1'),
        address_line2: getFieldValue('addressLine2', 'address_line2'),
        address_line3: getFieldValue('addressLine3', 'address_line3'),
        city: getFieldValue('city', 'city'),
        state: getFieldValue('state', 'state'),
        postal_code: getFieldValue('postalCode', 'postal_code'),
        continent: getFieldValue('continent', 'continent'),
        country: getFieldValue('country', 'country'),
        office_country_code: getFieldValue('officeCountryCode', 'office_country_code'),
        office_city_code: getFieldValue('officeCityCode', 'office_city_code'),
        office_number: getFieldValue('officeNumber', 'office_number'),
        fax_number: getFieldValue('faxNumber', 'fax_number'),
    };

    try {
        const response = await fetch(`${API}/registration/save-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await response.json();

        if (response.ok) {
            toastr.success('Registration successful!');
            clearRegistrationData();
            // Show summary logic
            const summaryHtml = `<h3 style="margin-bottom: 10px; color: #475569;">Submission Summary</h3>` +
                `<p><strong>Name:</strong> ${formData.first_name} ${formData.last_name}</p>` +
                `<p><strong>Email:</strong> ${formData.email}</p>` +
                `<p><strong>Location:</strong> ${formData.city}, ${formData.country}</p>`;
            const summaryEl = document.getElementById('registrationSummary');
            if (summaryEl) {
                summaryEl.innerHTML = summaryHtml;
                summaryEl.style.display = 'block';
            }
            nextStep();
        } else {
            console.error('Registration error:', data);
            toastr.error(data.message || 'Registration failed.');
        }
    } catch (error) {
        console.error('Error submitting registration:', error);
        toastr.error('Registration failed.');
    }
}

// --- Navigation & Validation ---

function nextStep() {
    if (!validateStep(registrationCurrentStep)) return;
    saveFormData();
    if (registrationCurrentStep < totalSteps) goToStep(registrationCurrentStep + 1);
}

function prevStep() {
    saveFormData();
    if (registrationCurrentStep > 1) goToStep(registrationCurrentStep - 1);
}

function goToStep(step) {
    const currentStepEl = document.querySelector(`.step-content[data-step="${registrationCurrentStep}"]`);
    const currentProgressEl = document.querySelector(`.progress-step[data-step="${registrationCurrentStep}"]`);
    if (currentStepEl) currentStepEl.classList.remove('active');
    if (currentProgressEl) currentProgressEl.classList.remove('active');

    for (let i = 1; i < step; i++) {
        const prevProgressEl = document.querySelector(`.progress-step[data-step="${i}"]`);
        if (prevProgressEl) prevProgressEl.classList.add('completed');
    }

    registrationCurrentStep = step;
    const newStepEl = document.querySelector(`.step-content[data-step="${registrationCurrentStep}"]`);
    const newProgressEl = document.querySelector(`.progress-step[data-step="${registrationCurrentStep}"]`);
    if (newStepEl) newStepEl.classList.add('active');
    if (newProgressEl) newProgressEl.classList.add('active');

    sessionStorage.setItem(STORAGE_STEP_KEY, registrationCurrentStep.toString());
    window.scrollTo(0, 0);
}

function validateStep(step) {
    let isValid = true;
    switch (step) {
        case 1: isValid = validateField('institute', 'Please select an institute'); break;
        case 2: isValid = validateField('firstName', 'First name is required') && validateField('lastName', 'Last name is required'); break;
        case 3:
            if (!verificationToken || !verifiedEmail) {
                toastr.error('Please verify your email before proceeding');
                isValid = false;
            }
            break;
        case 4:
            isValid = validateField('addressLine1', 'Address is required') &&
                validateField('city', 'City is required') &&
                validateField('state', 'State is required') &&
                validateField('postalCode', 'Postal code is required') &&
                validateField('continent', 'Please select a continent') &&
                validateField('country', 'Please select a country') &&
                validateField('officeCountryCode', 'Country code is required') &&
                validateField('officeNumber', 'Office number is required');
            break;
    }
    return isValid;
}

function validateField(fieldId, errorMessage) {
    const field = document.getElementById(fieldId);
    if (!field) return true;
    if (!field.value.trim()) {
        showFieldError(fieldId, errorMessage);
        return false;
    }
    hideFieldError(fieldId);
    return true;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = field.nextElementSibling;
    field.classList.add('error');
    if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    } else {
        toastr.error(message);
    }
}

function hideFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = field.nextElementSibling;
    field.classList.remove('error');
    if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.classList.remove('show');
    }
}

// Auto Save
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
const autoSaveFormData = debounce(saveFormData, 500);

function initializeAutoSave() {
    const formFields = [
        'institute', 'firstName', 'middleName', 'lastName', 'suffix',
        'email', 'addressLine1', 'addressLine2', 'addressLine3',
        'city', 'state', 'postalCode', 'continent', 'country',
        'officeCountryCode', 'officeCityCode', 'officeNumber', 'faxNumber'
    ];
    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', autoSaveFormData);
            field.addEventListener('change', autoSaveFormData);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutoSave);
} else {
    setTimeout(initializeAutoSave, 100);
}

// Export
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
window.resetRegistrationData = resetRegistrationData; // Added my fix

console.log('[Registration] registration.js loaded & functions exposed');
