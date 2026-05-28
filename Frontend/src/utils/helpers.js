/**
 * MODULE: UI Helpers
 * Shared UI formatting and utility functions across the application.
 */

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string|null} s - The string to escape.
 * @returns {string} - The escaped string.
 */
export function __esc(s) {
    if (s === null || s === undefined) return '';
    const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(s).replace(/[&<>"']/g, k => m[k]);
}

/**
 * Formats an ISO date string into a readable format (DD/MM/YYYY, HH:MM AM/PM).
 * @param {string} dateStr - The ISO date string.
 * @returns {string} - Formatted date or '—' if invalid.
 */
export function _formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Returns the CSS class corresponding to a status string.
 * @param {string} st - The status string.
 * @returns {string} - The CSS class for the status pill.
 */
export function _statusColor(st) {
    const s = String(st || '').toLowerCase();
    if (s === 'active' || s === 'completed' || s === 'approved') return 'adm-pill-approved';
    if (s === 'declined' || s === 'rejected') return 'adm-pill-declined';
    if (s === 'registered' || s === 'submitted') return 'adm-pill-registered';
    if (s.startsWith('approved_by_')) return 'adm-pill-approved-darker';
    return 'adm-pill-pending';
}

/**
 * Returns the Feather icon name corresponding to a status action.
 * @param {string} action - The action string (e.g., 'approved').
 * @returns {string} - The Feather icon name.
 */
export function _actionIcon(action) {
    const a = String(action || '').toLowerCase();
    if (a === 'approved') return 'check-circle';
    if (a === 'declined' || a === 'rejected') return 'x-circle';
    if (a === 'reassigned') return 'refresh-cw';
    return 'info';
}
