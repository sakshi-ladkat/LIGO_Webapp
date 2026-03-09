document.addEventListener('DOMContentLoaded', () => {
    // API Configuration
    const API_BASE = 'http://127.0.0.1:8000/api';
    let userEmail = '';
    let authToken = '';

    // Views
    const views = {
        welcome: document.getElementById('view-welcome'),
        email: document.getElementById('view-email'),
        otp: document.getElementById('view-otp'),
        approval: document.getElementById('view-approval'),
        success: document.getElementById('view-success')
    };

    // Form elements
    const formEmail = document.getElementById('form-email');
    const formOtp = document.getElementById('form-otp');
    const formApproval = document.getElementById('form-approval');

    // Buttons
    const btnStart = document.getElementById('btn-start');
    const btnNavHome = document.getElementById('nav-home');
    const btnNavGetStarted = document.getElementById('nav-get-started');
    const btnBackHome = document.getElementById('btn-back-home');
    const btnThemeToggle = document.getElementById('theme-toggle');

    // Theme logic
    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', currentTheme);

    btnThemeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    });

    // Utility: Show Toast
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast-${type} show`;
        setTimeout(() => toast.className = '', 3000);
    }

    // Utility: Switch View
    function switchView(viewName) {
        Object.values(views).forEach(view => view.classList.remove('active'));
        if (views[viewName]) {
            views[viewName].classList.add('active');
        }
    }

    // Navigation Events
    btnStart.addEventListener('click', () => switchView('email'));
    btnNavGetStarted.addEventListener('click', (e) => { e.preventDefault(); switchView('email'); });
    btnNavHome.addEventListener('click', (e) => { e.preventDefault(); switchView('welcome'); });
    btnBackHome.addEventListener('click', () => switchView('welcome'));

    // Step 1: Send OTP
    formEmail.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('email').value.trim();
        const btn = document.getElementById('btn-send-otp');

        if (!emailInput) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Sending...';

            const response = await fetch(`${API_BASE}/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: emailInput })
            });

            const data = await response.json();

            if (response.ok) {
                userEmail = emailInput;
                showToast(data.message || 'OTP Sent successfully!');
                switchView('otp');
            } else {
                showToast(data.message || 'Error sending OTP', 'error');
            }
        } catch (error) {
            showToast('Network error occurred.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send OTP';
        }
    });

    // Step 2: Verify OTP
    formOtp.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpInput = document.getElementById('otp').value.trim();
        const btn = document.getElementById('btn-verify-otp');

        if (!otpInput) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Verifying...';

            const response = await fetch(`${API_BASE}/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: userEmail, otp: otpInput })
            });

            const data = await response.json();

            if (response.ok) {
                authToken = data.token;
                showToast(data.message || 'Verified successfully!');
                switchView('approval');
            } else {
                showToast(data.message || 'Invalid OTP', 'error');
            }
        } catch (error) {
            showToast('Network error occurred.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Verify Identity';
        }
    });

    // Step 3: Submit Approval Form
    formApproval.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('full-name').value.trim();
        const reason = document.getElementById('reason').value.trim();
        const btn = document.getElementById('btn-submit-approval');

        if (!fullName || !reason) return;

        try {
            btn.disabled = true;
            btn.textContent = 'Submitting...';

            const formData = { full_name: fullName, reason: reason };

            const response = await fetch(`${API_BASE}/submit-approval`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ form_data: formData })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message || 'Form submitted!');
                formApproval.reset();
                formEmail.reset();
                formOtp.reset();
                switchView('success');
            } else {
                showToast(data.message || 'Error submitting form', 'error');
            }
        } catch (error) {
            showToast('Network error occurred.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit for Approval';
        }
    });
});