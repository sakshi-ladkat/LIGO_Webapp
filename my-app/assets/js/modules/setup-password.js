// Note: showToast is available globally as window.showToast (set by utils.js).
// Do NOT import it as an ES module — utils.js has no named exports.

// ── Shared icons ───────────────────────────────────────
import { EYE_OPEN_SVG, EYE_CLOSED_SVG } from '../utils/icons.js';

// ── Common words to block ──────────────────────────────
const COMMON_WORDS = ['password', '123456', 'qwerty', 'admin', 'welcome', 'login', '12345678', 'user', '123456789'];

// ── Mount ──────────────────────────────────────────────
export function mountSetupPassword() {
    console.log('[SetupPassword] Mounting...');

    // ── 1. Read token & email from URL hash ──────────────
    // Hash format: #/setup-password?token=xxx&email=yyy
    const hash = window.location.hash;
    const qs = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(qs);
    const token = params.get('token') || '';
    const email = params.get('email') || '';
    const mode = params.get('mode') || 'setup';

    console.log('[SetupPassword] token:', token ? '(present)' : 'MISSING',
        '| email:', email || 'MISSING');

    if (mode === 'reset') {
        const titleEl = document.querySelector('.set-password-page-wrapper h1');
        const descEl = document.querySelector('.set-password-page-wrapper .description');
        const btnEl = document.getElementById('submitBtn');
        if (titleEl) titleEl.textContent = 'Reset Your Password';
        if (descEl) descEl.textContent = 'Enter your new password below';
        if (btnEl) btnEl.textContent = 'Reset Password';
    }

    // Store in hidden fields so submit handler can read them
    const tokenField = document.getElementById('token');
    const emailField = document.getElementById('email');
    if (tokenField) tokenField.value = token;
    if (emailField) emailField.value = email;

    // ── 2. Eye icons – set initial state (dark, password hidden) ─────────────
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.innerHTML = EYE_CLOSED_SVG;   // closed eye = password is hidden
        btn.title = 'Show password';
        btn.classList.remove('active');
    });

    // ── 3. Global eye-toggle (called by onclick in HTML) ──
    window.togglePassword = function (fieldId) {
        const field = document.getElementById(fieldId);
        const wrapper = field ? field.closest('.password-wrapper') : null;
        const btn = wrapper ? wrapper.querySelector('.toggle-password') : null;
        if (!field) return;

        const nowVisible = field.type === 'text'; // currently shown → toggle to hidden
        field.type = nowVisible ? 'password' : 'text';

        if (btn) {
            if (nowVisible) {
                // Password just hidden → closed eye (can't see), remove active
                btn.innerHTML = EYE_CLOSED_SVG;
                btn.classList.remove('active');
                btn.title = 'Show password';
            } else {
                // Password just shown → open eye (can see), add active
                btn.innerHTML = EYE_OPEN_SVG;
                btn.classList.add('active');
                btn.title = 'Hide password';
            }
        }
    };

    // ── 4. Live validation listeners (requirement indicators + strength bar) ──
    // The button is ALWAYS clickable.  These listeners only update the UI hints.
    const pwdInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');

    if (pwdInput) {
        pwdInput.addEventListener('input', onPasswordInput);
    }
    if (confirmInput) {
        confirmInput.addEventListener('input', onConfirmInput);
    }

    // ── 5. Submit handler ─────────────────────────────────
    const form = document.getElementById('setupPasswordForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    if (mode !== 'reset') {
        setTimeout(() => {
            if (typeof window.showToast === 'function') {
                window.showToast("Password Requirements: 15–20 chars, 1 capital letter, 1 special symbol, numbers, letters, no common words.", "info");
            } else if (typeof toastr !== 'undefined') {
                toastr.info("Password Requirements: 15–20 chars, 1 capital letter, 1 special symbol, numbers, letters, no common words.");
            }
        }, 500);
    }

    console.log('[SetupPassword] Ready.');
}

// ── Live handler: password field ───────────────────────
function onPasswordInput() {
    const pwd = document.getElementById('password').value;
    updateStrengthBar(pwd);
    updateMatchIndicator();          // keep match info fresh as user types
}

// ── Live handler: confirm field ────────────────────────
function onConfirmInput() {
    updateMatchIndicator();
}

