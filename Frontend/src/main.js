import '/src/styles/main.css';

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