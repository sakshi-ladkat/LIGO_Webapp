/**
 * Shared SVG icon components.
 * Import named exports wherever icons are needed — avoids duplicating SVG markup.
 */

// ── Eye (password visible) ──────────────────────────────
export const EYE_OPEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
  <circle cx="12" cy="12" r="3"></circle>
</svg>`;

// ── Eye-off / slashed (password hidden) ────────────────
export const EYE_CLOSED_SVG = `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
           a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1
           12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19
           m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
  <line x1="1" y1="1" x2="23" y2="23"></line>
</svg>`;

/**
 * Attach a password visibility toggle to a field.
 * @param {string} fieldId   - id of the <input type="password">
 * @param {string} btnClass  - CSS class of the toggle <span>/<button> inside the same wrapper
 */
export function attachEyeToggle(fieldId, btnClass = 'toggle-password') {
    window[`togglePassword_${fieldId}`] = function () {
        const field = document.getElementById(fieldId);
        const wrapper = field?.closest('.password-wrapper') ?? field?.parentElement;
        const btn = wrapper?.querySelector('.' + btnClass);
        if (!field) return;

        const nowVisible = field.type === 'text';
        field.type = nowVisible ? 'password' : 'text';

        if (btn) {
            btn.innerHTML = nowVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
            btn.classList.toggle('active', !nowVisible);
            btn.title = nowVisible ? 'Show password' : 'Hide password';
        }
    };
}