// ── Match indicator (inline error under confirm field) ─
function updateMatchIndicator() {
    const pwd = (document.getElementById('password')?.value) || '';
    const confirm = (document.getElementById('confirmPassword')?.value) || '';

    if (confirm.length > 0 && pwd !== confirm) {
        // Only show if the user has actually finished typing
        document.getElementById('passwordMatchError').style.display = 'none'; // Ensure inline is hidden
    }
}

// ── Strength bar ───────────────────────────────────────
function updateStrengthBar(pwd) {
    const fill = document.getElementById('strengthFill');
    const text = document.getElementById('strengthText');
    if (!fill || !text) return;

    if (!pwd) {
        fill.className = 'strength-fill';
        fill.style.width = '0%';
        text.textContent = '';
        return;
    }

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 15 && pwd.length <= 20) score += 2; // valid length range
    if (/[a-zA-Z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    fill.className = 'strength-fill';
    if (score <= 2) {
        fill.classList.add('weak');
        text.textContent = 'Weak password';
        text.style.color = '#e53e3e';
    } else if (score <= 4) {
        fill.classList.add('medium');
        text.textContent = 'Medium password';
        text.style.color = '#f59e0b';
    } else {
        fill.classList.add('strong');
        text.textContent = 'Strong password';
        text.style.color = '#10b981';
    }
}

// ── Validation helper (returns error string or null) ───
function validateAll(pwd, confirm) {
    if (!pwd) return 'Please enter a password.';
    if (pwd.length < 8) return 'Password must be at least 8 characters.';
    if (!confirm) return 'Please confirm your password.';
    if (pwd !== confirm) return 'Passwords do not match.';
    return null;  // all good
}

// ── Submit handler ─────────────────────────────────────
async function handleSubmit(e) {
    e.preventDefault();

    const pwdEl = document.getElementById('password');
    const confirmEl = document.getElementById('confirmPassword');
    const tokenEl = document.getElementById('token');
    const emailEl = document.getElementById('email');
    const submitBtn = document.getElementById('submitBtn');

    const pwd = pwdEl?.value || '';
    const confirm = confirmEl?.value || '';
    const token = tokenEl?.value || '';
    const email = emailEl?.value || '';

    const qs = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const mode = new URLSearchParams(qs).get('mode') || 'setup';

    // ── Client-side validation ──────────────────────────
    const validationError = validateAll(pwd, confirm);
    if (validationError) {
        showError(validationError);
        return;
    }

    // ── Token / email guard ─────────────────────────────
    if (!token || !email) {
        showError('Invalid or expired setup link. Please use the link sent to your email.');
        return;
    }

    // ── API call ────────────────────────────────────────
    submitBtn.textContent = mode === 'reset' ? 'Resetting Password...' : 'Setting Password...';
    submitBtn.classList.add('btn-loading');

    try {
        const url = mode === 'reset'
            ? `${CONFIG.API_BASE_URL}/api/auth/password/reset`
            : `${CONFIG.API_BASE_URL}/api/registration/set-password`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                token,
                email,
                password: pwd,
                password_confirmation: confirm
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Laravel validation errors: { errors: { field: ['msg', ...] } }
            if (data.errors) {
                const msgs = Object.values(data.errors).flat().join('\n');
                throw new Error(msgs);
            }
            throw new Error(data.message || 'Failed to set password. Please try again.');
        }

        // ── Success ─────────────────────────────────────
        const successEl = document.getElementById('successMessage');
        if (successEl) successEl.style.display = 'block';

        if (typeof toastr !== 'undefined') {
            toastr.success(data.message || 'Password set successfully!');
        }

        setTimeout(() => { window.location.hash = '/login'; }, 2000);

    } catch (err) {
        console.error('[SetupPassword] Submit error:', err);
        showError(err.message);
        submitBtn.textContent = 'Set Password';
        submitBtn.classList.remove('btn-loading');
    }
}

// ── Error toast ────────────────────────────────────────
function showError(msg) {
    if (typeof toastr !== 'undefined') {
        toastr.error(msg);
    } else if (typeof window.showToast === 'function') {
        window.showToast(msg, 'error');
    } else {
        alert(msg);
    }
    console.error('[SetupPassword]', msg);
}
