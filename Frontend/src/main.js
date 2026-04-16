import '/src/styles/main.css';
import '/src/styles/login.css';
import '/src/styles/otp.css';

import './utils/utils.js';
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { router } from './router/routes.js';


function renderLayout() {
  renderHeader();
  renderFooter();
  router();
}


window.addEventListener('DOMContentLoaded', renderLayout);
window.addEventListener('hashchange', renderLayout);


window.renderLayout = renderLayout;