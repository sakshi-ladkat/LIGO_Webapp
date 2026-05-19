import { API } from '../../config/api.js';
import { saveTokens } from '../../utils/auth.js';

/**
 * Render the Accept Invite registration form.
 */
export async function renderAcceptInvite(app, queryStr) {
  // Extract token from query parameters (format: token=xyz)
  const params = new URLSearchParams(queryStr || '');
  const token = params.get('token');

  if (!token) {
    renderErrorState(app, 'Missing invitation token. Please check your invitation email link.');
    return;
  }

  // Render a sleek loading state while verifying
  app.innerHTML = `
    <div class="login-card" style="text-align: center; padding: 3rem 2rem;">
      <div class="db-loading-inline" style="margin-bottom: 1.5rem;">
        <div class="spinner"></div>
      </div>
      <h3 style="font-weight: 800; color: var(--primary-800); margin: 0 0 0.5rem 0;">Verifying Invitation</h3>
      <p style="color: #64748b; font-size: 0.9rem; margin: 0;">Securing connection and checking invitation status…</p>
    </div>
  `;

  try {
    const res = await fetch(API.INVITATION_VERIFY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    const data = await res.json();

    if (!res.ok) {
      renderErrorState(app, data.error || 'This invitation is invalid or has expired.');
      return;
    }

    const { email, role } = data.invitation;
    renderRegistrationForm(app, token, email, role);
  } catch (err) {
    renderErrorState(app, 'Network error. Please check your internet connection.');
  }
}

/**
 * Render an error state for invalid/expired tokens.
 */
function renderErrorState(app, message) {
  app.innerHTML = `
    <div class="login-card" style="text-align: center; padding: 4rem 2rem; border-top: 4px solid #ef4444;">
      <div style="background: #fee2e2; color: #ef4444; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem auto; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
        <i data-feather="alert-triangle" style="width: 32px; height: 32px;"></i>
      </div>
      <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 1rem 0;">Invitation Expired or Invalid</h2>
      <p style="color: #64748b; font-size: 0.95rem; line-height: 1.6; margin: 0 0 2rem 0; font-weight: 500;">
        ${escapeHtml(message)}
      </p>
      <a href="#/login" class="login-submit-btn" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 0.75rem 2rem; gap: 0.5rem; font-weight: 700; width: auto; margin: 0 auto;">
        <i data-feather="arrow-left" style="width: 16px; height: 16px;"></i> Return to Sign In
      </a>
    </div>
  `;
  feather.replace();
}

/**
 * Render the registration form state.
 */
function renderRegistrationForm(app, token, email, role) {
  const roleLabel = role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  app.innerHTML = `
    <div class="login-card" style="width: 100%; max-width: 480px; padding: 3rem 2.5rem; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); border-radius: 20px;">
      <div class="card-header text-center" style="margin-bottom: 2rem;">
        <div style="background: linear-gradient(135deg, var(--primary-500) 0%, var(--primary-800) 100%); width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; color: white; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.25);">
          <i data-feather="user-plus" style="width: 26px; height: 26px;"></i>
        </div>
        <h2 class="card-title" style="font-size: 1.6rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">Join the Team</h2>
        <span class="card-subtitle" style="font-size: 0.9rem; color: #64748b; font-weight: 600; display: block; margin-bottom: 0.5rem;">
          Role: <strong style="color: var(--primary-700);">${escapeHtml(roleLabel)}</strong>
        </span>
        <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 500;">
          Invited Email: <strong style="color: #475569; font-weight: 600;">${escapeHtml(email)}</strong>
        </span>
      </div>

      <form id="invite-register-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; display: block;">Full Name</label>
          <div class="input-wrapper" style="position: relative;">
            <i data-feather="user" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 18px; height: 18px;"></i>
            <input
              type="text"
              id="register-name"
              placeholder="Your Full Name"
              required
              class="form-input"
              style="padding-left: 2.75rem; font-weight: 500;"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; display: block;">Choose Password</label>
          <div class="input-wrapper" style="position: relative;">
            <i data-feather="key" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 18px; height: 18px;"></i>
            <input
              type="password"
              id="register-password"
              placeholder="Minimum 6 characters"
              required
              class="form-input"
              style="padding-left: 2.75rem; font-weight: 500;"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; display: block;">Confirm Password</label>
          <div class="input-wrapper" style="position: relative;">
            <i data-feather="lock" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 18px; height: 18px;"></i>
            <input
              type="password"
              id="register-password-confirm"
              placeholder="Repeat your password"
              required
              class="form-input"
              style="padding-left: 2.75rem; font-weight: 500;"
            />
          </div>
        </div>

        <button type="submit" id="register-btn" class="btn-block login-submit-btn" style="margin-top: 1rem; font-weight: 700; font-size: 0.95rem; padding: 0.85rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
          <i data-feather="check-circle" style="width: 18px; height: 18px;"></i> Complete Registration
        </button>
      </form>
    </div>
  `;
  feather.replace();

  // Wire registration logic
  const form = document.getElementById('invite-register-form');
  const btn = document.getElementById('register-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-password-confirm').value;

    if (password.length < 6) {
      window.showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    if (password !== confirm) {
      window.showToast('Passwords do not match. Please verify.', 'error');
      return;
    }

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<div class="spinner" style="width: 20px; height: 20px; border-color: white; border-top-color: transparent;"></div> Saving…`;

    try {
      const res = await fetch(API.INVITATION_ACCEPT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          token,
          name,
          password,
          password_confirmation: confirm
        })
      });

      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to complete registration.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
      }

      // Successful registration!
      window.showToast('Registration complete! Welcome to OrbitAccess.', 'success');

      // Persist authorization tokens
      saveTokens(data.tokens.access_token, data.tokens.refresh_token);

      // Sync role and status
      localStorage.setItem('user_status', data.user.status || 'onboarding');
      if (data.user.roles) {
        localStorage.setItem('user_roles', JSON.stringify(data.user.roles.map(r => r.slug)));
      } else {
        localStorage.setItem('user_roles', JSON.stringify([role]));
      }

      // Seamless redirect to Onboarding Registration flow
      setTimeout(() => {
        window.location.hash = '#/registration';
      }, 1200);

    } catch (err) {
      window.showToast('Network error during registration.', 'error');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

/**
 * Escapes HTML characters to prevent XSS injection.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}
