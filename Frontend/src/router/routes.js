import { isLoggedIn } from '../utils/auth.js';

import { renderHome } from '../pages/home.js';
import { renderLogin } from '../pages/Authentication/login.js';
import { renderOtpPage } from '../pages/Authentication/otp.js';
import { renderDashboard } from '../pages/Dashboard/dashboard.js';
import { RegistrationView, initRegistration } from '../pages/Registration/registration.js';
import { renderAdminDashboard } from '../pages/AdminDashboard/adminDashboard.js';

export function router() {
  const app = document.getElementById('app');
  if (!app) return;

  const fullHash = window.location.hash || '#/';
  const [baseHash, queryStr] = fullHash.split('?');

  // Enforce blocked user access restriction
  if (localStorage.getItem('is_blocked') === 'true' && baseHash !== '#/login' && baseHash !== '#/otp') {
    const adminEmail = localStorage.getItem('blocked_admin_email') || 'superadmin@orbitaccess.com';
    renderRestrictedView(app, adminEmail);
    return;
  }

  if (queryStr && queryStr.includes('invite=true')) {
    if (isLoggedIn()) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_status');
      localStorage.removeItem('user_roles');
      sessionStorage.clear();
      window.history.replaceState(null, '', window.location.pathname + '#/login');
    }
  }

  if (!window.location.hash) {
    window.location.hash = '#/';
    return;
  }

  if ((baseHash === '#/dashboard' || baseHash === '#/dashboard-profile' || baseHash === '#/admin') && !isLoggedIn()) {
    window.location.hash = '#/login';
    return;
  }

  const userStatus = localStorage.getItem('user_status');
  const userRoles = JSON.parse(localStorage.getItem('user_roles') || '[]');
  const isSuperAdmin = userRoles.includes('super_admin');

  if ((baseHash === '#/login' || baseHash === '#/otp') && isLoggedIn()) {
    if (userStatus === 'onboarding') {
      window.location.hash = '#/registration';
    } else {
      window.location.hash = '#/dashboard';
    }
    return;
  }

  if ((baseHash === '#/dashboard' || baseHash === '#/dashboard-profile') && isLoggedIn()) {
    if (userStatus === 'onboarding') {
      window.location.hash = '#/registration';
      return;
    }
    // Super admin always uses the full admin panel, not the regular dashboard
    if (isSuperAdmin) {
      window.location.hash = '#/admin';
      return;
    }
  }

  if (baseHash === '#/registration') {
    if (!isLoggedIn()) {
      window.location.hash = '#/login';
      return;
    }
    // Allow reupload_required/edit mode/reapply to access registration even if already "filled"
    const isEditMode = queryStr && (queryStr.includes('mode=edit') || queryStr.includes('mode=reapply'));
    if (!isEditMode && (userStatus === 'filled' || userStatus === 'completed' || userStatus === 'active')) {
      window.location.hash = '#/dashboard';
      return;
    }
  }

  app.innerHTML = '';

  switch (baseHash) {
    case '#/':
      renderHome(app);
      break;

    case '#/login':
      renderLogin(app);
      break;

    case '#/otp':
      renderOtpPage();
      break;

    case '#/accept-invite':
      renderAcceptInvite(app, queryStr);
      break;

    case '#/dashboard':
    case '#/dashboard-profile':
      renderDashboard(app, baseHash === '#/dashboard-profile');
      break;

    case '#/registration':
      app.innerHTML = RegistrationView();
      initRegistration();
      break;

    case '#/admin':
      renderAdminDashboard(app);
      break;

    default:
      app.innerHTML = `<div style="padding: 40px; text-align:center;"><h1>404 - Page Not Found</h1><p>Route: ${escHtml(baseHash)}</p><a href="#/">Back to Home</a></div>`;
  }
}

function renderRestrictedView(app, adminEmail) {
  const superAdminEmail = adminEmail || 'superadmin@orbitaccess.com';
  app.innerHTML = `
    <div style="min-height: 100vh; background: radial-gradient(circle at 10% 20%, #fef2f2 0%, #fff 90%); display: flex; align-items: center; justify-content: center; padding: 2rem; font-family: 'Outfit', sans-serif;">
      <div style="width: 100%; max-width: 520px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); border-radius: 24px; border: 1px solid #fee2e2; box-shadow: 0 20px 40px -15px rgba(220, 38, 38, 0.12); padding: 3rem 2.5rem; text-align: center; transform: translateY(0); transition: all 0.3s ease;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #fee2e2, #fecaca); color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; box-shadow: 0 10px 20px -5px rgba(239, 68, 68, 0.2); animation: pulse-red 2s infinite;">
          <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/shield-off.svg) no-repeat center; mask: url(/assets/icons/shield-off.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 36px; height: 36px; display: inline-block;"></span>
        </div>
        <h1 style="font-size: 1.8rem; font-weight: 850; color: #991b1b; margin-bottom: 0.75rem; letter-spacing: -0.02em;">Profile Access Restricted</h1>
        <p style="font-size: 0.75rem; color: #b91c1c; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1.5rem;">Administrative Access Revoked</p>
        <div style="height: 1px; background: linear-gradient(to right, transparent, #fee2e2, transparent); margin-bottom: 1.75rem;"></div>
        <p style="font-size: 0.95rem; color: #475569; line-height: 1.6; margin-bottom: 2.25rem; font-weight: 550;">
          Your profile has been restricted by system administrators. You are currently not permitted to access OrbitAccess resources.
        </p>
        <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 16px; padding: 1.25rem; margin-bottom: 2.5rem; text-align: left; display: flex; align-items: center; gap: 14px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); color: #991b1b; flex-shrink: 0;">
            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/mail.svg) no-repeat center; mask: url(/assets/icons/mail.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #b91c1c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Contact Support</div>
            <a href="mailto:${superAdminEmail}" style="font-size: 0.9rem; color: #991b1b; font-weight: 750; text-decoration: none; word-break: break-all; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1;">
              ${superAdminEmail}
            </a>
          </div>
        </div>
        <button id="restricted-logout-btn" style="width: 100%; height: 48px; background: #fff; border: 1.5px solid #e2e8f0; color: #475569; font-size: 0.9rem; font-weight: 750; border-radius: 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='#fff'; this.style.borderColor='#e2e8f0'">
          <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/log-out.svg) no-repeat center; mask: url(/assets/icons/log-out.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 16px; height: 16px; display: inline-block;"></span>
          Sign Out of Account
        </button>
      </div>
    </div>
  `;

  const logoutBtn = app.querySelector('#restricted-logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('is_blocked');
      localStorage.removeItem('blocked_admin_email');
      import('../utils/auth.js').then(auth => auth.logout());
    };
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}