/**
 * adminDashboard.js  — Admin Dashboard module for OrbitAccess
 *
 * Sidebar:
 *   Management  → Applications | Reports (blank)
 *   System Config → Workflow Engine | Data Management
 *
 * All data live from backend.  Users/Institutes managed via Data Management cards.
 */


// ── State ───────────────────────────────────────────────────────────────────

import { authFetch } from '../../utils/auth.js';
import { API, BASE_URL } from '../../config/api.js';
import { _app, _state, setApp } from './modules/core.js';
import { _initModals } from './modules/utils.js';
import { _loadApplications } from './modules/applications.js';
import { _loadWorkflows } from './modules/workflows.js';
import { _initModifyCards, _loadDataAdmin, _buildModifyCards } from './modules/dataAdmin.js';
import { _loadInstitutes } from './modules/institutes.js';

// ═══════════════════════════════════════════════════════════════════════════
// 1. ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════
export async function renderAdminDashboard(container, defaultTab = null) {
    let userPermissions = [];
    try {
        const res = await authFetch(API.ME);
        if (res.ok) {
            const data = await res.json();
            userPermissions = data.permissions || [];
            _state.permissions = userPermissions;
        }
    } catch (err) {
        if (err.message === 'AUTH_SESSION_EXPIRED') return;
        console.error("Dashboard error:", err);
    }

    const ADMIN_PERMISSIONS = [
        'view_applications', 'manage_users', 'manage_roles', 'assign_roles',
        'approve_identity', 'manage_institutes', 'manage_systems', 'manage_services',
        'manage_categories', 'manage_durations', 'manage_salutations', 'manage_requests',
        'system_settings', 'view_logs', 'manage_workflows'
    ];

    const hasAdminAccess = userPermissions.some(p => ADMIN_PERMISSIONS.includes(p));
    if (!hasAdminAccess) {
        window.location.hash = '#/dashboard';
        return;
    }

    setApp(container);
    _app.innerHTML = _buildShell(userPermissions);
    _initSidebar();
    _initModals();

    let initialTab = defaultTab || sessionStorage.getItem('adminCurrentTab');
    let initialEntity = sessionStorage.getItem('adminCurrentEntity');

    if (!initialTab) {
        initialTab = 'modify';
        if (userPermissions.includes('view_applications')) {
            initialTab = 'applications';
        } else if (userPermissions.includes('manage_workflows')) {
            initialTab = 'workflows';
        }
    }

    if (initialTab === 'data-admin' && initialEntity) {
        _switchTab(initialTab, initialEntity);
    } else {
        _switchTab(initialTab);
    }

    window._switchTab = _switchTab;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SHELL
// ═══════════════════════════════════════════════════════════════════════════
function _buildShell(permissions = []) {
    const hasApplications = permissions.includes('view_applications');
    const hasWorkflows = permissions.includes('manage_workflows');
    const hasModifyData = [
        'manage_institutes', 'manage_users', 'manage_roles', 'assign_roles', 'manage_categories',
        'manage_systems', 'manage_services', 'manage_durations', 'manage_salutations',
        'manage_requests'
    ].some(p => permissions.includes(p));

    let sidebarHtml = `<aside class="admin-sidebar">`;

    if (hasApplications) {
        sidebarHtml += `
            <div class="adm-sidebar-title">Management</div>
            <div class="adm-nav-item" data-tab="applications">
                <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/systems.svg); mask-image: url(/public/assets/icons/systems.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 16px; height: 16px; display: inline-block; vertical-align: text-bottom; margin-right: 6px;"></span> Applications
            </div>
            <div class="adm-nav-item" data-tab="reports">
                <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/Reports.svg); mask-image: url(/public/assets/icons/Reports.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 16px; height: 16px; display: inline-block; vertical-align: text-bottom; margin-right: 6px;"></span> Reports
            </div>
        `;
    }

    if (hasWorkflows || hasModifyData) {
        sidebarHtml += `<div class="adm-sidebar-title">System Config</div>`;
        if (hasWorkflows) {
            sidebarHtml += `
                <div class="adm-nav-item" data-tab="workflows">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/workflow_engine.svg); mask-image: url(/public/assets/icons/workflow_engine.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 16px; height: 16px; display: inline-block; vertical-align: text-bottom; margin-right: 6px;"></span> Workflow Engine
                </div>
            `;
        }
        if (hasModifyData) {
            sidebarHtml += `
                <div class="adm-nav-item" data-tab="modify">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/database.svg); mask-image: url(/public/assets/icons/database.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 16px; height: 16px; display: inline-block; vertical-align: text-bottom; margin-right: 6px;"></span> Data Management
                </div>
            `;
        }
    }

    sidebarHtml += `
        <div class="adm-nav-item" id="adm-logout-btn" style="color:#ef4444; margin-top:auto; padding-top:1.5rem; border-top:1px solid #e2e8f0;">
            <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/sign_in.svg); mask-image: url(/public/assets/icons/sign_in.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 16px; height: 16px; display: inline-block; vertical-align: text-bottom; margin-right: 6px;"></span> Sign Out
        </div>
    </aside>`;

    return `
    <div class="admin-shell">
        <!-- Sidebar -->
        ${sidebarHtml}

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
                        <div class="adm-stat-label">Declined</div>
                        <div class="adm-stat-value adm-stat-declined" id="adm-stat-declined">—</div>
                    </div>
                </div>

                <div class="adm-controls">
                    <div class="adm-search">
                        <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/search.svg); mask-image: url(/public/assets/icons/search.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 18px; height: 18px; display: inline-block;"></span>
                        <input id="adm-search-input" class="adm-search-input" type="text"
                            placeholder="Search by name, email, or application ID…">
                    </div>
                    <div class="adm-filters">
                        <button class="adm-filter-btn active" data-filter="all">All</button>
                        <button class="adm-filter-btn" data-filter="pending">Pending</button>
                        <button class="adm-filter-btn" data-filter="approved">Approved</button>
                        <button class="adm-filter-btn" data-filter="declined">Declined</button>
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
                                    <th style="min-width: 130px;">Status</th>
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
                    <div class="adm-reports-blank-icon">
                        <span class="extracted-svg" style="-webkit-mask: url(/public/assets/icons/ic_ui_element_31.svg) no-repeat center; mask: url(/public/assets/icons/ic_ui_element_31.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: white; width: 48px; height: 48px; display: inline-block;"></span>
                    </div>
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
                    <h1 class="adm-page-title">Data Management</h1>
                    <p class="adm-page-sub">Select a category to manage its records in a dedicated view.</p>
                </div>
                <div class="adm-cards-grid" id="adm-modify-cards">
                    ${_buildModifyCards(permissions)}
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
                    <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/close.svg); mask-image: url(/public/assets/icons/close.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 18px; height: 18px; display: inline-block; cursor: pointer;"></span>
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
                    <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/close.svg); mask-image: url(/public/assets/icons/close.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 18px; height: 18px; display: inline-block; cursor: pointer;"></span>
                </button>
            </div>
            <div id="adm-wf-modal-content">Loading…</div>
        </div>
    </div>

    <!-- Data Management CRUD modal -->
    <div class="adm-modal-overlay" id="adm-modify-modal">
        <div class="adm-modal-box">
            <div class="adm-modal-header">
                <div class="adm-modal-title" id="adm-modify-modal-title">Data Browser</div>
                <button class="adm-modal-close" id="adm-modify-modal-close">
                    <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/close.svg); mask-image: url(/public/assets/icons/close.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 18px; height: 18px; display: inline-block; cursor: pointer;"></span>
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
                <button class="adm-modal-close" id="adm-inst-edit-close"><span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/close.svg); mask-image: url(/public/assets/icons/close.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 18px; height: 18px; display: inline-block; cursor: pointer;"></span></button>
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
                    <div id="adm-inst-edit-audit" style="display:none; padding:10px 14px; background:#f1f5f9; border-radius:8px; font-size:0.75rem; color:#475569; border-left:4px solid #6366f1; margin-top:0.5rem; flex-direction:column; gap:4px;"></div>
                    <div style="margin-top:1.5rem;display:flex;gap:0.75rem;">
                        <button type="submit" id="adm-inst-edit-submit" class="adm-btn adm-btn-success" style="flex:1;">Approve & Save</button>
                        <button type="button" class="adm-btn adm-btn-secondary fac-modal-cancel" id="adm-inst-edit-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Zoom Overlay -->
    <div id="adm-zoom-overlay" class="adm-zoom-overlay">
        <button class="adm-zoom-close" id="adm-zoom-close-btn"><span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/close.svg); mask-image: url(/public/assets/icons/close.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: white; width: 18px; height: 18px; display: inline-block; cursor: pointer;"></span></button>
        <img src="" class="adm-zoom-img" id="adm-zoom-img" />
    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
function _initSidebar() {
    _app.querySelectorAll('.adm-nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', () => _switchTab(item.dataset.tab));
    });
    _app.querySelector('#adm-logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        import('../../utils/auth.js').then(m => m.logout());
    });
}

function _switchTab(name) {
    sessionStorage.setItem('adminCurrentTab', name);
    if (name === 'data-admin' && arguments[1]) {
        sessionStorage.setItem('adminCurrentEntity', arguments[1]);
    }

    _app.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
    _app.querySelector(`.adm-nav-item[data-tab="${name}"]`)?.classList.add('active');
    _app.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
    _app.querySelector(`#adm-tab-${name}`)?.classList.add('active');

    switch (name) {
        case 'applications': _loadApplications(); break;
        case 'institutes': _loadInstitutes(); break;
        case 'workflows': _loadWorkflows(); break;
        case 'modify': _initModifyCards(); break;
        case 'data-admin': _loadDataAdmin(arguments[1]); break;
    }
}

