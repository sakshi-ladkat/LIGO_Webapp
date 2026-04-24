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

            <!-- ─── MODIFY DATA TAB ─── -->
            <div id="adm-tab-modify" class="adm-tab">
                <div class="adm-page-header">
                    <h1 class="adm-page-title">Modify Data</h1>
                </div>
                <div class="adm-cards-grid" id="adm-modify-cards">
                    ${_buildModifyCards()}
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
        case 'workflows':    _loadWorkflows();    break;
        case 'modify':       _initModifyCards();  break;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. APPLICATIONS MODULE
// ═══════════════════════════════════════════════════════════════════════════
async function _loadApplications() {
    const tbody = _app.querySelector('#adm-applications-tbody');
    tbody.innerHTML = `<tr><td colspan="7"><div class="adm-loading"><div class="adm-spinner"></div> Fetching applications…</div></td></tr>`;

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
        const sc  = { approved: 'adm-pill-approved', rejected: 'adm-pill-rejected', pending: 'adm-pill-pending' }[a.status] || 'adm-pill-default';
        const sub = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-GB') : '—';
        const pending = !['approved','rejected'].includes(a.status);
        return `
        <tr>
            <td><span style="font-family:monospace;font-size:0.78rem;color:#6366f1;">${_esc(a.application_id || a.id)}</span></td>
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
                    <button class="adm-btn adm-btn-secondary adm-app-view"  data-id="${a.id}">View</button>
                    <button class="adm-btn adm-btn-secondary adm-app-track" data-id="${a.id}">Track</button>
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
        feather.replace();
        return;
    }

    try {
        const res  = await authFetch(API.ADMIN_APP_LOGS(appId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const logs = await res.json();
        content.innerHTML = _buildTrackHtml(app, logs);
    } catch (err) {
        content.innerHTML = `<p style="color:#ef4444;">Failed: ${_esc(err.message)}</p>`;
    }
    feather.replace();
}

function _buildAppDetailHtml(a) {
    const rows = [
        ['Application ID', a.application_id || a.id],
        ['Applicant',      a.applicant_name],
        ['Email',          a.applicant_email],
        ['Institute',      a.institute_name],
        ['Category',       a.category_name],
        ['Workflow',       a.workflow_name],
        ['Request Type',   a.request_name],
        ['Current Status', a.current_status],
        ['LIGO Member',    a.ligo_member],
        ['Duration',       a.duration],
        ['Submitted',      a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-GB') : '—'],
        ['Approved By',    a.approved_by_name],
        ['Approved At',    a.approved_at ? new Date(a.approved_at).toLocaleString('en-GB') : '—'],
    ].filter(([, v]) => v);

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
            <dd style="font-size:0.9rem;color:#334155;margin:0.2rem 0 0;">${_esc(String(value))}</dd>
        </div>`).join('')}
    </dl>`;
}

function _buildTrackHtml(app, logs) {
    const header = app ? `
        <div style="margin-bottom:1.25rem;padding:1rem;background:#f8fafc;border-radius:0.5rem;border:1px solid #e2e8f0;">
            <div style="font-weight:700;color:#0f172a;">${_esc(app.applicant_name || '—')}</div>
            <div style="font-size:0.8rem;color:#64748b;">${_esc(app.application_id || String(app.id))}</div>
        </div>` : '';

    const submittedNode = `
    <div class="adm-tl-step">
        <div class="adm-tl-dot done"><svg data-feather="check" style="width:10px;height:10px;"></svg></div>
        <div class="adm-tl-label">Application Submitted</div>
        <div class="adm-tl-meta">${app?.submitted_at ? new Date(app.submitted_at).toLocaleString('en-GB') : ''}</div>
    </div>`;

    if (!logs?.length) return `${header}<div class="adm-timeline">${submittedNode}<div class="adm-tl-step"><div style="color:#94a3b8;font-size:0.85rem;margin-top:1rem;">⏳ No review actions yet.</div></div></div>`;

    const steps = logs.map(log => {
        const isReject = log.action === 'reject';
        const isDone   = log.action === 'approve';
        const dotCls   = isReject ? 'reject' : isDone ? 'done' : '';
        const icon     = isReject ? 'x' : isDone ? 'check' : 'clock';
        return `
        <div class="adm-tl-step">
            <div class="adm-tl-dot ${dotCls}"><svg data-feather="${icon}" style="width:10px;height:10px;"></svg></div>
            <div class="adm-tl-label">${_esc(log.step_name || log.action)}</div>
            <div class="adm-tl-meta">
                ${_esc(log.actor_name || '—')}
                ${log.role_name ? `· <em>${_esc(log.role_name)}</em>` : ''}
                ${log.timestamp ? `· ${new Date(log.timestamp).toLocaleString('en-GB')}` : ''}
            </div>
            ${log.remarks ? `<div class="adm-tl-remarks">"${_esc(log.remarks)}"</div>` : ''}
        </div>`;
    }).join('');

    return `${header}<div class="adm-timeline">${submittedNode}${steps}</div>`;
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
        card.addEventListener('click', () => _openModifyModal(card.dataset.entity));
    });
}

async function _openModifyModal(entity) {
    const modal   = _app.querySelector('#adm-modify-modal');
    const title   = _app.querySelector('#adm-modify-modal-title');
    const content = _app.querySelector('#adm-modify-modal-content');
    const meta    = _ENTITIES.find(e => e.key === entity);

    title.textContent = `${meta?.icon || ''} ${meta?.label || entity}`;
    content.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading…</div>`;
    modal.classList.add('open');
    feather.replace();

    // ── Special: Users & Roles ──────────────────────────────────────────
    if (entity === 'users_roles') {
        content.innerHTML = await _buildUsersModalHtml();
        _wireAssignRoleForm(content);
        feather.replace();
        return;
    }

    // ── Special: Institutes management UI ──────────────────────────────
    if (entity === 'institutes') {
        content.innerHTML = _buildInstitutesModalHtml();
        _wireInstitutesModal(content);
        feather.replace();
        return;
    }

    // ── Generic entity list ─────────────────────────────────────────────
    try {
        const res  = await authFetch(API.ADMIN_DATA(entity));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();

        if (!rows?.length) {
            content.innerHTML = `<div class="adm-empty"><span>📭</span>No records found.</div>`;
            return;
        }

        content.innerHTML = `
            <div style="font-size:0.8rem;color:#64748b;margin-bottom:0.75rem;">${rows.length} record(s)</div>
            <div class="adm-crud-list">
                ${rows.map(row => {
                    const name = row.name || row.workflow_name || row.code || row.slug || Object.values(row)[1] || '—';
                    const sub  = row.slug || row.code || row.type || '';
                    return `
                    <div class="adm-crud-row">
                        <div>
                            <div class="adm-crud-row-text">${_esc(String(name))}</div>
                            ${sub ? `<div class="adm-crud-row-sub">${_esc(String(sub))}</div>` : ''}
                        </div>
                        <span class="adm-pill ${row.is_active === false ? 'adm-pill-pending' : 'adm-pill-active'}">
                            ${row.is_active === false ? 'Inactive' : 'Active'}
                        </span>
                    </div>`;
                }).join('')}
            </div>`;
    } catch (err) {
        content.innerHTML = `<p style="color:#ef4444;">Failed: ${_esc(err.message)}</p>`;
    }
}

