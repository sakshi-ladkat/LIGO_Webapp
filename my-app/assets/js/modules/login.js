// ── Login Module ────────────────────────────────────────────
// Handles the Sign In form on #/login

import { EYE_OPEN_SVG, EYE_CLOSED_SVG } from '../utils/icons.js';

export function mountLogin() {
    console.log('[Login] Mounting...');

    const form = document.getElementById('loginForm');
    const emailEl = document.getElementById('loginEmail');
    const passwordEl = document.getElementById('loginPassword');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!form) {
        console.error('[Login] loginForm not found in DOM');
        return;
    }

    // ── Eye toggle ───────────────────────────────────────
    const eyeBtn = document.getElementById('loginEyeBtn');
    if (eyeBtn) {
        eyeBtn.innerHTML = EYE_CLOSED_SVG;   // default: password hidden → closed eye
        eyeBtn.title = 'Show password';
    }

    // Expose toggle to global scope (called by onclick in HTML)
    window.toggleLoginPassword = function () {
        if (!passwordEl || !eyeBtn) return;
        const nowVisible = passwordEl.type === 'text';
        passwordEl.type = nowVisible ? 'password' : 'text';
        eyeBtn.innerHTML = nowVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
        eyeBtn.classList.toggle('active', !nowVisible);
        eyeBtn.title = nowVisible ? 'Show password' : 'Hide password';
    };

    // ── Form submit ──────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identifier = emailEl?.value.trim() || '';
        const password = passwordEl?.value || '';

        if (!identifier) { showMsg('Please enter your email or username.', 'error'); return; }
        if (!password) { showMsg('Please enter your password.', 'error'); return; }

        submitBtn.textContent = 'Signing in...';
        submitBtn.disabled = true;
        clearMsg();

        try {
            // Step 1: Fetch CSRF cookie (required for Laravel session auth)
            await fetch(`${CONFIG.API_BASE_URL}/sanctum/csrf-cookie`, {
                method: 'GET',
                credentials: 'include'
            });

            // Step 2: Login POST
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') || ''
                },
                credentials: 'include',
                body: JSON.stringify({
                    username: identifier,   // AuthService uses orWhere('email') too
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.errors) {
                    const msgs = Object.values(data.errors).flat().join('\n');
                    throw new Error(msgs);
                }
                throw new Error(data.message || 'Login failed. Please check your credentials.');
            }

            // ── Success ──────────────────────────────────
            showMsg('Login successful! Redirecting...', 'success');
            if (typeof toastr !== 'undefined') {
                toastr.success(`Welcome back, ${data.user?.username || 'user'}!`);
            }
            if (data.user) {
                sessionStorage.setItem('auth_user', JSON.stringify(data.user));
            }
            setTimeout(() => { window.location.hash = '/dashboard'; }, 1000);

        } catch (err) {
            console.error('[Login] Error:', err);
            showMsg(err.message, 'error');
        } finally {
            submitBtn.textContent = 'Sign In';
            submitBtn.disabled = false;
        }
    });

    console.log('[Login] Ready.');
}

// ── Helpers ──────────────────────────────────────────────
function showMsg(text, type = 'info') {
    const el = document.getElementById('loginMessage');
    if (!el) return;
    el.textContent = text;
    const colors = { success: '#10b981', error: '#ef4444', info: '#667eea', warning: '#f59e0b' };
    el.style.color = colors[type] || colors.info;
    el.style.fontWeight = '500';
    el.style.fontSize = '14px';
    el.style.marginTop = '10px';
    el.style.display = 'block';
}

function clearMsg() {
    const el = document.getElementById('loginMessage');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}
