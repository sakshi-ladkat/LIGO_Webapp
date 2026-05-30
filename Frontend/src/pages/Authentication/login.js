import { API } from '../../config/api.js';

// ── Login page: Take email and send OTP ─────────────────────────────
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

        <div class="form-group" style="margin-top: 15px; display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="remember-me" style="width: 16px; height: 16px;" />
          <label for="remember-me" style="font-size: 0.9rem; color: #555; cursor: pointer; margin: 0;">
            Remember me
          </label>
        </div>

        <button type="submit" id="send-btn" class="btn-block login-submit-btn" style="margin-top: 20px;">
       Login
        </button>
      </form>
    </div>
  `;

  const form = document.getElementById('login-form');
  const btn = document.getElementById('send-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    if (!email) return;

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      // Check if we have a device token stored
      const deviceToken = localStorage.getItem('device_token');

      const payload = { email };
      if (deviceToken) {
        payload.device_token = deviceToken;
      }

      const res = await fetch(API.OTP_SEND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to send OTP. Please try again.', 'error');
        return;
      }

      if (data.bypassed_otp) {
        // Authenticated directly via device token!
        window.showToast('Welcome back! Logging in automatically...', 'success');

        import('../../utils/auth.js').then(({ saveTokens }) => {
          saveTokens(data.access_token, data.refresh_token);
          if (data.user && data.user.status) {
            localStorage.setItem('user_status', data.user.status);
          }
          if (data.user && data.user.roles) {
            localStorage.setItem('user_roles', JSON.stringify(data.user.roles.map(r => r.slug)));
          }
          window.location.hash = data.user.status === 'onboarding' ? '#/registration' : '#/dashboard';
        });
        return;
      }

      // Show success toast seamlessly transitioning into the OTP page
      window.showToast('OTP sent successfully to your inbox!', 'success');

      // Store email and remember me choice for the OTP page to read
      sessionStorage.setItem('otp_email', email);
      sessionStorage.setItem('remember_me', rememberMe ? 'true' : 'false');
      window.location.hash = '#/otp';

    } catch (err) {
      showToast('Network error. Please check your connection.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send OTP';
    }
  });
}

// Using global window.showToast from utils now