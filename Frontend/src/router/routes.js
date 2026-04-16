import { isLoggedIn } from '../utils/auth.js';

import { renderHome } from '../pages/home.js';
import { renderLogin } from '../pages/Authentication/login.js';
import { renderOtpPage } from '../pages/Authentication/otp.js';
//import { renderDashboard } from '../pages/dashboard.js';
import { RegistrationView, initRegistration } from '../pages/Registration/registration.js';

export function router() {
  const app = document.getElementById('app');
  if (!app) return;


  let hash = window.location.hash;
  if (!hash) {
    window.location.hash = '#/';
    return;
  }


  if (hash === '#/dashboard' && !isLoggedIn()) {
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
      app.innerHTML = '<h1>Dashboard (Pending Implementation)</h1>';
      break;

    case '#/registration':
      app.innerHTML = RegistrationView();
      initRegistration();
      break;

    default:
      app.innerHTML = `<h1>404 - Page Not Found</h1>`;
  }
}