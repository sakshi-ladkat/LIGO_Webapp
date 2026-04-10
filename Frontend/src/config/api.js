// ── Central API configuration ─────────────────────────────────────────────
//
// In development Vite proxies /api → http://127.0.0.1:8000, so BASE_URL
// can stay as an empty string (same-origin proxy).
//
// In production, set VITE_API_URL in your .env file:
//   VITE_API_URL=https://api.yourproject.com
//
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const API = {
    // ── Auth ────────────────────────────────────────────────────────────────
    OTP_SEND:   `${BASE_URL}/api/auth/otp/send`,
    OTP_VERIFY: `${BASE_URL}/api/auth/otp/verify`,
    REFRESH:    `${BASE_URL}/api/auth/refresh`,
    LOGOUT:     `${BASE_URL}/api/auth/logout`,
    ME:         `${BASE_URL}/api/auth/me`,

    // ── Helper to build arbitrary URLs ─────────────────────────────────────
    url: (path) => `${BASE_URL}${path}`,
};
