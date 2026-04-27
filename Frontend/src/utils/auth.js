import { API } from '../config/api.js';

const ACCESS_TOKEN_KEY  = 'auth_token';
const ACCESS_TOKEN_FALLBACK_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// ── Read tokens ─────────────────────────────────────────────────────────────
export function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
        || localStorage.getItem(ACCESS_TOKEN_FALLBACK_KEY)
        || sessionStorage.getItem(ACCESS_TOKEN_KEY)
        || sessionStorage.getItem(ACCESS_TOKEN_FALLBACK_KEY);
}

export function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn() {
    return !!getAccessToken();
}

// ── Persist tokens after login / refresh ────────────────────────────────────
export function saveTokens(accessToken, refreshToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    // Backward compatibility for older codepaths
    localStorage.setItem(ACCESS_TOKEN_FALLBACK_KEY, accessToken);
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

// ── Clear everything and redirect ───────────────────────────────────────────
export function logout() {
    const refreshToken = getRefreshToken();
    const accessToken = getAccessToken();

    // Fire-and-forget: revoke the refresh token on the server
    if (refreshToken) {
        fetch(API.LOGOUT, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Accept':        'application/json',
                ...(accessToken ? {
                    'Authorization':     `Bearer ${accessToken}`,
                    'X-Access-Token':     accessToken,
                } : {}),
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
        }).catch(() => {}); // ignore network errors on logout
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_FALLBACK_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('user_status');
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_FALLBACK_KEY);
    sessionStorage.clear();
    window.location.hash = '#/login';
}

// ── Transparent token refresh ────────────────────────────────────────────────
// Wraps fetch: if a 401 is returned it attempts one silent refresh before retrying.
export async function authFetch(url, options = {}) {
    const accessToken = getAccessToken();
    const authHeaders = accessToken ? {
        'Authorization': `Bearer ${accessToken}`,
        'X-Access-Token': accessToken,
    } : {};

    const defaults = {
        headers: {
            'Accept':        'application/json',
            ...authHeaders,
        },
    };

    // Do NOT set Content-Type if body is FormData (let browser set multipart boundary)
    if (options.body && !(options.body instanceof FormData)) {
        defaults.headers['Content-Type'] = 'application/json';
    } else if (!options.body) {
        // Default to JSON for empty bodies (GET/HEAD etc)
        defaults.headers['Content-Type'] = 'application/json';
    }

    const mergedOptions = {
        ...options,
        headers: { ...defaults.headers, ...(options.headers || {}) },
    };

    let res = await fetch(url, mergedOptions);

    // If unauthorised, try to refresh the access token once
    if (res.status === 401) {
        const refreshed = await tryRefresh();

        if (!refreshed) {
            logout();
            return res;
        }

        // Retry original request with the new access token
        mergedOptions.headers['Authorization'] = `Bearer ${getAccessToken()}`;
        mergedOptions.headers['X-Access-Token'] = getAccessToken();
        res = await fetch(url, mergedOptions);
    }

    return res;
}

// ── Internal: call /api/auth/refresh and persist new tokens ─────────────────
async function tryRefresh() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
        const res = await fetch(API.REFRESH, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body:    JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) return false;

        const data = await res.json();
        saveTokens(data.access_token, data.refresh_token);
        return true;

    } catch {
        return false;
    }
}