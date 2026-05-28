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
       const roles = JSON.parse(localStorage.getItem('user_roles') || '[]');
       const isSuperAdmin = roles.includes('super_admin');
       // Show full dashboard access
       navLinksHTML = `
          <div style="display:flex; align-items:center; gap: 1rem;">
             ${isSuperAdmin ? `
             <a href="#/admin" class="nav-link" data-link style="display:flex; align-items:center; gap:0.4rem; padding: 0.4rem 0.85rem; background: #6366f1; color: white; border-radius: 0.4rem; font-size: 0.82rem; font-weight: 600; text-decoration:none;" title="Admin Panel">
                <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/Admin.svg); mask-image: url(/public/assets/icons/Admin.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 16px; height: 16px; display: inline-block;"></span>
                Admin
             </a>` : ''}
             <a href="#/dashboard-profile" class="nav-link" data-link style="display:flex; align-items:center; padding: 0.5rem; border-radius: 50%;" title="My Profile">
                <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/sign_in.svg); mask-image: url(/public/assets/icons/sign_in.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 22px; height: 22px; display: inline-block;"></span>
             </a>
             <a href="#" id="header-logout-btn" class="nav-link">Logout</a>
          </div>
       `;
    }

    header.innerHTML = `
      <nav class="navbar">
        <a href="#/" class="nav-brand">
          <div class="logo-icon">
            <div class="orbit-logo-container">
              <div class="orbit-nucleus"></div>
              <div class="orbit-ring ring-1"><div class="orbit-electron"></div></div>
              <div class="orbit-ring ring-2"><div class="orbit-electron"></div></div>
              <div class="orbit-ring ring-3"><div class="orbit-electron"></div></div>
            </div>
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
        // Clear role cache on logout
        localStorage.removeItem('user_roles');
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
            <div class="orbit-logo-container">
              <div class="orbit-nucleus"></div>
              <div class="orbit-ring ring-1"><div class="orbit-electron"></div></div>
              <div class="orbit-ring ring-2"><div class="orbit-electron"></div></div>
              <div class="orbit-ring ring-3"><div class="orbit-electron"></div></div>
            </div>
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