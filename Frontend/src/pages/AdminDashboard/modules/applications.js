// Force Vite reload
/**
 * MODULE: Applications
 * 
 * Handles all logic for the "Application Review" tab in the Admin Dashboard.
 * Includes data fetching, rendering the main table, and handling the Application Review modal
 * (approving/rejecting/reassigning applications).
 */

import { authFetch } from '../../../utils/auth.js';
import { API, BASE_URL } from '../../../config/api.js';
import { _app, _state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
import { _showToast } from './utils.js';
import { renderApplicationTracker } from '../../../components/ApplicationTracker.js';

// ═══════════════════════════════════════════════════════════════════════════
//  APPLICATIONS MODULE
// ═══════════════════════════════════════════════════════════════════════════
export async function _loadApplications() {
    const tbody = _app.querySelector('#adm-applications-tbody');
    tbody.innerHTML = Array(5).fill(0).map(() => `
        <tr class="adm-skeleton-row">
            <td><div class="adm-skeleton" style="width:70px;"></div></td>
            <td><div class="adm-skeleton" style="width:120px;margin-bottom:6px;"></div><div class="adm-skeleton" style="width:160px;height:12px;"></div></td>
            <td><div class="adm-skeleton" style="width:100px;"></div></td>
            <td><div class="adm-skeleton" style="width:90px;"></div></td>
            <td><div class="adm-skeleton" style="width:80px;"></div></td>
            <td><div class="adm-skeleton-pill adm-skeleton"></div></td>
            <td><div class="adm-action-group"><div class="adm-skeleton-btn adm-skeleton"></div><div class="adm-skeleton-btn adm-skeleton"></div></div></td>
        </tr>`).join('');

    try {
        const res = await authFetch(API.ADMIN_APPLICATIONS);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        _state.applications = data.applications || [];
        _updateStats(data.stats || {});
        _renderAppsTable();
        _initAppFilters();
        _initAppSearch();
    } catch (err) {
        if (err.message === 'AUTH_SESSION_EXPIRED') return;
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#ef4444;">${__esc(err.message)}</td></tr>`;
    }
}

function _updateStats(stats) {
    const set = (id, v) => { const el = _app.querySelector(id); if (el) el.textContent = v ?? '0'; };
    set('#adm-stat-total', stats.total ?? _state.applications.length);
    set('#adm-stat-pending', stats.pending ?? _state.applications.filter(a =>
        a.reviewer_actioned !== 'approved' && a.reviewer_actioned !== 'declined' &&
        !['approved', 'declined', 'rejected', 'completed'].includes(a.status)
    ).length);
    set('#adm-stat-approved', stats.approved ?? _state.applications.filter(a =>
        a.reviewer_actioned === 'approved' || ['approved', 'active', 'completed'].includes(a.status)
    ).length);
    set('#adm-stat-declined', stats.declined ?? _state.applications.filter(a =>
        a.reviewer_actioned === 'declined' || ['declined', 'rejected'].includes(a.status)
    ).length);
}

function _applyFilterSearch() {
    let list = [..._state.applications];
    
    if (_state.currentFilter !== 'all') {
        if (_state.currentFilter === 'pending') {
            // Pending = not yet actioned by reviewer, and not finally completed
            list = list.filter(a =>
                a.reviewer_actioned !== 'approved' &&
                a.reviewer_actioned !== 'declined' &&
                !['approved', 'declined', 'rejected', 'completed'].includes(a.status)
            );
        } else if (_state.currentFilter === 'declined') {
            list = list.filter(a => a.reviewer_actioned === 'declined' || ['declined', 'rejected'].includes(a.status));
        } else if (_state.currentFilter === 'approved') {
            // Approved = reviewer approved their step, OR app is finally approved
            list = list.filter(a => a.reviewer_actioned === 'approved' || ['approved', 'active', 'completed'].includes(a.status));
        } else {
            list = list.filter(a => a.status === _state.currentFilter);
        }
    }
    
    if (_state.currentRequestFilter && _state.currentRequestFilter !== 'all') {
        list = list.filter(a => a.request_name === _state.currentRequestFilter);
    }
    
    const q = _state.searchQuery ? _state.searchQuery.toLowerCase() : '';
    if (q) {
        list = list.filter(a =>
            (a.applicant_name || '').toLowerCase().includes(q) ||
            (a.applicant_email || '').toLowerCase().includes(q) ||
            (a.application_id || '').toLowerCase().includes(q) ||
            String(a.id).includes(q)
        );
    }
    return list;
}

function _renderAppsTable() {
    const tbody = _app.querySelector('#adm-applications-tbody');
    const apps = _applyFilterSearch();

    if (!apps.length) {
        const message = _state.applications.length === 0 ? 'No application requests yet' : 'No applications match your current filters.';
        tbody.innerHTML = `<tr><td colspan="7"><div class="adm-empty"><span><span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_37.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_37.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 24px; height: 24px; display: inline-block;"></span></span>${message}</div></td></tr>`;
        return;
    }

    tbody.innerHTML = apps.map(a => {
        const status = String(a.status).toLowerCase();
        // reviewer_actioned reflects this user's personal action on the app's step
        // (even if the overall workflow isn't complete yet)
        const reviewerActioned = a.reviewer_actioned; // 'approved' | 'declined' | null
        let sc = 'adm-pill-default';
        let displayStatus = status === 'rejected' ? 'declined' : (a.status || '—');

        if (reviewerActioned === 'approved' && !['approved', 'active', 'completed', 'declined', 'rejected'].includes(status)) {
            // Supervisor approved their step but overall workflow is still in progress
            sc = 'adm-pill-active';
            displayStatus = 'Approved';
        } else if (reviewerActioned === 'declined' && !['declined', 'rejected'].includes(status)) {
            sc = 'adm-pill-declined';
            displayStatus = 'Declined';
        } else if (status === 'registered' || status === 'submitted') {
            sc = 'adm-pill-registered'; // Yellow
        } else if (status.startsWith('approved_by_')) {
            sc = 'adm-pill-approved-darker'; // Darker Yellow
        } else if (status === 'approved' || status === 'active' || status === 'completed') {
            sc = 'adm-pill-active'; // Green
        } else if (status === 'declined' || status === 'rejected') {
            sc = 'adm-pill-declined'; // Red
        } else if (status === 'pending' || status === 'under_review') {
            sc = 'adm-pill-review'; // Blue
        }
        const sub = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-GB') : '—';
        const pending = !['approved', 'declined', 'rejected', 'completed'].includes(a.status);
        return `
        <tr>
            <td style="white-space:nowrap;">
                <div style="font-family:monospace;font-size:0.82rem;font-weight:700;color:#6366f1;background:#eef2ff;padding:0.2rem 0.6rem;border-radius:0.4rem;display:inline-block;border:1px solid #c7d2fe;margin-bottom:4px;">
                    ${__esc(a.application_id || a.id)}
                </div>
                ${a.reapplied_from ? `<div style="font-size:0.7rem; color:#d97706; background:#fffbeb; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; display:inline-flex; align-items:center; gap:3px;" title="Reapplied from original application ${__esc(a.reapplied_from)}"><span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_38.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_38.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 10px; height: 10px; display: inline-block;"></span>Reapplication</div>` : ''}
            </td>
            <td>
                <div class="adm-applicant-name">${__esc(a.applicant_name || '—')}</div>
                <div class="adm-applicant-email">${__esc(a.applicant_email || '')}</div>
            </td>
            <td>${__esc(a.institute_name || '—')}</td>
            <td>${__esc(a.category_name || '—')}</td>
            <td>${sub}</td>
            <td><span class="adm-pill ${sc}">${__esc(displayStatus)}</span></td>
            <td>
                <div class="adm-action-group" style="display: flex; gap: 8px; align-items: center;">

                    <button class="adm-btn adm-app-track" data-id="${a.id}" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: white; color: #4f46e5; border: 1.5px solid #e2e8f0; padding: 0.45rem 0.85rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0'; this.style.transform='none';">
                        <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/activity.svg); mask-image: url(/assets/icons/activity.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 13px; height: 13px; display: inline-block; pointer-events: none;"></span>Track
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');


    tbody.querySelectorAll('.adm-app-track').forEach(btn => btn.addEventListener('click', () => _openAppDetail(Number(btn.dataset.id), 'track')));
}

function _initAppFilters() {
    _app.querySelectorAll('.adm-filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            _app.querySelectorAll('button.adm-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _state.currentFilter = btn.dataset.filter;
            _renderAppsTable();
        });
    });
    
    const reqFilter = _app.querySelector('#adm-request-filter');
    if (reqFilter) {
        reqFilter.addEventListener('change', (e) => {
            _state.currentRequestFilter = e.target.value;
            _renderAppsTable();
        });
    }
}

