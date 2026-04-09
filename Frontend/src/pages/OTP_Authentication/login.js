export function renderLogin(app) {
  app.innerHTML = `
    <div class="login-card">
      <div class="card-header text-center">
        <h2 class="card-title">Welcome</h2>
        <span class="card-subtitle">
          Enter your email to sign in 
        </span>
      </div>

      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <div class="input-wrapper">
            <input 
              type="email" 
              id="email" 
              placeholder="name@example.com" 
              required 
              class="form-input"
            />
          </div>
        </div>

        <button type="submit" class="btn-block login-submit-btn">
          Send OTP
        </button>
      </form>
    </div>
  `;


  const form = document.getElementById("login-form");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;

    console.log("OTP sent to:", email);

    localStorage.setItem("isLoggedIn", "true");


    window.location.hash = "#/dashboard";
  });
}