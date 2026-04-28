/**
 * adminDashboard.js  — Admin Dashboard module for OrbitAccess
 *
 * Sidebar:
 *   Management  → Applications | Reports (blank)
 *   System Config → Workflow Engine | Modify Data
 *
 * All data live from backend.  Users/Institutes managed via Modify Data cards.
 */

import { authFetch } from '../../utils/auth.js';
import { API }       from '../../config/api.js';

// ── State ───────────────────────────────────────────────────────────────────
const _state = {
    applications:  [],
    currentFilter: 'all',
    searchQuery:   '',
};

let _app = null;

// ═══════════════════════════════════════════════════════════════════════════
// 1. ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════
export async function renderAdminDashboard(container) {
    // ── Guard: verify super_admin ──────────────────────────────────────────
    let cachedRoles = JSON.parse(localStorage.getItem('user_roles') || '[]');

    if (cachedRoles.length === 0) {
        try {
            const res = await authFetch(API.ME);
            if (res.ok) {
                const data = await res.json();
                cachedRoles = (data.roles || []).map(r => r.slug);
                localStorage.setItem('user_roles', JSON.stringify(cachedRoles));
            }
        } catch (_) {}
    }

    if (!cachedRoles.includes('super_admin')) {
        window.location.hash = '#/dashboard';
        return;
    }

    _app = container;
    _app.innerHTML = _buildShell();
    _initSidebar();
    _initModals();
    feather.replace();
    _switchTab('applications');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SHELL
// ═══════════════════════════════════════════════════════════════════════════
function _buildShell() {
    return `
    <div class="admin-shell">
        <!-- Sidebar -->
        <aside class="admin-sidebar">
            <div class="adm-sidebar-title">Management</div>
            <div class="adm-nav-item active" data-tab="applications">
                <svg data-feather="monitor"></svg> Applications
            </div>
            <div class="adm-nav-item" data-tab="reports">
                <svg data-feather="bar-chart-2"></svg> Reports
            </div>

            <div class="adm-sidebar-title">System Config</div>
            <div class="adm-nav-item" data-tab="workflows">
                <svg data-feather="git-merge"></svg> Workflow Engine
            </div>
            <div class="adm-nav-item" data-tab="modify">
                <svg data-feather="database"></svg> Modify Data
            </div>
        </aside>

        <!-- Main -->
        <main class="admin-main">

            <!-- ─── APPLICATIONS TAB ─── -->
            <div id="adm-tab-applications" class="adm-tab">
                <div class="adm-page-header">
                    <h1 class="adm-page-title">Application Review</h1>
                    <p class="adm-page-sub">Manage all incoming member applications</p>
                </div>

                <div class="adm-stats">
                    <div class="adm-stat-card">
                        <div class="adm-stat-label">Total</div>
                        <div class="adm-stat-value adm-stat-total" id="adm-stat-total">—</div>
                    </div>
                    <div class="adm-stat-card">
                        <div class="adm-stat-label">Pending</div>
                        <div class="adm-stat-value adm-stat-pending" id="adm-stat-pending">—</div>
                    </div>
                    <div class="adm-stat-card">
                        <div class="adm-stat-label">Approved</div>
                        <div class="adm-stat-value adm-stat-approved" id="adm-stat-approved">—</div>
                    </div>
                    <div class="adm-stat-card">
                        <div class="adm-stat-label">Rejected</div>
                        <div class="adm-stat-value adm-stat-rejected" id="adm-stat-rejected">—</div>
                    </div>
                </div>

                <div class="adm-controls">
                    <div class="adm-search">
                        <svg data-feather="search"></svg>
                        <input id="adm-search-input" class="adm-search-input" type="text"
                            placeholder="Search by name, email, or application ID…">
                    </div>
                    <div class="adm-filters">
                        <button class="adm-filter-btn active" data-filter="all">All</button>
                        <button class="adm-filter-btn" data-filter="pending">Pending</button>
                        <button class="adm-filter-btn" data-filter="approved">Approved</button>
                        <button class="adm-filter-btn" data-filter="rejected">Rejected</button>
                    </div>
                </div>

                <div class="adm-table-card">
                    <div class="adm-table-wrap">
                        <table class="adm-table">
                            <thead>
                                <tr>
                                    <th>Application ID</th>
                                    <th>Applicant</th>
                                    <th>Institute</th>
                                    <th>Category</th>
                                    <th>Submitted</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="adm-applications-tbody">
                                <tr><td colspan="7"><div class="adm-loading"><div class="adm-spinner"></div> Loading…</div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- ─── INSTITUTES TAB ─── -->
            <div id="adm-tab-institutes" class="adm-tab">
                <div id="adm-inst-container">
                    <!-- Loaded dynamically -->
                </div>
            </div>

            <!-- ─── REPORTS TAB (blank) ─── -->
            <div id="adm-tab-reports" class="adm-tab">
                <div class="adm-page-header">
                    <h1 class="adm-page-title">Reports</h1>
                    <p class="adm-page-sub">Analytics and exportable reports</p>
                </div>
                <div class="adm-reports-blank">
                    <div class="adm-reports-blank-icon">📊</div>
                    <div class="adm-reports-blank-title">Coming Soon</div>
                    <div class="adm-reports-blank-sub">Reports and analytics will be available here in a future release.</div>
                </div>
            </div>

            <!-- ─── WORKFLOW ENGINE TAB ─── -->
            <div id="adm-tab-workflows" class="adm-tab">
                <div class="adm-page-header">
                    <h1 class="adm-page-title">Workflow Engine</h1>
                    <p class="adm-page-sub">All active approval pipelines — click a workflow to view or modify its steps</p>
                </div>
                <div id="adm-wf-container">
                    <div class="adm-loading"><div class="adm-spinner"></div> Loading workflows…</div>
                </div>
            </div>

            <!-- ─── MODIFY DATA TAB (Grid of Cards) ─── -->
            <div id="adm-tab-modify" class="adm-tab">
                <div class="adm-page-header">
                    <h1 class="adm-page-title">Modify Data</h1>
                    <p class="adm-page-sub">Select a category to manage its records in a dedicated view.</p>
                </div>
                <div class="adm-cards-grid" id="adm-modify-cards">
                    ${_buildModifyCards()}
                </div>
            </div>

            <!-- ─── GENERIC DATA ADMIN TAB (The "Page") ─── -->
            <div id="adm-tab-data-admin" class="adm-tab">
                <div id="adm-data-admin-container">
                    <!-- Loaded dynamically -->
                </div>
            </div>

        </main>
    </div>

    <!-- Application detail / track modal -->
    <div class="adm-modal-overlay" id="adm-app-modal">
        <div class="adm-modal-box">
            <div class="adm-modal-header">
                <div class="adm-modal-title" id="adm-app-modal-title">Application Detail</div>
                <button class="adm-modal-close" id="adm-app-modal-close">
                    <svg data-feather="x" style="width:18px;height:18px;"></svg>
                </button>
            </div>
            <div id="adm-app-modal-content">Loading…</div>
        </div>
    </div>

    <!-- Workflow step detail modal -->
    <div class="adm-modal-overlay" id="adm-wf-modal">
        <div class="adm-modal-box">
            <div class="adm-modal-header">
                <div class="adm-modal-title" id="adm-wf-modal-title">Workflow Steps</div>
                <button class="adm-modal-close" id="adm-wf-modal-close">
                    <svg data-feather="x" style="width:18px;height:18px;"></svg>
                </button>
            </div>
            <div id="adm-wf-modal-content">Loading…</div>
        </div>
    </div>

    <!-- Modify Data CRUD modal -->
    <div class="adm-modal-overlay" id="adm-modify-modal">
        <div class="adm-modal-box">
            <div class="adm-modal-header">
                <div class="adm-modal-title" id="adm-modify-modal-title">Data Browser</div>
                <button class="adm-modal-close" id="adm-modify-modal-close">
                    <svg data-feather="x" style="width:18px;height:18px;"></svg>
                </button>
            </div>
            <div id="adm-modify-modal-content">Loading…</div>
        </div>
    </div>

    <!-- Toast container -->
    <div class="adm-toast-container" id="adm-toast-container"></div>

    <!-- Institute Approval/Edit Modal -->
    <div class="adm-modal-overlay" id="adm-inst-edit-modal">
        <div class="adm-modal-box">
            <div class="adm-modal-header">
                <div class="adm-modal-title">Complete Institute Details</div>
                <button class="adm-modal-close" id="adm-inst-edit-close"><i data-feather="x"></i></button>
            </div>
            <div id="adm-inst-edit-content" style="padding:2.5rem 3rem;">
                <form id="adm-inst-edit-form" class="adm-form" style="display:flex;flex-direction:column;gap:1.25rem;">
                    <div class="adm-form-group">
                        <label>Institute Name</label>
                        <input type="text" name="name" required />
                    </div>
                    <div class="adm-form-group">
                        <label>Institute Code (e.g. OXF)</label>
                        <input type="text" name="code" required />
                    </div>
                    <div class="adm-form-group">
                        <label>City</label>
                        <input type="text" name="city" required />
                    </div>
                    <div style="margin-top:1.5rem;display:flex;gap:0.75rem;">
                        <button type="submit" class="adm-btn adm-btn-success" style="flex:1;">Approve & Save</button>
                        <button type="button" class="adm-btn adm-btn-secondary fac-modal-cancel" id="adm-inst-edit-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Zoom Overlay -->
    <div id="adm-zoom-overlay" class="adm-zoom-overlay">
        <button class="adm-zoom-close" id="adm-zoom-close-btn"><i data-feather="x"></i></button>
        <img src="" class="adm-zoom-img" id="adm-zoom-img" />
    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
function _initSidebar() {
    _app.querySelectorAll('.adm-nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => _switchTab(item.dataset.tab));
    });
}

function _switchTab(name) {
    _app.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
    _app.querySelector(`.adm-nav-item[data-tab="${name}"]`)?.classList.add('active');
    _app.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
    _app.querySelector(`#adm-tab-${name}`)?.classList.add('active');
    feather.replace();

    switch (name) {
        case 'applications': _loadApplications(); break;
        case 'institutes':   _loadInstitutes();   break; 
        case 'workflows':    _loadWorkflows();    break;
        case 'modify':       _initModifyCards();  break;
        case 'data-admin':   _loadDataAdmin(arguments[1]); break;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. APPLICATIONS MODULE
// ═══════════════════════════════════════════════════════════════════════════
async function _loadApplications() {
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
        const res  = await authFetch(API.ADMIN_APPLICATIONS);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        _state.applications = data.applications || [];
        _updateStats(data.stats || {});
        _renderAppsTable();
        _initAppFilters();
        _initAppSearch();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#ef4444;">${_esc(err.message)}</td></tr>`;
    }
}

function _updateStats(stats) {
    const set = (id, v) => { const el = _app.querySelector(id); if (el) el.textContent = v ?? '—'; };
    set('#adm-stat-total',    stats.total    ?? _state.applications.length);
    set('#adm-stat-pending',  stats.pending  ?? _state.applications.filter(a => !['approved','rejected'].includes(a.status)).length);
    set('#adm-stat-approved', stats.approved ?? _state.applications.filter(a => a.status === 'approved').length);
    set('#adm-stat-rejected', stats.rejected ?? _state.applications.filter(a => a.status === 'rejected').length);
}

function _applyFilterSearch() {
    let list = [..._state.applications];
    if (_state.currentFilter !== 'all') {
        list = _state.currentFilter === 'pending'
            ? list.filter(a => !['approved','rejected'].includes(a.status))
            : list.filter(a => a.status === _state.currentFilter);
    }
    const q = _state.searchQuery.toLowerCase();
    if (q) list = list.filter(a =>
        (a.applicant_name  || '').toLowerCase().includes(q) ||
        (a.applicant_email || '').toLowerCase().includes(q) ||
        (a.application_id  || '').toLowerCase().includes(q) ||
        String(a.id).includes(q)
    );
    return list;
}

function _renderAppsTable() {
    const tbody = _app.querySelector('#adm-applications-tbody');
    const apps  = _applyFilterSearch();

    if (!apps.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="adm-empty"><span>📭</span>No applications match.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = apps.map(a => {
        const sc = { 
            approved: 'adm-pill-approved', 
            rejected: 'adm-pill-rejected', 
            registered: 'adm-pill-registered',
            active: 'adm-pill-active',
            pending: 'adm-pill-pending'
        }[String(a.status).toLowerCase()] || 'adm-pill-default';
        const sub = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-GB') : '—';
        const pending = !['approved','rejected'].includes(a.status);
        return `
        <tr>
            <td style="white-space:nowrap;">
                <div style="font-family:monospace;font-size:0.82rem;font-weight:700;color:#6366f1;background:#eef2ff;padding:0.2rem 0.6rem;border-radius:0.4rem;display:inline-block;border:1px solid #c7d2fe;">
                    ${_esc(a.application_id || a.id)}
                </div>
            </td>
            <td>
                <div class="adm-applicant-name">${_esc(a.applicant_name || '—')}</div>
                <div class="adm-applicant-email">${_esc(a.applicant_email || '')}</div>
            </td>
            <td>${_esc(a.institute_name || '—')}</td>
            <td>${_esc(a.category_name || '—')}</td>
            <td>${sub}</td>
            <td><span class="adm-pill ${sc}">${_esc(a.status || '—')}</span></td>
            <td>
                <div class="adm-action-group">
                    <button class="adm-btn adm-btn-view adm-app-view"  data-id="${a.id}">View</button>
                    <button class="adm-btn adm-btn-track adm-app-track" data-id="${a.id}">Track</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.adm-app-view').forEach(btn  => btn.addEventListener('click', () => _openAppDetail(Number(btn.dataset.id), 'detail')));
    tbody.querySelectorAll('.adm-app-track').forEach(btn => btn.addEventListener('click', () => _openAppDetail(Number(btn.dataset.id), 'track')));
    feather.replace();
}

function _initAppFilters() {
    _app.querySelectorAll('.adm-filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            _app.querySelectorAll('.adm-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _state.currentFilter = btn.dataset.filter;
            _renderAppsTable();
        });
    });
}

function _initAppSearch() {
    const inp = _app.querySelector('#adm-search-input');
    if (!inp) return;
    inp.addEventListener('input', () => { _state.searchQuery = inp.value; _renderAppsTable(); });
}

// ── Application Detail / Track Modal ─────────────────────────────────────
async function _openAppDetail(appId, mode) {
    const modal   = _app.querySelector('#adm-app-modal');
    const title   = _app.querySelector('#adm-app-modal-title');
    const content = _app.querySelector('#adm-app-modal-content');
    const app     = _state.applications.find(a => a.id === appId);

    title.textContent = mode === 'track' ? '📍 Application Tracking Timeline' : '📋 Application Detail';
    content.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading…</div>`;
    modal.classList.add('open');
    feather.replace();

    if (mode === 'detail') {
        content.innerHTML = app ? _buildAppDetailHtml(app) : '<p>Not found.</p>';
        
        // Wire identity button
        const idBtn = content.querySelector('.adm-check-identity-btn');
        if (idBtn) {
            idBtn.addEventListener('click', () => _handleViewIdentity(idBtn.dataset.uid));
        }

        feather.replace();
        return;
    }

    try {
        const res  = await authFetch(API.ADMIN_APP_TRACKER(appId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        content.innerHTML = _buildTrackHtml(data.application, data.steps);
    } catch (err) {
        content.innerHTML = `<p style="color:#ef4444;padding:1rem;">Failed to load tracker: ${err.message}</p>`;
    }
    feather.replace();
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
        const url  = URL.createObjectURL(blob);
        
        const overlay = _app.querySelector('#adm-zoom-overlay');
        const zoomImg = _app.querySelector('#adm-zoom-img');
        zoomImg.src = url;
        overlay.classList.add('open');

        // Setup zoom overlay close
        _app.querySelector('#adm-zoom-close-btn').onclick = () => {
            overlay.classList.remove('open');
            URL.revokeObjectURL(url); // Cleanup
        };
        overlay.onclick  = (e) => { 
            if(e.target.id === 'adm-zoom-overlay') {
                overlay.classList.remove('open');
                URL.revokeObjectURL(url);
            }
        };

        feather.replace();
    } catch (err) {
        _showToast(err.message, 'error');
    }
}

function _buildAppDetailHtml(a) {
    const rows = [
        ['Application ID', `<span style="font-family:monospace;font-weight:700;color:#6366f1;background:#eef2ff;padding:0.15rem 0.4rem;border-radius:0.3rem;">${_esc(a.application_id || a.id)}</span>`],
        ['Applicant',      _esc(a.applicant_name)],
        ['Email',          _esc(a.applicant_email)],
        ['Institute',      _esc(a.institute_name)],
        ['Category',       _esc(a.category_name)],
        ['Workflow',       _esc(a.workflow_name)],
        ['Request Type',   _esc(a.request_name)],
        ['Current Status', _esc(a.current_status)],
        ['LIGO Member',    _esc(a.ligo_member)],
        ['Duration',       _esc(a.duration)],
        ['Submitted',      a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-GB') : '—'],
        ['Approved By',    _esc(a.approved_by_name)],
        ['Approved At',    a.approved_at ? new Date(a.approved_at).toLocaleString('en-GB') : '—'],
    ].filter(([, v]) => v && v !== '—');

    const sc = { approved: 'adm-pill-approved', rejected: 'adm-pill-rejected' }[a.status] || 'adm-pill-pending';
    return `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
        <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
            ${_esc((a.applicant_name || '?')[0].toUpperCase())}
        </div>
        <div>
            <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${_esc(a.applicant_name || '—')}</div>
            <div style="color:#64748b;font-size:0.85rem;">${_esc(a.applicant_email || '')}</div>
        </div>
        <span class="adm-pill ${sc}" style="margin-left:auto;">${_esc(a.status)}</span>
    </div>
    <dl style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem 1.5rem;">
    ${rows.map(([label, value]) => `
        <div>
            <dt style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;">${_esc(label)}</dt>
            <dd style="font-size:0.9rem;color:#334155;margin:0.2rem 0 0;">${value}</dd>
        </div>`).join('')}
    </dl>
    ${a.id_card_path ? `
    <div style="margin-top:2rem;padding:1.25rem;background:#f8fafc;border-radius:0.75rem;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
        <div style="display:flex;align-items:center;gap:0.75rem;color:#475569;">
            <div style="width:40px;height:40px;border-radius:50%;background:#e0f2fe;display:flex;align-items:center;justify-content:center;color:#0ea5e9;">
                <svg data-feather="file-text" style="width:20px;height:20px;"></svg>
            </div>
            <div>
                <div style="font-weight:700;font-size:0.9rem;color:#0f172a;">Identity Document</div>
                <div style="font-size:0.75rem;color:#64748b;">Verification required for approval</div>
            </div>
        </div>
        <button class="adm-btn adm-btn-primary adm-check-identity-btn" data-uid="${a.applicant_user_id || a.user_id}">
            <svg data-feather="eye" style="width:16px;height:16px;margin-right:0.4rem;"></svg>
            Check Identity
        </button>
        <div id="adm-identity-preview-container"></div>
    </div>` : ''}
    `;
}

function _buildTrackHtml(app, steps) {
    const header = `
        <div style="margin-bottom:1.5rem;padding:1.25rem;background:#f8fafc;border-radius:0.75rem;border:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-weight:800;color:#0f172a;font-size:1rem;margin-bottom:0.25rem;">${_esc(app.applicant_name || '—')}</div>
                <div style="font-family:monospace;font-size:0.8rem;color:#6366f1;font-weight:600;">ID: ${_esc(app.application_id || String(app.id))}</div>
            </div>
            <div class="adm-pill ${app.status === 'approved' ? 'adm-pill-approved' : 'adm-pill-pending'}">
                ${_esc(app.status)}
            </div>
        </div>`;

    const submittedDate = app.submitted_at ? new Date(app.submitted_at).toLocaleString('en-GB') : 'Unknown';
    const submittedStep = `
        <div class="adm-tl-step">
            <div class="adm-tl-dot done"><i data-feather="check"></i></div>
            <div class="adm-tl-info">
                <div class="adm-tl-label">Application Submitted</div>
                <div class="adm-tl-meta">${submittedDate}</div>
                <div class="adm-tl-remarks">Submission record created.</div>
            </div>
        </div>`;

    const workflowSteps = (steps || []).map(s => {
        const isApproved = !!s.approved_at;
        const isCurrent  = !isApproved && app.current_step_id === s.workflow_step_id;
        const isFuture   = !isApproved && !isCurrent;

        const dotCls = isApproved ? 'done' : isCurrent ? '' : 'future';
        const icon   = isApproved ? 'check' : isCurrent ? 'clock' : 'circle';
        
        const label = isApproved ? 'Approved' : (isCurrent ? _esc(s.status_name) : _esc(s.status_name));
        
        return `
        <div class="adm-tl-step ${isFuture ? 'adm-tl-future' : ''}">
            <div class="adm-tl-dot ${dotCls}"><i data-feather="${icon}"></i></div>
            <div class="adm-tl-info">
                <div class="adm-tl-label">${label}</div>
                <div class="adm-tl-meta">
                    ${isApproved ? `By ${_esc(s.approved_by_name || 'System')} · ${new Date(s.approved_at).toLocaleString('en-GB')}` : isCurrent ? 'Action required' : 'Next in sequence'}
                </div>
            </div>
        </div>`;
    }).join('');

    return `${header}
    <div style="padding:0.5rem;">
        <div class="adm-timeline">
            ${submittedStep}
            ${workflowSteps}
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. WORKFLOW ENGINE — live from backend
// ═══════════════════════════════════════════════════════════════════════════
async function _loadWorkflows() {
    const container = _app.querySelector('#adm-wf-container');
    container.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading workflows…</div>`;

    try {
        const res = await authFetch(API.ADMIN_WORKFLOWS_FULL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const workflows = await res.json();

        if (!workflows.length) {
            container.innerHTML = `<div class="adm-empty"><span>🔄</span>No workflows configured yet.</div>`;
            return;
        }

        container.innerHTML = `<div class="adm-cards-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));">${
            workflows.map(wf => _buildWorkflowCard(wf)).join('')
        }</div>`;

        // Wire click → detail modal
        container.querySelectorAll('.adm-wf-summary-card').forEach(card => {
            card.addEventListener('click', () => {
                const wfId = card.dataset.wfid;
                const wf   = workflows.find(w => String(w.workflow_id) === String(wfId));
                if (wf) _openWorkflowModal(wf);
            });
        });

    } catch (err) {
        container.innerHTML = `<div style="padding:2rem;color:#ef4444;">Failed to load: ${_esc(err.message)}</div>`;
    }
}

function _buildWorkflowCard(wf) {
    const steps   = wf.steps || [];
    const stepCount = steps.length;
    const finalStep = steps.find(s => s.is_final_step);
    const finalRole  = finalStep?.role_name || '—';

    // Pick a colour accent per workflow (cycle through a palette)
    const accents = ['#6366f1','#8b5cf6','#ec4899','#0ea5e9','#14b8a6','#f59e0b','#ef4444'];
    const color   = accents[(wf.workflow_id || 0) % accents.length];

    return `
    <div class="adm-data-card adm-wf-summary-card" data-wfid="${wf.workflow_id}"
         style="--adm-card-accent:${color}; text-align:left; position:relative;">
        <div style="display:flex;align-items:center;gap:0.65rem;margin-bottom:1rem;">
            <div style="width:36px;height:36px;border-radius:0.5rem;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5">
                    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                    <path d="M6 9v6"/><path d="M9 6h6M9 18h6"/>
                </svg>
            </div>
            <div>
                <div class="adm-data-card-title" style="text-align:left;">${_esc(wf.workflow_name)}</div>
                <div class="adm-data-card-sub" style="text-align:left;">${stepCount} step${stepCount !== 1 ? 's' : ''}</div>
            </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
            ${steps.slice(0,3).map((s, i) => `
            <span style="font-size:0.68rem;font-weight:600;padding:0.15rem 0.5rem;border-radius:999px;
                  background:${s.is_final_step ? '#f0fdf4' : '#f1f5f9'};
                  color:${s.is_final_step ? '#16a34a' : '#64748b'};">
                ${i+1}. ${_esc(s.role_name || s.status_name || '—')}
            </span>`).join('')}
            ${steps.length > 3 ? `<span style="font-size:0.68rem;color:#94a3b8;">+${steps.length - 3} more</span>` : ''}
        </div>
        <div style="margin-top:0.85rem;font-size:0.72rem;color:#6366f1;font-weight:600;">Click to view →</div>
    </div>`;
}

function _openWorkflowModal(wf) {
    const modal   = _app.querySelector('#adm-wf-modal');
    const title   = _app.querySelector('#adm-wf-modal-title');
    const content = _app.querySelector('#adm-wf-modal-content');
    const steps   = wf.steps || [];

    title.textContent = `⚙️ ${wf.workflow_name}`;

    const stepsHtml = steps.length ? steps.map((s, i) => {
        const isFinal = s.is_final_step;
        return `
        <div class="adm-wf-step">
            <div class="adm-wf-step-dot ${isFinal ? 'final' : ''}">${isFinal ? '✓' : i + 1}</div>
            <div class="adm-wf-step-info">
                <div class="adm-wf-step-name">${_esc(s.status_name || `Step ${i + 1}`)}</div>
                <div class="adm-wf-step-role">${_esc(s.role_name || 'No role assigned')}</div>
            </div>
            ${isFinal ? `<span class="adm-pill adm-pill-approved" style="align-self:center;margin-left:auto;">Final</span>` : ''}
        </div>`;
    }).join('') : `<div class="adm-empty"><span>🔧</span>No steps configured.</div>`;

    content.innerHTML = `
    <div style="background:#f8fafc;border-radius:0.65rem;padding:1rem;margin-bottom:1.25rem;border:1px solid #e2e8f0;">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;margin-bottom:0.5rem;">Pipeline Overview</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
            ${steps.map((s, i) => `
            <span style="font-size:0.75rem;font-weight:600;padding:0.2rem 0.65rem;border-radius:999px;
                  background:${s.is_final_step ? '#f0fdf4' : '#eef2ff'};
                  color:${s.is_final_step ? '#16a34a' : '#6366f1'};border:1px solid ${s.is_final_step ? '#86efac' : '#c7d2fe'};">
                ${i+1}. ${_esc(s.role_name || s.status_name)}
            </span>
            ${i < steps.length - 1 ? '<span style="color:#cbd5e1;font-size:0.9rem;">→</span>' : ''}`).join('')}
        </div>
    </div>
    <div class="adm-wf-steps">${stepsHtml}</div>`;

    modal.classList.add('open');
    feather.replace();
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. MODIFY DATA MODULE
// ═══════════════════════════════════════════════════════════════════════════
const _ENTITIES = [
    { key: 'institutes',   label: 'Institutes',       icon: '🏛️' },
    { key: 'users_roles',  label: 'Users & Roles',    icon: '🛡️' },
    { key: 'categories',   label: 'Categories',       icon: '🗂️' },
    { key: 'services',     label: 'Services',         icon: '⚙️' },
    { key: 'subservices',  label: 'Sub-services',     icon: '🔧' },
    { key: 'requests',     label: 'Request Types',    icon: '📋' },
    { key: 'systems',      label: 'Systems',          icon: '🖥️' },
    { key: 'subsystems',   label: 'Sub-systems',      icon: '💾' },
];

function _buildModifyCards() {
    return _ENTITIES.map(e => `
        <div class="adm-data-card" data-entity="${e.key}">
            <span class="adm-data-card-icon">${e.icon}</span>
            <div class="adm-data-card-title">${e.label}</div>
        </div>`).join('');
}

function _initModifyCards() {
    _app.querySelectorAll('.adm-data-card[data-entity]').forEach(card => {
        if (card._wired) return;
        card._wired = true;
        card.addEventListener('click', () => {
            const entity = card.dataset.entity;
            if (entity === 'institutes') {
                _switchTab('institutes');
            } else {
                _switchTab('data-admin', entity);
            }
        });
    });
}

async function _loadDataAdmin(entity) {
    const container = _app.querySelector('#adm-data-admin-container');
    const meta      = _ENTITIES.find(e => e.key === entity);
    
    container.innerHTML = `
        <div class="adm-page-header" style="margin-bottom:2rem; display:flex; align-items:center; gap:1.5rem;">
            <button class="adm-btn adm-btn-secondary" onclick="_switchTab('modify')" style="padding:0.5rem; border-radius:50%; width:40px; height:40px;">
                <i data-feather="arrow-left"></i>
            </button>
            <div>
                <h2 class="adm-page-title">${meta?.icon || ''} ${meta?.label || entity} Management</h2>
                <p class="adm-page-sub">Comprehensive view and modification of ${meta?.label.toLowerCase() || 'data'}.</p>
            </div>
        </div>
        <div id="adm-data-admin-content">
            <div class="adm-loading"><div class="adm-spinner"></div> Loading…</div>
        </div>
    `;
    
    feather.replace();
    const content = container.querySelector('#adm-data-admin-content');

    // ── Special: Users & Roles ──────────────────────────────────────────
    if (entity === 'users_roles') {
        content.innerHTML = await _buildUsersPageHtml();
        _wireAssignRoleForm(content);
        feather.replace();
        return;
    }

    // ── Special: Categories ─────────────────────────────────────────────
    if (entity === 'categories') {
        content.innerHTML = await _buildCategoriesPageHtml();
        _wireCategoriesPage(content);
        feather.replace();
        return;
    }

    // ── Generic entity list ─────────────────────────────────────────────
    try {
        const res  = await authFetch(API.ADMIN_DATA(entity));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();

        if (!rows?.length) {
            content.innerHTML = `<div class="adm-empty"><span>📭</span>No records found for this category.</div>`;
            return;
        }

        content.innerHTML = `
            <div class="adm-inst-section">
                <div class="adm-inst-section-title"><i data-feather="list"></i> Existing Records</div>
                <div class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>Name / Identifier</th>
                                <th>Technical Code / Slug</th>
                                <th>Status</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => {
                                const name = row.name || row.workflow_name || row.code || row.slug || Object.values(row)[1] || '—';
                                const sub  = row.slug || row.code || row.type || '—';
                                return `
                                <tr>
                                    <td><strong>${_esc(String(name))}</strong></td>
                                    <td><code style="color:#6366f1;">${_esc(String(sub))}</code></td>
                                    <td>
                                        <span class="adm-pill ${row.is_active === false ? 'adm-pill-pending' : 'adm-pill-approved'}">
                                            ${row.is_active === false ? 'Inactive' : 'Active'}
                                        </span>
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="adm-btn adm-btn-secondary" style="font-size:0.7rem;">Modify</button>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        feather.replace();
    } catch (err) {
        content.innerHTML = `<div class="adm-empty"><span>❌</span>Failed: ${_esc(err.message)}</div>`;
    }
}

// ── Users page with assign-role form ─────────────────────────────────────
async function _buildUsersPageHtml() {
    let rolesOptions = '<option value="">— Select Role —</option>';
    let instOptions  = '<option value="">— Select Institute —</option>';
    let catOptions   = '<option value="">— Select Category —</option>';

    try {
        const [rRes, iRes, cRes] = await Promise.all([
            authFetch(API.ADMIN_ROLES),
            authFetch(API.ADMIN_INSTITUTES),
            authFetch(API.ADMIN_DATA('categories'))
        ]);
        if (rRes.ok) { const roles = await rRes.json(); rolesOptions += roles.map(r => `<option value="${r.id}">${_esc(r.name)}</option>`).join(''); }
        if (iRes.ok) { const data = await iRes.json(); instOptions += data.active.map(i => `<option value="${i.id}">${_esc(i.name)}</option>`).join(''); }
        if (cRes.ok) { const cats = await cRes.json(); catOptions += cats.map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join(''); }
    } catch (_) {}

    return `
    <div class="adm-inst-section" style="margin-bottom:2rem;">
        <div class="adm-inst-section-title"><i data-feather="user-plus"></i> Assign Role & Affiliation</div>
        <div class="adm-form" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:1.25rem;">
            <div class="adm-form-group">
                <label class="adm-label">User Email</label>
                <input id="adm-m-assign-email" type="email" placeholder="user@example.com" />
            </div>
            <div class="adm-form-group">
                <label class="adm-label">Institute (Affiliation)</label>
                <select id="adm-m-inst-select" class="adm-select">${instOptions}</select>
            </div>
            <div class="adm-form-group">
                <label class="adm-label">User Category</label>
                <select id="adm-m-cat-select" class="adm-select">${catOptions}</select>
            </div>
            <div class="adm-form-group">
                <label class="adm-label">Assign Role</label>
                <select id="adm-m-role-select" class="adm-select">${rolesOptions}</select>
            </div>
        </div>
        <div id="adm-m-assign-fb" style="min-height:1.2rem; font-size:0.85rem; margin:1rem 0;"></div>
        <button id="adm-m-assign-btn" class="adm-btn adm-btn-primary" style="width:auto; padding:0.75rem 2.5rem;">Update User Access</button>
    </div>

    <div class="adm-tabs-mini" style="display:flex; gap:1rem; margin-bottom:1.5rem; border-bottom:1px solid #e2e8f0; padding-bottom:1rem;">
        <button class="adm-tab-mini-btn active" data-subtab="users"><i data-feather="users"></i> Check Users</button>
        <button class="adm-tab-mini-btn" data-subtab="roles"><i data-feather="shield"></i> Check Roles</button>
    </div>

    <div id="adm-users-subtab-content">
        <!-- Loaded dynamically -->
    </div>
    `;
}

async function _wireAssignRoleForm(content) {
    const loadUserList = async () => {
        const ul = content.querySelector('#adm-m-users-list');
        if (!ul) return;
        try {
            const res  = await authFetch(API.ADMIN_DATA('users'));
            const list = res.ok ? await res.json() : [];
            ul.innerHTML = list.length ? `
                <div class="adm-crud-list">
                    ${list.slice(0, 30).map(u => `
                    <div class="adm-crud-row">
                        <div style="flex:1">
                            <div class="adm-crud-row-text">${_esc(u.name)}</div>
                            <div class="adm-crud-row-sub">${_esc(u.email)}</div>
                        </div>
                        <span class="adm-pill ${u.status === 'completed' ? 'adm-pill-approved' : 'adm-pill-pending'}">${_esc(u.status)}</span>
                    </div>`).join('')}
                </div>` :
                `<div class="adm-empty"><span>👤</span>No users found.</div>`;
        } catch (_) {}
    };

    loadUserList();

    const btn = content.querySelector('#adm-m-assign-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const email  = content.querySelector('#adm-m-assign-email')?.value.trim();
        const roleId = content.querySelector('#adm-m-role-select')?.value;
        const fb     = content.querySelector('#adm-m-assign-fb');
        if (!email || !roleId) { fb.style.color = '#ef4444'; fb.textContent = 'Please fill in both fields.'; return; }

        btn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = 'Assigning…';
        try {
            const res  = await authFetch(API.ADMIN_ASSIGN_ROLE, { method: 'POST', body: JSON.stringify({ email, role_id: roleId }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error');
            fb.style.color = '#10b981'; fb.textContent = data.message || '✓ Role assigned.';
            content.querySelector('#adm-m-assign-email').value = '';
            content.querySelector('#adm-m-role-select').value  = '';
            loadUserList();
        } catch (err) {
            fb.style.color = '#ef4444'; fb.textContent = err.message;
        } finally { btn.disabled = false; }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. INSTITUTE MANAGEMENT (NEW)
// ═══════════════════════════════════════════════════════════════════════════
async function _loadInstitutes() {
    const container = _app.querySelector('#adm-inst-container');
    container.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading institutes…</div>`;

    try {
        const res = await authFetch(API.ADMIN_INSTITUTES);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { active, pending } = await res.json();
        
        _renderInstitutes(container, active, pending);
    } catch (err) {
        container.innerHTML = `<div class="adm-empty"><span>❌</span>Failed to load institutes: ${err.message}</div>`;
    }
}

function _renderInstitutes(container, active, pending) {
    container.innerHTML = `
        <div class="adm-page-header" style="margin-bottom:2rem; display:flex; align-items:center; gap:1.5rem;">
            <button class="adm-btn adm-btn-secondary" onclick="_switchTab('modify')" style="padding:0.5rem; border-radius:50%; width:40px; height:40px;">
                <i data-feather="arrow-left"></i>
            </button>
            <div>
                <h2 class="adm-page-title">🏛️ Institute Management</h2>
                <p class="adm-page-sub">Add new authorized institutes or review pending registrations</p>
            </div>
        </div>
        <!-- Direct Register -->
        <section class="adm-inst-section">
            <div class="adm-inst-section-title"><i data-feather="plus-circle"></i> Directly Register New Institute</div>
            <div class="adm-inst-create-box" style="padding:2rem; max-width:100%; box-shadow:none; border:none; background:#f8fafc; border-radius:1rem;">
                <div class="adm-form" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1.5rem; margin-bottom:1.5rem;">
                    <div class="adm-form-group">
                        <label class="adm-label">Institute Formal Name</label>
                        <input type="text" id="adm-in-name" placeholder="Oxford University" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">Institute Code</label>
                        <input type="text" id="adm-in-code" placeholder="OXF" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">City</label>
                        <input type="text" id="adm-in-city" placeholder="London" />
                    </div>
                </div>
                <button class="adm-btn adm-btn-primary" id="adm-in-btn" style="width: auto; padding: 0.75rem 2rem;">Register & Approve Institute</button>
                <div id="adm-in-fb" class="adm-inst-fb"></div>
            </div>
        </section>

        <!-- Pending Table -->
        <section class="adm-inst-section">
            <div class="adm-inst-section-title"><i data-feather="clock"></i> Pending Institute Approvals</div>
            ${pending.length ? `
                <div class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>Institute Name</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pending.map(p => `
                                <tr>
                                    <td><strong>${_esc(p.name)}</strong></td>
                                    <td><span class="adm-pill adm-pill-pending">Pending Review</span></td>
                                    <td>
                                        <button class="adm-btn adm-btn-success adm-inst-approve" data-id="${p.id}" data-name="${_esc(p.name)}" data-code="${_esc(p.code)}">Review & Approve</button>
                                        <button class="adm-btn adm-btn-danger adm-inst-reject" data-id="${p.id}" style="margin-left:0.5rem;">Reject</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : `<div class="adm-empty" style="padding:2rem;">No pending approvals.</div>`}
        </section>

        <!-- Active List -->
        <section class="adm-inst-section">
            <div class="adm-inst-section-title"><i data-feather="check-circle"></i> Active Authorized Institutes</div>
            <div class="adm-table-wrap">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th>Institute</th>
                            <th>Code</th>
                            <th>City</th>
                            <th>Current Status</th>
                            <th style="text-align:right;">Toggle Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${active.map(a => `
                            <tr>
                                <td>
                                    <div style="display:flex; align-items:center; gap:0.75rem;">
                                        <div class="active-inst-icon" style="width:32px; height:32px; font-size:0.8rem;">${(a.name||'?')[0]}</div>
                                        <strong>${_esc(a.name)}</strong>
                                    </div>
                                </td>
                                <td><code style="color:#6366f1;">${_esc(a.code)}</code></td>
                                <td>${_esc(a.city || '—')}</td>
                                <td>
                                    <span class="adm-pill ${a.status === 'active' ? 'adm-pill-approved' : 'adm-pill-pending'}">
                                        ${a.status === 'active' ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td style="text-align:right;">
                                    <button class="adm-btn ${a.status === 'active' ? 'adm-btn-disable' : 'adm-btn-enable'} adm-inst-toggle" data-id="${a.id}" style="font-size:0.75rem;">
                                        ${a.status === 'active' ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </section>
    `;
    
    feather.replace();
    _wireInstituteActions(container);
}

function _wireInstituteActions(container) {
    // Direct Register
    const regBtn = container.querySelector('#adm-in-btn');
    if (regBtn) {
        regBtn.addEventListener('click', async () => {
            const name = container.querySelector('#adm-in-name').value.trim();
            const code = container.querySelector('#adm-in-code').value.trim();
            const city = container.querySelector('#adm-in-city').value.trim();
            const fb = container.querySelector('#adm-in-fb');
            if (!name || !code) { fb.style.color = '#ef4444'; fb.textContent = 'Name and Code are required.'; return; }
            
            regBtn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = 'Processing…';
            try {
                const res = await authFetch(API.ADMIN_INSTITUTES, {
                    method: 'POST',
                    body: JSON.stringify({ name, code, city })
                });
                if (res.ok) {
                    _showToast('Institute registered successfully', 'success');
                    _loadInstitutes();
                } else {
                    const err = await res.json();
                    fb.style.color = '#ef4444'; fb.textContent = err.message || 'Registration failed.';
                }
            } catch (e) { fb.style.color = '#ef4444'; fb.textContent = e.message; }
            finally { regBtn.disabled = false; }
        });
    }

    // Approve Button (Review before approve)
    container.querySelectorAll('.adm-inst-approve').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = _app.querySelector('#adm-inst-edit-modal');
            const form  = modal.querySelector('#adm-inst-edit-form');
            form.querySelector('[name="name"]').value = btn.dataset.name;
            form.querySelector('[name="code"]').value = btn.dataset.code;
            form.querySelector('[name="city"]').value = ''; // Primary modification field
            
            modal.classList.add('open');
            
            form.onsubmit = async (e) => {
                e.preventDefault();
                const updated = {
                    name: form.querySelector('[name="name"]').value,
                    code: form.querySelector('[name="code"]').value,
                    city: form.querySelector('[name="city"]').value,
                };
                try {
                    const res = await authFetch(`${API.ADMIN_INSTITUTES}/${btn.dataset.id}/approve`, {
                        method: 'PATCH',
                        body: JSON.stringify(updated)
                    });
                    if (res.ok) {
                        modal.classList.remove('open');
                        _showToast('Institute approved with modifications', 'success');
                        _loadInstitutes();
                    } else {
                        const err = await res.json();
                        alert(err.message || 'Approval failed');
                    }
                } catch (err) { alert(err.message); }
            };
        });
    });

    // Reject Button
    container.querySelectorAll('.adm-inst-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Reject this institute registration?')) return;
            try {
                const res = await authFetch(`${API.ADMIN_INSTITUTES}/${btn.dataset.id}`, { method: 'DELETE' });
                if (res.ok) { _showToast('Institute rejected', 'info'); _loadInstitutes(); }
            } catch (err) { _showToast(err.message, 'error'); }
        });
    });

    // Toggle Status
    container.querySelectorAll('.adm-inst-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const res = await authFetch(API.ADMIN_INSTITUTE_TOGGLE(btn.dataset.id), { method: 'PATCH' });
                if (res.ok) { 
                    _showToast('Status updated', 'success'); 
                    _loadInstitutes(); 
                }
            } catch (err) { _showToast(err.message, 'error'); }
        });
    });

    // Wire cancel/close for the specific modal
    _app.querySelector('#adm-inst-edit-close').onclick = () => _app.querySelector('#adm-inst-edit-modal').classList.remove('open');
    _app.querySelector('#adm-inst-edit-cancel').onclick = () => _app.querySelector('#adm-inst-edit-modal').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. MODALS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
function _initModals() {
    const ids = ['adm-app-modal', 'adm-wf-modal', 'adm-modify-modal'];
    ids.forEach(id => {
        const overlay = _app.querySelector(`#${id}`);
        overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    });
    ['adm-app-modal-close','adm-wf-modal-close','adm-modify-modal-close'].forEach(btnId => {
        _app.querySelector(`#${btnId}`)?.addEventListener('click', () =>
            _app.querySelectorAll('.adm-modal-overlay').forEach(m => m.classList.remove('open'))
        );
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') _app.querySelectorAll('.adm-modal-overlay.open').forEach(m => m.classList.remove('open'));
    });
}

function _showToast(msg, type = 'info') {
    const c = _app.querySelector('#adm-toast-container') || document.querySelector('#adm-toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `adm-toast ${type}`; t.textContent = msg;
    c.appendChild(t); setTimeout(() => t.remove(), 3500);
}

function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function _buildCategoriesPageHtml() {
    let parentOptions = '<option value="">None (Top Level Category)</option>';
    try {
        const res = await authFetch(API.ADMIN_DATA('categories'));
        if (res.ok) {
            const cats = await res.json();
            parentOptions += cats.filter(c => !c.parent_id).map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join('');
        }
    } catch (_) {}

    return `
    <div class="adm-inst-section" style="margin-bottom:2rem; background:#f8fafc; border-color:#e2e8f0;">
        <div class="adm-inst-section-title"><i data-feather="plus-square"></i> Create New Category or Sub-Category</div>
        <div class="adm-form" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:1.25rem;">
            <div class="adm-form-group">
                <label class="adm-label">Parent Category? (Leave none for top-level)</label>
                <select id="cat-parent-id" class="adm-select">${parentOptions}</select>
            </div>
            <div class="adm-form-group">
                <label class="adm-label">Category Name</label>
                <input type="text" id="cat-name" placeholder="e.g. Science, Undergraduate" />
            </div>
            <div class="adm-form-group">
                <label class="adm-label">URL Slug (Technical)</label>
                <input type="text" id="cat-slug" placeholder="e.g. science-sub" />
            </div>
        </div>
        <div id="cat-create-fb" style="min-height:1.2rem; font-size:0.85rem; margin:1rem 0;"></div>
        <button id="cat-create-btn" class="adm-btn adm-btn-primary" style="width:auto; padding:0.75rem 2.5rem;">Save Category</button>
    </div>

    <div class="adm-inst-section">
        <div class="adm-inst-section-title"><i data-feather="list"></i> Existing Categories Hierarchy</div>
        <div id="cat-list-container" class="adm-table-wrap">
            <div class="adm-spinner"></div>
        </div>
    </div>
    `;
}

function _wireCategoriesPage(container) {
    const btn = container.querySelector('#cat-create-btn');
    const fb  = container.querySelector('#cat-create-fb');
    const listView = container.querySelector('#cat-list-container');

    const loadList = async () => {
        try {
            const res = await authFetch(API.ADMIN_DATA('categories'));
            if (!res.ok) throw new Error();
            const rows = await res.json();
            
            const parents = rows.filter(r => !r.parent_id);
            const children = rows.filter(r => r.parent_id);
            
            listView.innerHTML = parents.map(p => {
                const subCats = children.filter(c => c.parent_id === p.id);
                return `
                <div class="adm-accordion">
                    <div class="adm-accordion-header">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <span class="adm-pill ${p.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}" style="font-size:0.65rem;">
                                ${p.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <strong>${_esc(p.name)}</strong>
                            <code style="font-size:0.75rem; color:#6366f1;">${_esc(p.slug)}</code>
                        </div>
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <button class="adm-btn ${p.is_active ? 'adm-btn-disable' : 'adm-btn-enable'} cat-toggle-btn" data-id="${p.id}" style="font-size:0.7rem; padding:0.35rem 0.75rem;">
                                ${p.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <span style="font-size:0.75rem; color:#94a3b8;">${subCats.length} Sub-categories</span>
                            <i data-feather="chevron-down"></i>
                        </div>
                    </div>
                    <div class="adm-accordion-content">
                        <div class="adm-table-wrap" style="border:none; border-top:1px solid #f1f5f9; border-radius:0;">
                            <table class="adm-table" style="margin-bottom:0;">
                                <thead style="background:#fdfdfe;">
                                    <tr>
                                        <th style="padding-left:3.5rem;">Sub-Category Name</th>
                                        <th>Slug</th>
                                        <th>Status</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${subCats.length ? subCats.map(c => `
                                        <tr>
                                            <td style="padding-left:3.5rem;">
                                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                                    <div style="width:8px; height:8px; border-radius:50%; background:#e2e8f0;"></div>
                                                    <span>${_esc(c.name)}</span>
                                                </div>
                                            </td>
                                            <td><code>${_esc(c.slug)}</code></td>
                                            <td>
                                                <span class="adm-pill ${c.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}">
                                                    ${c.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style="text-align:right;">
                                                <button class="adm-btn ${c.is_active ? 'adm-btn-disable' : 'adm-btn-enable'} cat-toggle-btn" data-id="${c.id}" style="font-size:0.65rem; padding:0.3rem 0.6rem;">
                                                    ${c.is_active ? 'Disable' : 'Enable'}
                                                </button>
                                            </td>
                                        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:2rem;">No sub-categories found.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            }).join('');
            
            feather.replace();

            // Wire accordion toggles
            listView.querySelectorAll('.adm-accordion-header').forEach(header => {
                header.onclick = (e) => {
                    if (e.target.closest('.cat-toggle-btn')) return;
                    header.parentElement.classList.toggle('open');
                };
            });

            // Wire status toggles
            listView.querySelectorAll('.cat-toggle-btn').forEach(b => {
                b.onclick = async (e) => {
                    e.stopPropagation();
                    try {
                        const tRes = await authFetch(`${API.BASE_URL}/api/auth/admin/categories/${b.dataset.id}/toggle`, { method: 'PATCH' });
                        if (tRes.ok) { _showToast('Category updated'); loadList(); }
                    } catch (_) {}
                };
            });
        } catch (_) { listView.innerHTML = 'Error loading categories.'; }
    };

    btn.onclick = async () => {
        const name = container.querySelector('#cat-name').value.trim();
        const parent_id = container.querySelector('#cat-parent-id').value;
        const slug = container.querySelector('#cat-slug').value.trim();
        
        if (!name || !slug) { fb.style.color = '#ef4444'; fb.textContent = 'Name and Slug are required.'; return; }
        
        btn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = 'Saving…';
        try {
            const res = await authFetch(`${API.BASE_URL}/api/auth/admin/categories`, {
                method: 'POST',
                body: JSON.stringify({ name, parent_id, slug })
            });
            if (res.ok) {
                fb.style.color = '#10b981'; fb.textContent = '✓ Category created.';
                container.querySelector('#cat-name').value = '';
                container.querySelector('#cat-slug').value = '';
                loadList();
            } else {
                const data = await res.json();
                throw new Error(data.message || 'Error');
            }
        } catch (err) { fb.style.color = '#ef4444'; fb.textContent = err.message; }
        finally { btn.disabled = false; }
    };

    loadList();
}