function _initAppSearch() {
    const inp = _app.querySelector('#adm-search-input');
    if (!inp) return;
    inp.addEventListener('input', () => { _state.searchQuery = inp.value; _renderAppsTable(); });
}

// ── Application Detail / Track Modal ─────────────────────────────────────
async function _openAppDetail(appId, mode) {
    const modal = _app.querySelector('#adm-app-modal');
    const title = _app.querySelector('#adm-app-modal-title');
    const content = _app.querySelector('#adm-app-modal-content');
    const app = _state.applications.find(a => a.id === appId);

    title.innerHTML = mode === 'track' ? '<span style="display:inline-flex; align-items:center; gap:8px;"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/map-pin.svg); mask-image: url(/assets/icons/map-pin.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span> Application Tracking Timeline</span>' : '<span style="display:inline-flex; align-items:center; gap:8px;"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Application_Tracker.svg); mask-image: url(/assets/icons/Application_Tracker.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span> Application Detail</span>';
    content.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading…</div>`;
    modal.classList.add('open');

    if (mode === 'detail') {
        content.innerHTML = app ? _buildAppDetailHtml(app) : '<p>Not found.</p>';

        // Wire identity button
        const idBtn = content.querySelector('.adm-check-identity-btn');
        if (idBtn) {
            idBtn.addEventListener('click', () => _handleViewIdentity(idBtn.dataset.uid));
        }

        return;
    }

    try {
        const res = await authFetch(API.ADMIN_APP_TRACKER(appId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        content.innerHTML = renderApplicationTracker(data.application, data.steps, { sshKey: data.ssh_key, userData: data.user_data, isAdminView: true });
    } catch (err) {
        content.innerHTML = `<p style="color:#ef4444;padding:1rem;">Failed to load tracker: ${err.message}</p>`;
    }
}

/**
 * Fetches secure identity card from backend and displays it in a new tab.
 */
async function _handleViewIdentity(userId) {
    if (!userId) return;

    // Use toast or a temporary loading state if needed, but here we'll just open the overlay
    _showToast('Fetching identity document...', 'info');

    try {
        const res = await authFetch(API.SECURE_FILE(userId));
        if (!res.ok) throw new Error(`Could not fetch file: ${res.statusText}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const overlay = _app.querySelector('#adm-zoom-overlay');
        const zoomImg = _app.querySelector('#adm-zoom-img');
        zoomImg.src = url;
        overlay.classList.add('open');

        // Setup zoom overlay close
        _app.querySelector('#adm-zoom-close-btn').onclick = () => {
            overlay.classList.remove('open');
            URL.revokeObjectURL(url); // Cleanup
        };
        overlay.onclick = (e) => {
            if (e.target.id === 'adm-zoom-overlay') {
                overlay.classList.remove('open');
                URL.revokeObjectURL(url);
            }
        };

    } catch (err) {
        _showToast(err.message, 'error');
    }
}

