import { saveTokens } from '../../utils/auth.js';
import { API } from '../../config/api.js';

// ── OTP page: render UI + logic ─────────────────────────────────────────────
export function renderOtpPage() {
    const app = document.getElementById('app');

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
              ${[...Array(6)].map(() => `<input type="text" maxlength="1" class="otp-box" inputmode="numeric" required>`).join('')}
            </div>

            <p class="help-text">
              We sent a code to
              <strong id="display-email">loading…</strong>
            </p>
          </div>

          <div class="form-actions vertical text-center">
            <button type="submit" id="verify-btn" class="btn btn-primary btn-block">
              Verify &amp; Sign In
            </button>

            <button type="button" id="btn-resend"
              class="btn btn-secondary btn-block"
              style="margin-top:10px;" disabled>
              Resend in 60s
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

// ── OTP interaction logic ────────────────────────────────────────────────────
function initOtpLogic() {
    const email = sessionStorage.getItem('otp_email');

    // Redirect back if email is missing
    if (!email) {
        window.location.hash = '#/login';
        return;
    }

    document.getElementById('display-email').textContent = email;

    // ── Box navigation ─────────────────────────────────────────────────────
    const boxes = Array.from(document.querySelectorAll('.otp-box'));

    boxes.forEach((box, i) => {
        box.addEventListener('input', () => {
            if (box.value.length === 1 && i < boxes.length - 1) {
                boxes[i + 1].focus();
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && i > 0) {
                boxes[i - 1].focus();
            }
        });

        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            digits.split('').forEach((d, j) => {
                if (boxes[j]) boxes[j].value = d;
            });
            boxes[Math.min(digits.length, boxes.length - 1)].focus();
        });
    });

    // ── Verify submit ──────────────────────────────────────────────────────
    const form      = document.getElementById('otp-form');
    const verifyBtn = document.getElementById('verify-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const otp = boxes.map(b => b.value).join('');
        if (otp.length !== 6) {
            showToast('Please enter all 6 digits.', 'error');
            return;
        }

        verifyBtn.disabled    = true;
        verifyBtn.textContent = 'Verifying…';

        try {
            const res = await fetch(API.OTP_VERIFY, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body:    JSON.stringify({ email, otp }),
            });

            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || 'Invalid OTP. Please try again.', 'error');
                // Show resend button on failure
                document.getElementById('btn-resend').style.display = 'block';
                return;
            }

            // Persist tokens
            saveTokens(data.access_token, data.refresh_token);
            if (data.user && data.user.status) {
                localStorage.setItem('user_status', data.user.status);
            }
            sessionStorage.removeItem('otp_email');

            if (data.user && data.user.status === 'onboarding') {
                window.location.hash = '#/registration';
            } else {
                window.location.hash = '#/dashboard';
            }

        } catch (err) {
            showToast('Network error. Please check your connection.', 'error');
        } finally {
            verifyBtn.disabled    = false;
            verifyBtn.textContent = 'Verify & Sign In';
        }
    });

    // ── Resend OTP ─────────────────────────────────────────────────────────
    const resendBtn   = document.getElementById('btn-resend');
    let   resendCount = 0;

    // Start initial 60s cooldown on page load
    startCooldown(resendBtn);

    resendBtn.addEventListener('click', async () => {
        if (resendCount >= 3) {
            showToast('Maximum resend limit reached. Please use a new email.', 'error');
            return;
        }

        resendBtn.disabled    = true;
        resendBtn.textContent = 'Sending…';

        try {
            const res = await fetch(API.OTP_SEND, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body:    JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || 'Could not resend OTP.', 'error');
                return;
            }

            resendCount++;
            showToast('A new OTP has been sent to your email.', 'success');

            showToast('A new OTP has been sent to your email.', 'success');

            startCooldown(resendBtn);

        } catch (err) {
            showToast('Network error.', 'error');
            resendBtn.disabled    = false;
            resendBtn.textContent = 'Get a new OTP';
        }
    });
}

function startCooldown(btn) {
    btn.disabled = true;
    let secs = 60;
    btn.textContent = `Resend in ${secs}s`;

    const interval = setInterval(() => {
        btn.textContent = `Resend in ${--secs}s`;
        if (secs <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.textContent = 'Get a new OTP';
        }
    }, 1000);
}

// Use global window.showToast from utils now