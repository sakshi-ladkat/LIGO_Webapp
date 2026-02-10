// Registration JavaScript
let registrationCurrentStep = 1;
const totalSteps = 5;
let verificationToken = null;
let verifiedEmail = null;


// Check URL parameters for email verification
function checkURLParams() {
    // Check standard search params
    let urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');
    let email = urlParams.get('email');

    // If not found, check hash params (common in SPAs with hash routing)
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
        console.log('Verification successful via params.');
        verificationToken = token;
        verifiedEmail = decodeURIComponent(email);

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
        if (typeof toastr !== 'undefined') {
            toastr.success('Email verified successfully!');
        }

        // Navigate to Step 3
        goToStep(3);
    }
}

// Load institutes from API
async function loadInstitutes() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/institutes`);
        const data = await response.json();

        const select = document.getElementById('institute');
        select.innerHTML = '<option value="">-- Select Institute --</option>';

        data.institutes.forEach(institute => {
            const option = document.createElement('option');
            option.value = institute.id;
            option.textContent = `${institute.name} (${institute.city}, ${institute.country})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading institutes:', error);
        showError('Failed to load institutes. Please refresh the page.');
    }
}

// Load continents
async function loadContinents() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/continents`);
        const data = await response.json();

        const select = document.getElementById('continent');
        select.innerHTML = '<option value="">-- Select Continent --</option>';

        data.continents.forEach(continent => {
            const option = document.createElement('option');
            option.value = continent;
            option.textContent = continent;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading continents:', error);
    }
}

// Load countries based on continent
async function loadCountries() {
    const continent = document.getElementById('continent').value;
    const countrySelect = document.getElementById('country');

    if (!continent) {
        countrySelect.innerHTML = '<option value="">-- Select Continent First --</option>';
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/countries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ continent })
        });

        const data = await response.json();

        countrySelect.innerHTML = '<option value="">-- Select Country --</option>';
        data.countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading countries:', error);
    }
}

// Send verification email
async function sendVerificationEmail() {
    const email = document.getElementById('email').value;

    if (!email || !validateEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        return;
    }

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
            toastr.success('Verification email sent! Please check your inbox.');
        } else {
            toastr.error(data.message || 'Failed to send verification email');
        }
    } catch (error) {
        console.error('Error sending verification email:', error);
        toastr.error('Failed to send verification email. Please try again.');
    }
}

// Submit registration
async function submitRegistration() {
    if (!validateStep(4)) {
        return;
    }

    if (!verificationToken || !verifiedEmail) {
        toastr.error('Email verification required. Please verify your email first.');
        return;
    }

    const formData = {
        token: verificationToken,
        email: verifiedEmail,
        institute_id: document.getElementById('institute').value,
        first_name: document.getElementById('firstName').value,
        middle_name: document.getElementById('middleName').value,
        last_name: document.getElementById('lastName').value,
        suffix: document.getElementById('suffix').value,
        address_line1: document.getElementById('addressLine1').value,
        address_line2: document.getElementById('addressLine2').value,
        address_line3: document.getElementById('addressLine3').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        postal_code: document.getElementById('postalCode').value,
        continent: document.getElementById('continent').value,
        country: document.getElementById('country').value,
        office_country_code: document.getElementById('officeCountryCode').value,
        office_city_code: document.getElementById('officeCityCode').value,
        office_number: document.getElementById('officeNumber').value,
        fax_number: document.getElementById('faxNumber').value,
    };

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/save-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            toastr.success('Registration successful!');

            // Generate Summary
            const summaryTypes = {
                first_name: 'Name',
                email: 'Email',
                city: 'City',
                country: 'Country'
            };

            let summaryHtml = '<h3 style="margin-bottom: 10px; color: #475569;">Submission Summary</h3>';
            summaryHtml += `<p style="margin-bottom: 5px;"><strong>Name:</strong> ${formData.first_name} ${formData.last_name}</p>`;
            summaryHtml += `<p style="margin-bottom: 5px;"><strong>Email:</strong> ${formData.email}</p>`;
            summaryHtml += `<p style="margin-bottom: 5px;"><strong>Location:</strong> ${formData.city}, ${formData.country}</p>`;

            const summaryEl = document.getElementById('registrationSummary');
            if (summaryEl) {
                summaryEl.innerHTML = summaryHtml;
                summaryEl.style.display = 'block';
            }

            nextStep(); // Go to success step
        } else {
            console.error('Registration error:', data);
            let errorMessage = data.message || 'Registration failed. Please try again.';

            // Append validation errors if available
            if (data.errors) {
                const validationErrors = Object.values(data.errors).flat().join('\n');
                errorMessage += '\n' + validationErrors;
            }

            toastr.error(errorMessage, 'Registration Failed', { timeOut: 10000 });
        }
    } catch (error) {
        console.error('Error submitting registration:', error);
        toastr.error('Registration failed. Please try again.');
    }
}

// Navigation functions
function nextStep() {
    if (!validateStep(registrationCurrentStep)) {
        return;
    }

    if (registrationCurrentStep < totalSteps) {
        goToStep(registrationCurrentStep + 1);
    }
}

function prevStep() {
    if (registrationCurrentStep > 1) {
        goToStep(registrationCurrentStep - 1);
    }
}

function goToStep(step) {
    // Hide current step
    const currentStepEl = document.querySelector(`.step-content[data-step="${registrationCurrentStep}"]`);
    const currentProgressEl = document.querySelector(`.progress-step[data-step="${registrationCurrentStep}"]`);

    if (currentStepEl) currentStepEl.classList.remove('active');
    if (currentProgressEl) currentProgressEl.classList.remove('active');

    // Mark previous steps as completed
    for (let i = 1; i < step; i++) {
        const prevProgressEl = document.querySelector(`.progress-step[data-step="${i}"]`);
        if (prevProgressEl) prevProgressEl.classList.add('completed');
    }

    // Show new step
    registrationCurrentStep = step;
    const newStepEl = document.querySelector(`.step-content[data-step="${registrationCurrentStep}"]`);
    const newProgressEl = document.querySelector(`.progress-step[data-step="${registrationCurrentStep}"]`);

    if (newStepEl) newStepEl.classList.add('active');
    if (newProgressEl) newProgressEl.classList.add('active');

    // Scroll to top
    window.scrollTo(0, 0);
}

// Validation functions
function validateStep(step) {
    let isValid = true;

    switch (step) {
        case 1:
            isValid = validateField('institute', 'Please select an institute');
            break;
        case 2:
            isValid = validateField('firstName', 'First name is required') &&
                validateField('lastName', 'Last name is required');
            break;
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
    if (!field) return true; // Skip if field doesn't exist (e.g. not on step)

    const value = field.value.trim();

    if (!value) {
        showFieldError(fieldId, errorMessage);
        return false;
    }

    hideFieldError(fieldId);
    return true;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = field.nextElementSibling;

    field.classList.add('error');
    if (errorElement && errorElement.classList.contains('error-message')) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    } else {
        // Use Toastr if inline error element is missing
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

function showError(message) {
    toastr.error(message);
}

// Expose functions to window object for SPA access
window.loadInstitutes = loadInstitutes;
window.loadContinents = loadContinents;
window.loadCountries = loadCountries;
window.checkURLParams = checkURLParams;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.sendVerificationEmail = sendVerificationEmail;
window.submitRegistration = submitRegistration;
