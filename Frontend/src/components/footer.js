import { isLoggedIn } from '../utils/auth.js';

export function renderFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;

  // Hide if logged in
  if (isLoggedIn()) {
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';

  footer.innerHTML = `
    <div class="footer-content">
      <p>&copy; 2026 orbitaccess science collab. All rights reserved.</p>
      <div class="footer-links">
        <a href="#/privacy">Privacy Policy</a>
        <a href="#/terms">Terms of Service</a>
      </div>
    </div>
  `;
}