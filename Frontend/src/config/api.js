// ── Central API configuration ─────────────────────────────────────────────
//
// In development Vite proxies /api → http://127.0.0.1:8000, so BASE_URL
// can stay as an empty string (same-origin proxy).
//
// In production, set VITE_API_URL in your .env file:
//   VITE_API_URL=https://api.yourproject.com
//
export const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const API = {
    // ── Auth ────────────────────────────────────────────────────────────────
    OTP_SEND:   `${BASE_URL}/api/auth/otp/send`,
    OTP_VERIFY: `${BASE_URL}/api/auth/otp/verify`,
    REFRESH:    `${BASE_URL}/api/auth/refresh`,
    LOGOUT:     `${BASE_URL}/api/auth/logout`,
    ME:         `${BASE_URL}/api/auth/me`,
    PROFILE_UPDATE: `${BASE_URL}/api/auth/profile`,
    QUALIFICATION_ADD: `${BASE_URL}/api/auth/qualification`,
    SECURE_FILE: (uid) => `${BASE_URL}/api/auth/files/${uid}`,

    // ── Review / Workflow ────────────────────────────────────────────────────
    APPLICATIONS:         `${BASE_URL}/api/auth/review/applications`,
    MY_APPLICATION:       `${BASE_URL}/api/auth/review/my-application`,
    DECIDE:      (id)  => `${BASE_URL}/api/auth/review/applications/${id}/decide`,
    APPROVE_ID_CARD: (id) => `${BASE_URL}/api/auth/review/applications/${id}/approve-id-card`,
    // Review modal data
    REVIEW_SERVICES:      `${BASE_URL}/api/auth/review/services`,
    REVIEW_STAFF: (slug) => `${BASE_URL}/api/auth/review/staff/${slug}`,
    APPLICANT_PROFILE: (uid) => `${BASE_URL}/api/auth/review/applicant/${uid}`,
    REFERENCE_SUBSYSTEMS: `${BASE_URL}/api/reference/subsystems`,
    REFERENCE_TITLES:     `${BASE_URL}/api/reference/titles`,
    REFERENCE_DURATIONS:  `${BASE_URL}/api/reference/durations`,

    // ── Admin ────────────────────────────────────────────────────────────────
    ADMIN_APPLICATIONS:          `${BASE_URL}/api/auth/admin/applications`,
    ADMIN_APP_LOGS:    (id)   => `${BASE_URL}/api/auth/admin/applications/${id}/logs`,
    ADMIN_APP_TRACKER: (id)   => `${BASE_URL}/api/auth/admin/applications/${id}/tracker`,
    ADMIN_INSTITUTES:            `${BASE_URL}/api/auth/admin/institutes`,
    ADMIN_INSTITUTE_APPROVE:(id)=> `${BASE_URL}/api/auth/admin/institutes/${id}/approve`,
    ADMIN_INSTITUTE_TOGGLE: (id)=> `${BASE_URL}/api/auth/admin/institutes/${id}/toggle-status`,
    ADMIN_INSTITUTE:   (id)   => `${BASE_URL}/api/auth/admin/institutes/${id}`,
    ADMIN_ROLES:                 `${BASE_URL}/api/auth/admin/roles`,
    ADMIN_ASSIGN_ROLE:           `${BASE_URL}/api/auth/admin/users/assign-role`,
    ADMIN_DATA:    (entity)   => `${BASE_URL}/api/auth/admin/data/${entity}`,
    ADMIN_WORKFLOWS_FULL:       `${BASE_URL}/api/auth/admin/workflows-full`,

    // ── SSH Key ─────────────────────────────────────────────────────────────
    SSH_KEY_STORE:              `${BASE_URL}/api/auth/ssh-key`,

    // ── Invitations ─────────────────────────────────────────────────────────
    INVITATIONS:                 `${BASE_URL}/api/auth/invitations`,
    INVITATION_RESEND: (id)  =>  `${BASE_URL}/api/auth/invitations/${id}/resend`,
    INVITATION_CANCEL: (id)  =>  `${BASE_URL}/api/auth/invitations/${id}/cancel`,
    INVITATION_VERIFY:           `${BASE_URL}/api/accept-invite/verify`,
    INVITATION_ACCEPT:           `${BASE_URL}/api/accept-invite`,

    // ── Helper to build arbitrary URLs ─────────────────────────────────────
    url: (path) => `${BASE_URL}${path}`,
};
