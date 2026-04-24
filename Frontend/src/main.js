// Importing CSS Files
import '/src/styles/main.css';
import '/src/styles/login.css';
import '/src/styles/otp.css';
import '/src/styles/adminDashboard.css';

// Importing JS Files
import './utils/utils.js';

// Importing Components
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';

import { router } from './router/routes.js';

// Layout function to render header, footer and router
function init() {
  renderHeader();
  renderFooter();
  router();
}

function handleRouteChange() {
  renderHeader(); // Auto-refresh header state
  router(); // update content
}

// Event Listeners for rendering layout
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('hashchange', handleRouteChange);

// Expose renderLayout globally for dynamic route rendering
window.renderLayout = init;