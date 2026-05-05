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


  let hash = window.location.hash;
  if (!hash) {
    window.location.hash = '#/';
    return;
  }


  if ((hash === '#/dashboard' || hash === '#/dashboard-profile' || hash === '#/admin') && !isLoggedIn()) {
    window.location.hash = '#/login';
    return;
  }

  const userStatus = localStorage.getItem('user_status');
  const userRoles = JSON.parse(localStorage.getItem('user_roles') || '[]');
  const isSuperAdmin = userRoles.includes('super_admin');

  if ((hash === '#/login' || hash === '#/otp') && isLoggedIn()) {
    if (userStatus === 'onboarding') {
      window.location.hash = '#/registration';
    } else {
      window.location.hash = isSuperAdmin ? '#/admin' : '#/dashboard';
    }
    return;
  }

  if ((hash === '#/dashboard' || hash === '#/dashboard-profile') && isLoggedIn()) {
    if (userStatus === 'onboarding') {
      window.location.hash = '#/registration';
      return;
    }
    if (isSuperAdmin && hash !== '#/dashboard-profile') {
      window.location.hash = '#/admin';
      return;
    }
  }

  if (hash === '#/registration') {
    if (!isLoggedIn()) {
      window.location.hash = '#/login';
      return;
    }
    // Allow reupload_required to access registration
    if (userStatus === 'filled' || userStatus === 'completed' || userStatus === 'active') {
      window.location.hash = isSuperAdmin ? '#/admin' : '#/dashboard';
      return;
    }
  }

  app.innerHTML = '';

  switch (hash) {
    case '#/':
      renderHome(app);
      break;

    case '#/login':
      renderLogin(app);
      break;

    case '#/otp':
      renderOtpPage();
      break;

    case '#/dashboard':
    case '#/dashboard-profile':
      renderDashboard(app, hash === '#/dashboard-profile');
      break;

    case '#/registration':
      app.innerHTML = RegistrationView();
      initRegistration();
      break;

    case '#/admin':
      renderAdminDashboard(app);
      break;

    default:
      app.innerHTML = `<h1>404 - Page Not Found</h1>`;
  }
}