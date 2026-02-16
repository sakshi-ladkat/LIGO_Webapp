
// Import utilities
import { showToast } from '../utils/utils.js';

// Global validation status
let passwordValid = false;
let passwordMatch = false;

// Initialize the Setup Password Module
export function mountSetupPassword() {
    console.log('[SetupPassword] Mounting module...');

    // 1. Get URL Params (Token & Email) and populate hidden fields
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]); // Spa fragment style
    const token = urlParams.get('token');
    const email = urlParams.get('email');

    if (!token || !email) {
        showError('Invalid or missing link. Please check your email again.');
        return;
    }

    // Populate hidden or stored fields
    document.getElementById('token').value = token;
    document.getElementById('email').value = email;

    // 2. Attach Validation Listeners
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('submitBtn');

    password.addEventListener('input', validatePassword);
    confirmPassword.addEventListener('input', checkMatch);

    // 3. Attach Submit Handler
    const form = document.querySelector('#setupPasswordForm');
    form.addEventListener('submit', handleSetupPasswordSubmit);
}

function validatePassword() {
    const pwd = document.getElementById('password').value;
    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqNumber = document.getElementById('req-number');
    const reqSpecial = document.getElementById('req-special');

    // Rule 1: Length >= 8
    const isLength = pwd.length >= 8;
    updateRequirement(reqLength, isLength);

    // Rule 2: One Capital Letter (A-Z)
    const isUpper = /[A-Z]/.test(pwd);
    updateRequirement(reqUpper, isUpper);

    // Rule 3: One Number (0-9)
    const isNumber = /[0-9]/.test(pwd);
    updateRequirement(reqNumber, isNumber);

    // Rule 4: One Special Character (!@#$...)
    const isSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(pwd);
    updateRequirement(reqSpecial, isSpecial);

    // Final Validity
    passwordValid = isLength && isUpper && isNumber && isSpecial;

    checkMatch(); // Check matching password again
}

function updateRequirement(element, isValid) {
    if (isValid) {
        element.style.color = '#10b981'; // Green
        element.style.textDecoration = 'line-through';
        element.innerHTML = '✅ ' + element.innerText.replace('✅ ', '').replace('❌ ', '');
    } else {
        element.style.color = '#ef4444'; // Red
        element.style.textDecoration = 'none';
        element.innerHTML = '❌ ' + element.innerText.replace('✅ ', '').replace('❌ ', '');
    }
}

function checkMatch() {
    const pwd = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    const matchError = document.getElementById('passwordMatchError');
    const submitBtn = document.getElementById('submitBtn');

    if (confirm.length > 0 && pwd !== confirm) {
        matchError.style.display = 'block';
        passwordMatch = false;
    } else {
        matchError.style.display = 'none';
        passwordMatch = true;
    }

    // Enable/Disable Submit Button
    if (passwordValid && passwordMatch && pwd.length > 0) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-disabled');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
    }
}

async function handleSetupPasswordSubmit(e) {
    e.preventDefault();

    if (!passwordValid || !passwordMatch) {
        showError('Please satisfy all password requirements.');
        return;
    }

    const token = document.getElementById('token').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Setting Password...';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/registration/set-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                token,
                email,
                password,
                password_confirmation: password // Check backend if confirmation needed
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to set password');
        }

        // Success!
        if (typeof toastr !== 'undefined') {
            toastr.success('Password set successfully!');
        } else {
            alert('Password set successfully!');
        }

        // Redirect to Login
        window.location.hash = '/login';

    } catch (error) {
        console.error('Set Password Error:', error);
        showError(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Set Password & Login';
    }
}

function showError(msg) {
    const msgEl = document.getElementById('message');
    if (msgEl) {
        msgEl.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
    }
    if (typeof toastr !== 'undefined') {
        toastr.error(msg);
    }
}
