import { isLoggedIn } from '../utils/auth.js';

export function renderHeader() {
  header.style.display = 'block';

  const userStatus = localStorage.getItem('user_status');

  if (isLoggedIn()) {
    let navLinksHTML = '';

    if (userStatus === 'onboarding') {
       // Only allow logout if registration is incomplete
       navLinksHTML = `<a href="#" id="header-logout-btn" class="nav-link">Logout</a>`;
    } else {
       // Show full dashboard access
       navLinksHTML = `
          <a href="#/dashboard" class="nav-link" data-link>Dashboard</a>
          <a href="#" id="header-logout-btn" class="nav-link">Logout</a>
       `;
    }

    header.innerHTML = `
      <nav class="navbar">
        <a href="#/" class="nav-brand">
          <div class="logo-icon">
            <img src="/assets/images/logo.png" alt="Logo" />
          </div>
          <span class="brand-text">OrbitAccess</span>
        </a>

        <div class="nav-links">
          ${navLinksHTML}
        </div>
      </nav>
    `;

    // Attach logout listener
    const logoutBtn = document.getElementById('header-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const { logout } = await import('../utils/auth.js');
        logout();
        renderHeader(); // Re-render header to logged-out state
      });
    }

  } else {
    header.innerHTML = `
      <nav class="navbar">
        <a href="#/" class="nav-brand">
          <div class="logo-icon">
            <img src="/assets/images/logo.png" alt="Logo" />
          </div>
          <span class="brand-text">OrbitAccess</span>
        </a>

        <div class="nav-links">
          <a href="#/" class="nav-link" data-link>Home</a>
          <a href="#/login" class="nav-link" data-link>Sign In</a>
        </div>
      </nav>
    `;
  }

  setActiveLink();
}



function setActiveLink() {
  const links = document.querySelectorAll(".nav-link");
  const currentPath = window.location.pathname;

  links.forEach(link => {
    const href = link.getAttribute("href");

    // Normalize
    if (
      currentPath === "/" && href.includes("home")
    ) {
      link.classList.add("active");
    } 
    else if (currentPath.includes(href.replace(".html", ""))) {
      link.classList.add("active");
    } 
    else {
      link.classList.remove("active");
    }
  });
}