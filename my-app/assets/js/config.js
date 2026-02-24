/**
 * Global configuration file
 * Change values here when moving to production
 */
const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:8000' // Local Laravel API
    // Production example:
    // API_BASE_URL: 'https://api.yourdomain.com'
};

// Export to window for global access
window.CONFIG = CONFIG;


// Global Fetch Interceptor for Session Management
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    try {
        const response = await originalFetch(...args);

        if (response.status === 401) {
            // Token expired or invalid — clear everything and redirect to login
            // But only redirect if we're NOT already on the login page
            sessionStorage.clear();
            if (window.location.hash !== '#/login') {
                window.location.hash = '/login';
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
