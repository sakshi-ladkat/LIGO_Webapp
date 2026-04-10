import { isLoggedIn } from '../utils/auth.js';

import { renderHome } from '../pages/home.js';
import { renderLogin } from '../pages/Authentication/login.js';
import { renderOtpPage } from '../pages/Authentication/otp.js';
//import { renderDashboard } from '../pages/dashboard.js';

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

  if ((hash === '#/login' || hash === '#/otp') && isLoggedIn()) {
    window.location.hash = '#/dashboard';
    return;
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
      renderDashboard(app);
      break;

    default:
      app.innerHTML = `<h1>404 - Page Not Found</h1>`;
  }
}