// ── Users modal with assign-role form ─────────────────────────────────────
async function _buildUsersModalHtml() {
    // Fetch roles list for the select
    let rolesOptions = '<option value="">— Select Role —</option>';
    try {
        const res = await authFetch(API.ADMIN_ROLES);
        if (res.ok) {
            const roles = await res.json();
            rolesOptions += roles.map(r => `<option value="${r.id}">${_esc(r.name)}</option>`).join('');
        }
    } catch (_) {}

    return `
    <div class="adm-form-panel" style="margin-bottom:1.5rem;">
        <div class="adm-form-title">Assign Role to User</div>
        <div class="adm-two-col">
            <div class="adm-input-group" style="margin:0;">
                <label class="adm-label">User Email</label>
                <input id="adm-m-assign-email" class="adm-input" type="email" placeholder="user@example.com">
            </div>
            <div class="adm-input-group" style="margin:0;">
                <label class="adm-label">Role</label>
                <select id="adm-m-role-select" class="adm-select">${rolesOptions}</select>
            </div>
        </div>
        <div id="adm-m-assign-fb" style="min-height:1.2rem;font-size:0.82rem;margin-top:0.75rem;"></div>
        <button id="adm-m-assign-btn" class="adm-btn adm-btn-primary" style="margin-top:0.5rem;">Assign Role</button>
    </div>
    <div style="font-size:0.8rem;color:#64748b;margin-bottom:0.5rem;font-weight:600;">Recent Users</div>
    <div id="adm-m-users-list"><div class="adm-loading"><div class="adm-spinner"></div></div></div>`;
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

// ── Institutes management inside modal ──────────────────────────────────────
function _buildInstitutesModalHtml() {
    return `
    <div class="adm-form-panel" style="margin-bottom:1.5rem;">
        <div class="adm-form-title">Register New Institute</div>
        <div class="adm-two-col">
            <div class="adm-input-group" style="margin:0;">
                <label class="adm-label">Institute Name</label>
                <input id="adm-m-inst-name" class="adm-input" type="text" placeholder="e.g. Oxford University">
            </div>
            <div class="adm-input-group" style="margin:0;">
                <label class="adm-label">Institute Code</label>
                <input id="adm-m-inst-code" class="adm-input" type="text" placeholder="e.g. OXF" maxlength="10">
            </div>
        </div>
        <div id="adm-m-inst-fb" style="min-height:1.2rem;font-size:0.82rem;margin-top:0.75rem;"></div>
        <button id="adm-m-inst-add-btn" class="adm-btn adm-btn-primary" style="margin-top:0.5rem;">Register & Approve</button>
    </div>
    <div style="font-size:0.8rem;color:#64748b;margin-bottom:0.5rem;font-weight:600;">Pending Institute Approvals</div>
    <div id="adm-m-inst-list"><div class="adm-loading"><div class="adm-spinner"></div></div></div>`;
}

async function _wireInstitutesModal(content) {
    const loadList = async () => {
        const ul = content.querySelector('#adm-m-inst-list');
        if (!ul) return;
        try {
            const res = await authFetch(API.ADMIN_INSTITUTES);
            const data = await res.json();
            const pending = data.pending || [];
            
            ul.innerHTML = pending.length ? `
                <div class="adm-crud-list">
                    ${pending.map(inst => `
                    <div class="adm-crud-row">
                        <div style="flex:1;">
                            <div class="adm-crud-row-text">${_esc(inst.name)}</div>
                            <div class="adm-crud-row-sub">${_esc(inst.code)}</div>
                        </div>
                        <div class="adm-action-group">
                            <button class="adm-btn adm-btn-success adm-m-inst-approve" data-id="${inst.id}">Approve</button>
                            <button class="adm-btn adm-btn-danger adm-m-inst-delete" data-id="${inst.id}">Delete</button>
                        </div>
                    </div>`).join('')}
                </div>` : 
                `<div class="adm-empty"><span>✅</span>No pending approvals.</div>`;

            ul.querySelectorAll('.adm-m-inst-approve').forEach(btn => btn.addEventListener('click', async () => {
                const res = await authFetch(API.ADMIN_INSTITUTE_APPROVE(btn.dataset.id), { method: 'PATCH' });
                if (res.ok) { _showToast('Institute approved', 'success'); loadList(); }
            }));
            ul.querySelectorAll('.adm-m-inst-delete').forEach(btn => btn.addEventListener('click', async () => {
                if (!confirm('Delete this pending institute?')) return;
                const res = await authFetch(API.ADMIN_INSTITUTE(btn.dataset.id), { method: 'DELETE' });
                if (res.ok) { _showToast('Institute deleted', 'success'); loadList(); }
            }));
        } catch (_) {}
    };

    loadList();

    const addBtn = content.querySelector('#adm-m-inst-add-btn');
    if (!addBtn) return;
    addBtn.addEventListener('click', async () => {
        const name = content.querySelector('#adm-m-inst-name').value.trim();
        const code = content.querySelector('#adm-m-inst-code').value.trim();
        const fb   = content.querySelector('#adm-m-inst-fb');
        if (!name || !code) { fb.style.color = '#ef4444'; fb.textContent = 'Name and Code required.'; return; }

        addBtn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = 'Registering…';
        try {
            const res = await authFetch(API.ADMIN_INSTITUTES, { method: 'POST', body: JSON.stringify({ name, code }) });
            if (res.ok) {
                fb.style.color = '#10b981'; fb.textContent = '✓ Institute registered.';
                content.querySelector('#adm-m-inst-name').value = '';
                content.querySelector('#adm-m-inst-code').value = '';
                loadList();
            } else {
                const err = await res.json();
                throw new Error(err.message || 'Error');
            }
        } catch (e) { fb.style.color = '#ef4444'; fb.textContent = e.message; }
        finally { addBtn.disabled = false; }
    });
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
