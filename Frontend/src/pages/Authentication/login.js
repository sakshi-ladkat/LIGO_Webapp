import { API } from '../../config/api.js';

// ── Login page: collect email and send OTP ──────────────────────────────────
export function renderLogin(app) {
    app.innerHTML = `
    <div class="login-card">
      <div class="card-header text-center">
        <h2 class="card-title">Welcome</h2>
        <span class="card-subtitle">Enter your email to sign in</span>
      </div>


      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <div class="input-wrapper">
            <input
              type="email"
              id="email"
              placeholder="name@example.com"
              required
              autocomplete="email"
              class="form-input"
            />
          </div>
        </div>

        <button type="submit" id="send-btn" class="btn-block login-submit-btn">
          Send OTP
        </button>
      </form>
    </div>
  `;

    const form   = document.getElementById('login-form');
    const btn    = document.getElementById('send-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        if (!email) return;

        btn.disabled    = true;
        btn.textContent = 'Sending…';

        try {
            const res = await fetch(API.OTP_SEND, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body:    JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || 'Failed to send OTP. Please try again.', 'error');
                return;
            }

            // Show success toast seamlessly transitioning into the OTP page
            window.showToast('OTP sent successfully to your inbox!', 'success');
            
            // Store email for the OTP page to read
            sessionStorage.setItem('otp_email', email);
            window.location.hash = '#/otp';

        } catch (err) {
            showToast('Network error. Please check your connection.', 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Send OTP';
        }
    });
}

// Using global window.showToast from utils now