function _buildAppDetailHtml(a) {
    const rows = [
        ['Application ID', `<span style="font-family:monospace;font-weight:700;color:#6366f1;background:#eef2ff;padding:0.15rem 0.4rem;border-radius:0.3rem;">${__esc(a.application_id || a.id)}</span>`],
        ['Applicant', __esc(a.applicant_name)],
        ['Email', __esc(a.applicant_email)],
        ['Institute', __esc(a.institute_name)],
        ['Category', __esc(a.category_name)],
        ['Workflow', __esc(a.workflow_name)],
        ['Request Type', __esc(a.request_name)],
        ['Current Status', __esc(a.current_status)],
        ['LIGO Member', __esc(a.ligo_member)],
        ['Duration', __esc(a.duration)],
        ['Submitted', _formatDate(a.submitted_at)],
        ['Approved By', __esc(a.approved_by_name)],
        ['Approved At', _formatDate(a.approved_at)],
    ].filter(([, v]) => v && v !== '—');

    const status = String(a.status).toLowerCase();
    let sc = 'adm-pill-default';

    if (status === 'registered' || status === 'submitted') {
        sc = 'adm-pill-registered';
    } else if (status.startsWith('approved_by_')) {
        sc = 'adm-pill-approved-darker';
    } else if (status === 'approved' || status === 'active' || status === 'completed') {
        sc = 'adm-pill-active';
    } else if (status === 'declined' || status === 'rejected') {
        sc = 'adm-pill-declined';
    } else if (status === 'pending' || status === 'under_review') {
        sc = 'adm-pill-review'; // Blue
    }
    return `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
        <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
            ${__esc((a.applicant_name || '?')[0].toUpperCase())}
        </div>
        <div>
            <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${__esc(a.applicant_name || '—')}</div>
            <div style="color:#64748b;font-size:0.85rem;">${__esc(a.applicant_email || '')}</div>
        </div>
        <span class="adm-pill ${sc}" style="margin-left:auto;">${__esc(a.status)}</span>
    </div>
    <dl style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem 1.5rem;">
    ${rows.map(([label, value]) => `
        <div>
            <dt style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;">${__esc(label)}</dt>
            <dd style="font-size:0.9rem;color:#334155;margin:0.2rem 0 0;">${value}</dd>
        </div>`).join('')}
    </dl>
    ${a.id_card_path ? `
    <div style="margin-top:2rem;padding:1.25rem;background:#f8fafc;border-radius:0.75rem;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
        <div style="display:flex;align-items:center;gap:0.75rem;color:#475569;">
            <div style="width:40px;height:40px;border-radius:50%;background:#e0f2fe;display:flex;align-items:center;justify-content:center;color:#0ea5e9;">
                <span class="extracted-svg" style="width:20px;height:20px; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
            </div>
            <div>
                <div style="font-weight:700;font-size:0.9rem;color:#0f172a;">Identity Document</div>
                <div style="font-size:0.75rem;color:#64748b;">Verification required for approval</div>
            </div>
        </div>
        <button class="adm-btn adm-btn-primary adm-check-identity-btn" data-uid="${a.applicant_user_id || a.user_id}">
            <span class="extracted-svg" style="width:16px;height:16px;margin-right:0.4rem; display: inline-block; -webkit-mask-image: url(/assets/icons/eye.svg); mask-image: url(/assets/icons/eye.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
            Check Identity
        </button>
        <div id="adm-identity-preview-container"></div>
    </div>` : ''}
    `;
}

