import { isLoggedIn } from '../utils/auth.js';

export function renderHeader() {
  const header = document.getElementById('header');
  if (!header) return;

  // Hide header after login
  if (isLoggedIn()) {
    header.style.display = 'none';
    return;
  }

  header.style.display = 'block';

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