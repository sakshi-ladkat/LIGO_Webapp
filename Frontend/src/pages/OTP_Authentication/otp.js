export function renderOtpPage() {
    const app = document.getElementById("app");

    app.innerHTML = `
    <main class="page-background auth-bg">
      <div id="toast-container"></div>

      <div class="auth-card scale-in">
        <div class="auth-header">
          <h1>Welcome</h1>
          <p>Verify your email</p>
        </div>

        <form id="otp-form">
          <div class="input-group full-width otp-group">
            <label>Enter 6-digit Code</label>

            <div class="otp-inputs">
              ${[...Array(6)]
            .map(
                () =>
                    `<input type="text" maxlength="1" class="otp-box" required>`
            )
            .join("")}
            </div>

            <p class="help-text">
              We sent a code to 
              <strong id="display-email">user@email.com</strong>
            </p>
          </div>

          <div class="form-actions vertical text-center">
            <button type="submit" class="btn btn-primary btn-block">
              Verify & Sign In
            </button>

            <button type="button" id="btn-resend" 
              class="btn btn-secondary btn-block" 
              style="display:none; margin-top:10px;">
              Get a new OTP
            </button>

            <a href="#/login" class="link-secondary" 
              style="margin-top:15px; display:inline-block;">
              Use another email
            </a>
          </div>
        </form>
      </div>
    </main>
  `;

    initOtpLogic();
}