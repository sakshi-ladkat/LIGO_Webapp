/**
 * Global configuration file
 * Change values here when moving to production
 */
const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:8000' // Local Laravel API
    // Production example:
    // API_BASE_URL: 'https://api.yourdomain.com'
};


// Global Fetch Interceptor for Session Management
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    try {
        const response = await originalFetch(...args);

        if (response.status === 401) {
            // Session expired or unauthorized
            sessionStorage.clear();
            if (window.location.hash !== '#/login') {
                window.location.hash = '/login';
                // Use toastr if available, otherwise alert or silent
                if (typeof toastr !== 'undefined') {
                    toastr.warning('Session expired. Please login again.');
                }
            }
        }

        return response;
    } catch (error) {
        throw error;
    }
};
