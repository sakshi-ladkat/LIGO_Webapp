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


  if ((hash === '#/dashboard' || hash === '#/admin') && !isLoggedIn()) {
    window.location.hash = '#/login';
    return;
  }

  const userStatus = localStorage.getItem('user_status');

  if ((hash === '#/login' || hash === '#/otp') && isLoggedIn()) {
    window.location.hash = userStatus === 'onboarding' ? '#/registration' : '#/dashboard';
    return;
  }

  if (hash === '#/dashboard' && isLoggedIn() && userStatus === 'onboarding') {
    window.location.hash = '#/registration';
    return;
  }

  if (hash === '#/registration') {
    if (!isLoggedIn()) {
      window.location.hash = '#/login';
      return;
    }
    if (userStatus === 'filled' || userStatus === 'completed') {
      window.location.hash = '#/dashboard';
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