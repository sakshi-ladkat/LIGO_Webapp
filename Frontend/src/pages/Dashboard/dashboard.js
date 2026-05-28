import { authFetch, getAccessToken, logout } from '../../utils/auth.js';
import { API } from '../../config/api.js';

import { renderHeader } from '../../components/header.js';
import { renderAdminDashboard } from '../AdminDashboard/adminDashboard.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { state, updateState } from './modules/core.js';
import { loadMyApplication, loadApplicationHistoryTab } from './modules/tracker.js';
import { _internalRenderProfile } from './modules/profile.js';
import { buildAccordion, renderRoleApplications } from './modules/applications.js';
import { buildSshSetupHtml, _wireSshUpload, buildUploadIdHtml, _wireUploadId } from './modules/ssh.js';
import { buildInviteUserHtml, _wireInviteUser } from './modules/invite.js';
import { __esc } from '../../utils/helpers.js';


// ── Module State ──────────────────────────────────────────────────────────────
export function hasPermission(slug) { return state.permSet.has(slug); }
export function hasRole(...slugs) { return state.roles.some(r => slugs.includes(r.slug)); }

const REVIEW_ROLE_CONFIG = {
    'supervisor': { color: '#10b981', label: 'Supervisor' },
    'subsystem_lead': { color: '#3b82f6', label: 'Subsystem Lead' },
    'system_lead': { color: '#8b5cf6', label: 'System Lead' },
    'li_coordinator': { color: '#f59e0b', label: 'LI-Coordinator' },
    'pet_lead': { color: '#ec4899', label: 'PET Lead' },
    'super_admin': { color: '#64748b', label: 'Super Admin' }
};

// ── Entry point ───────────────────────────────────────────────────────────────
export async function renderDashboard(app, startInProfile = false) {
    // Show loading if we have no user data yet
    if (!state.meData.user) {
        app.innerHTML = `<div class="db-shell"><div class="db-loading"><div class="spinner"></div></div></div>`;
    }

    try {
        const [meRes, appRes] = await Promise.all([
            authFetch(API.ME),
            authFetch(API.MY_APPLICATION)
        ]);

        if (!meRes.ok) throw new Error('Failed to load user');
        const data = await meRes.json();
        if (appRes.ok) state.myAppData = await appRes.json();

        // Update local state and sync with localStorage to prevent redirect loops
        state.meData = data;
        state.me = data.user || {};

        localStorage.setItem('user_status', state.me.status || 'onboarding');
        if (data.roles) {
            localStorage.setItem('user_roles', JSON.stringify(data.roles.map(r => r.slug)));
            try { renderHeader(); } catch (_) { }
        }

        // Redirect to onboarding if status is onboarding (Router handles this too, but sync here is safer)
        if (state.me.status === 'onboarding' && window.location.hash !== '#/registration') {
            window.location.hash = '#/registration';
            return;
        }

        state.roles = (data.roles || []).reduce((acc, curr) => acc.find(i => i.id === curr.id) ? acc : acc.concat([curr]), []);
        state.permSet = new Set(data.permissions || []);

        // Fetch titles if not already loaded
        if (!state.titlesData) {
            try {
                const tr = await authFetch(API.REFERENCE_TITLES);
                if (tr.ok) state.titlesData = await tr.json();
            } catch (e) { console.error("Titles fetch error:", e); }
        }

        // Render shell and icons
        _renderDashboardShell(app, startInProfile);
        feather.replace();
    } catch (err) {
        if (err.message === 'AUTH_SESSION_EXPIRED') return;
        console.error("Dashboard error:", err);
        // If we have cached data, try to render it as fallback
        if (state.meData.user) {
            _renderDashboardShell(app, startInProfile);
            feather.replace();
        }
    }
}

function _renderDashboardShell(app, startInProfile) {
    const profile = state.meData.profile || {};
    const reviewRoles = state.roles.filter(r => REVIEW_ROLE_CONFIG[r.slug]);
    const isUserOnly = reviewRoles.length === 0;

    app.innerHTML = `<div class="db-shell">${buildSidebar(state.me, profile, state.roles, state.meData.can_setup_ssh, state.myAppData?.application, state.meData.affiliation)}<div class="db-right" id="db-main-content"></div></div>`;
    const mainContent = app.querySelector('#db-main-content');

    const navDash = app.querySelector('#db-nav-dashboard');
    const navProf = app.querySelector('#db-nav-profile');
    const navSsh = app.querySelector('#db-nav-ssh');
    const navInvite = app.querySelector('#db-nav-invite');
    const navHistory = app.querySelector('#db-nav-history');

    const navApps = app.querySelector('#db-nav-apps');
    const navWorkflows = app.querySelector('#db-nav-workflows');
    const navModify = app.querySelector('#db-nav-modify');

    function renderTabDashboard() {
        localStorage.setItem('db_active_tab', 'dashboard');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navDash?.classList.add('active');
        if (isUserOnly) {
            mainContent.innerHTML = `<div id="tracker-body" class="db-tracker-card"><div class="db-loading-inline"><div class="spinner"></div></div></div>`;
            loadMyApplication(mainContent.querySelector('#tracker-body'));
        } else {
            // Even if they are a reviewer, if they have an application, show their tracker first
            mainContent.innerHTML = `
                <div id="tracker-body"></div>
                <div id="review-queues" style="margin-top: 3rem;">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                        <div style="height: 1px; flex: 1; background: #e2e8f0;"></div>
                        <h2 style="font-size: 1rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin: 0;">Management & Reviews</h2>
                        <div style="height: 1px; flex: 1; background: #e2e8f0;"></div>
                    </div>
                    <div id="queues-content"><div class="db-loading-inline"><div class="spinner"></div> Loading applications…</div></div>
                </div>
            `;

            const trackerContainer = mainContent.querySelector('#tracker-body');
            const queuesContent = mainContent.querySelector('#queues-content');

            // Load personal tracker if exists
            if (state.myAppData && state.myAppData.application) {
                const hasUserRole = state.roles.some(r => r.slug === 'user');
                const hasSupervisorRole = state.roles.some(r => r.slug === 'supervisor');

                if (hasUserRole && hasSupervisorRole) {
                    trackerContainer.innerHTML = `
                        <div class="db-accordion open" id="accordion-my-tracker" style="margin-bottom: 2.5rem;">
                            <button class="db-accordion-toggle">
                                <span class="db-accordion-icon"><span class="extracted-svg" style="-webkit-mask: url(/public/assets/icons/chevron-down.svg) no-repeat center; mask: url(/public/assets/icons/chevron-down.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span></span>
                                <span class="db-role-name-text">My Application Tracker</span>
                                <span class="db-accordion-badge-label">&nbsp;&mdash;&nbsp;Active Status</span>
                            </button>
                            <div class="db-accordion-body" style="padding: 1.5rem 1.5rem 0.1rem;">
                                <div id="my-tracker-inner-content">
                                    <div class="db-loading-inline"><div class="spinner"></div></div>
                                </div>
                            </div>
                        </div>
                    `;
                    loadMyApplication(trackerContainer.querySelector('#my-tracker-inner-content'));
                } else {
                    trackerContainer.innerHTML = `<div class="db-tracker-card"><div class="db-loading-inline"><div class="spinner"></div></div></div>`;
                    loadMyApplication(trackerContainer);
                }
            } else {
                trackerContainer.style.display = 'none';
            }

            // Centralized fetch for all review roles
            authFetch(API.APPLICATIONS).then(res => res.json()).then(allApps => {
                state.allApps = allApps || [];
                queuesContent.innerHTML = reviewRoles.map(r => buildAccordion(r)).join('');
                reviewRoles.forEach(role => {
                    const roleApps = state.allApps.filter(a => a.role_slug === role.slug);
                    renderRoleApplications(role.slug, roleApps);

                    // Wire search input for this specific role's accordion
                    const searchInput = document.getElementById(`db-search-${role.slug}`);
                    if (searchInput) {
                        searchInput.oninput = (e) => {
                            const q = e.target.value.toLowerCase();
                            const roleAppsFiltered = state.allApps.filter(a => a.role_slug === role.slug && (
                                (a.applicant_name || '').toLowerCase().includes(q) ||
                                (a.applicant_email || '').toLowerCase().includes(q) ||
                                (a.application_id || '').toLowerCase().includes(q) ||
                                String(a.id).includes(q)
                            ));
                            renderRoleApplications(role.slug, roleAppsFiltered);
                        };
                    }
                });

                // Wire accordion toggles
                app.querySelectorAll('.db-accordion-toggle').forEach(t => {
                    const p = t.closest('.db-accordion');
                    t.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        p.classList.toggle('open');
                    };
                });

                feather.replace();
            }).catch(err => {
                queuesContent.innerHTML = `<div class="db-error-msg">Failed to load pending reviews.</div>`;
            });
        }
        feather.replace();
    }

    function renderTabProfile() {
        localStorage.setItem('db_active_tab', 'profile');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navProf?.classList.add('active');

        // Render immediately with cached data — no spinner
        _internalRenderProfile(null, null);

        // Silently refresh in background so next view shows fresh data
        authFetch(API.ME).then(res => {
            if (!res.ok) return;
            return res.json();
        }).then(data => {
            if (!data) return;
            state.meData = data;
            state.me = data.user || state.me;
            // Only re-render if profile tab is still active
            if (navProf?.classList.contains('active')) {
                _internalRenderProfile(null, null);
            }
        }).catch(() => { /* silent — cached data already displayed */ });
        feather.replace();
    }


    function renderTabSSH() {
        localStorage.setItem('db_active_tab', 'ssh');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navSsh?.classList.add('active');
        mainContent.innerHTML = buildSshSetupHtml();
        _wireSshUpload(mainContent, renderTabDashboard);
        feather.replace();
    }
    function renderTabUploadId() {
        localStorage.setItem('db_active_tab', 'upload_id');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        const navUpload = app.querySelector('#db-nav-upload-id');
        if (navUpload) navUpload.classList.add('active');
        mainContent.innerHTML = buildUploadIdHtml(state.myAppData.application);
        _wireUploadId(mainContent, state.myAppData.application, () => renderDashboard(app));
        feather.replace();
    }


    function renderTabInvite() {
        localStorage.setItem('db_active_tab', 'invite');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navInvite?.classList.add('active');
        mainContent.innerHTML = buildInviteUserHtml();
        _wireInviteUser(mainContent);
        feather.replace();
    }

    function renderTabHistory() {
        localStorage.setItem('db_active_tab', 'history');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navHistory?.classList.add('active');

        mainContent.innerHTML = `
            <div id="history-tab-body">
                <div class="db-loading-inline"><div class="spinner"></div></div>
            </div>
        `;
        loadApplicationHistoryTab(mainContent.querySelector('#history-tab-body'));
        feather.replace();
    }

    async function renderTabApps() {
        localStorage.setItem('db_active_tab', 'apps');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navApps?.classList.add('active');
        mainContent.innerHTML = `<div class="db-loading-inline"><div class="spinner"></div> Loading applications…</div>`;
        await renderAdminDashboard(mainContent, 'applications');
        const sidebar = mainContent.querySelector('.admin-sidebar');
        if (sidebar) sidebar.style.display = 'none';
        const main = mainContent.querySelector('.admin-main');
        if (main) main.style.padding = '2rem';
        feather.replace();
    }

    async function renderTabWorkflows() {
        localStorage.setItem('db_active_tab', 'workflows');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navWorkflows?.classList.add('active');
        mainContent.innerHTML = `<div class="db-loading-inline"><div class="spinner"></div> Loading workflows…</div>`;
        await renderAdminDashboard(mainContent, 'workflows');
        const sidebar = mainContent.querySelector('.admin-sidebar');
        if (sidebar) sidebar.style.display = 'none';
        const main = mainContent.querySelector('.admin-main');
        if (main) main.style.padding = '2rem';
        feather.replace();
    }

    async function renderTabModify() {
        localStorage.setItem('db_active_tab', 'modify');
        [navDash, navProf, navSsh, navInvite, navHistory, navApps, navWorkflows, navModify].forEach(n => n?.classList.remove('active'));
        navModify?.classList.add('active');
        mainContent.innerHTML = `<div class="db-loading-inline"><div class="spinner"></div> Loading modify data…</div>`;
        await renderAdminDashboard(mainContent, 'modify');
        const sidebar = mainContent.querySelector('.admin-sidebar');
        if (sidebar) sidebar.style.display = 'none';
        const main = mainContent.querySelector('.admin-main');
        if (main) main.style.padding = '2rem';
        feather.replace();
    }

    navDash?.addEventListener('click', renderTabDashboard);
    navProf?.addEventListener('click', renderTabProfile);
    navSsh?.addEventListener('click', renderTabSSH);
    navInvite?.addEventListener('click', renderTabInvite);
    navHistory?.addEventListener('click', renderTabHistory);

    navApps?.addEventListener('click', renderTabApps);
    navWorkflows?.addEventListener('click', renderTabWorkflows);
    navModify?.addEventListener('click', renderTabModify);

    app.querySelector('#db-nav-upload-id')?.addEventListener('click', () => {
        renderTabUploadId();
    });

    app.querySelector('#reapplyBtnSidebar')?.addEventListener('click', () => {
        localStorage.removeItem('registration_draft');
        window.location.hash = '#/registration?mode=reapply';
    });

    const savedTab = localStorage.getItem('db_active_tab') || 'dashboard';
    if (startInProfile || savedTab === 'profile') renderTabProfile();
    else if (savedTab === 'ssh' && navSsh) renderTabSSH();
    else if (savedTab === 'invite' && navInvite) renderTabInvite();
    else if (savedTab === 'history' && navHistory) renderTabHistory();
    else if (savedTab === 'apps' && navApps) renderTabApps();
    else if (savedTab === 'workflows' && navWorkflows) renderTabWorkflows();
    else if (savedTab === 'modify' && navModify) renderTabModify();
    else renderTabDashboard();

    app.querySelector('#db-logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    // Ensure sidebar and initial layout icons are rendered
    feather.replace();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function buildSidebar(user = {}, profile = {}, roles = [], canSetupSsh = false, myApp = null, affiliation = {}) {
    const email = user.email || 'No Email';
    const status = user.status || 'unknown';
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || email || 'User';
    const initials = fullName.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';

    const statusMap = {
        active: { label: 'Active', cls: 'sb-status--active' },
        'pending-approval': { label: 'Pending Approval', cls: 'sb-status--pending' },
        rejected: { label: 'Declined', cls: 'sb-status--rejected' },
        onboarding: { label: 'Onboarding', cls: 'sb-status--pending' },
        'id_card_reupload_required': { label: 'Correction Needed', cls: 'sb-status--rejected', style: 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;' }
    };

    const { label: statusLabel, cls: statusCls, style: statusStyle } = statusMap[status] || { label: status, cls: '' };
    const roleBadges = roles.map(r => `<span class="sb-role-badge">${__esc(r.name)}</span>`).join('');

    const isReviewer = roles.some(r => REVIEW_ROLE_CONFIG[r.slug] || r.slug === 'super_admin');
    const rolesHtml = isReviewer ? `<div class="sb-section"><p class="sb-section-label">Roles</p><div class="sb-role-badges">${roleBadges}</div></div>` : '';

    const needsIdCard = myApp && myApp.status === 'id_card_reupload_required';
    const canReapply = myApp && (myApp.status === 'rejected' || myApp.status === 'declined');

    const ADMIN_PERMISSIONS = [
        'view_applications', 'manage_users', 'manage_roles', 'assign_roles',
        'approve_identity', 'manage_institutes', 'manage_systems', 'manage_services',
        'manage_categories', 'manage_durations', 'manage_salutations', 'manage_requests',
        'system_settings', 'view_logs', 'manage_workflows'
    ];
    const canInvite = hasPermission('invite_users');
    const hasViewApps = hasPermission('view_applications');
    const hasWorkflows = hasPermission('manage_workflows');
    const hasModifyData = [
        'manage_institutes', 'manage_users', 'manage_roles', 'assign_roles', 'manage_categories',
        'manage_systems', 'manage_services', 'manage_durations', 'manage_salutations',
        'manage_requests'
    ].some(p => hasPermission(p));

    let adminButtonsHtml = '';
    if (hasViewApps) {
        adminButtonsHtml += `<button class="sb-nav-btn" id="db-nav-apps"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/systems.svg); mask-image: url(/public/assets/icons/systems.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Applications</button>`;
    }
    if (hasWorkflows) {
        adminButtonsHtml += `<button class="sb-nav-btn" id="db-nav-workflows"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/workflow_engine.svg); mask-image: url(/public/assets/icons/workflow_engine.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Workflow Engine</button>`;
    }
    if (hasModifyData) {
        adminButtonsHtml += `<button class="sb-nav-btn" id="db-nav-modify"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/database.svg); mask-image: url(/public/assets/icons/database.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Data Management</button>`;
    }

    return `<aside class="db-sidebar">
            <div class="sb-profile-hero" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1.5rem 1rem;">
                <div class="sb-avatar" style="margin-bottom: 0.75rem;">
                    <div class="sb-avatar-circle" style="width: 64px; height: 64px; font-size: 1.5rem; background:linear-gradient(135deg,var(--primary-600) 0%,var(--primary-800) 100%); display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.2);">
                        ${__esc(initials)}
                    </div>
                </div>
                <div class="sb-hero-info">
                    <h2 class="sb-name" style="margin: 0; font-size: 1.1rem; font-weight: 800;">${__esc(fullName)}</h2>
                    <p class="sb-email" style="margin: 0.2rem 0; font-size: 0.8rem; opacity: 0.7; word-break: break-all;">${__esc(email)}</p>
                    ${(affiliation?.institute_name || affiliation?.institute_code) ? `
                    <div style="margin: 0.5rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.3rem;">
                        <div style="background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 0.4rem 0.8rem; border-radius: 10px; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                            <span class="extracted-svg" style="width: 13px; height: 13px; color: #fffbeb; opacity: 0.9; display: inline-block; -webkit-mask-image: url(/public/assets/icons/home.svg); mask-image: url(/public/assets/icons/home.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                            <span title="${__esc(affiliation.institute_name || '')}" style="font-size: 0.72rem; color: #fffbeb; font-weight: 800; white-space: nowrap; letter-spacing: 0.02em;">${__esc(affiliation.institute_code || affiliation.institute_name)}</span>
                        </div>
                        ${affiliation.department ? `<div style="font-size: 0.65rem; color: #cbd5e1; font-weight: 600; letter-spacing: 0.03em;">${__esc(affiliation.department)}</div>` : ''}
                    </div>` : ''}
                    <div style="margin-top: 0.5rem;">
                        <span class="sb-status ${statusCls}" style="${statusStyle || ''}; display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.7rem; font-weight: 800;">${__esc(statusLabel)}</span>
                    </div>
                </div>
            </div>
            <div class="sb-nav-scroll">
                ${rolesHtml}
                <div class="sb-section sb-section--grow">
                    <p class="sb-section-label">Navigation</p>
                    <div class="sb-nav-list">
                        ${!roles.some(r => r.slug === 'super_admin') ? `<button class="sb-nav-btn" id="db-nav-dashboard"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/grid.svg); mask-image: url(/public/assets/icons/grid.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Dashboard</button>` : ''}
                        
                        ${needsIdCard ? `
                        <button class="sb-nav-btn" id="db-nav-upload-id" style="background: #fffbeb; color: #d97706; border: 1px solid #fde68a; animation: trkBadgePulse 2s infinite;">
                            <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/upload-cloud.svg); mask-image: url(/public/assets/icons/upload-cloud.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Upload Valid ID Card
                        </button>` : ''}
                        
                        ${canReapply ? `
                        <button id="reapplyBtnSidebar" class="sb-nav-btn">
                            <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/refresh-cw.svg); mask-image: url(/public/assets/icons/refresh-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Reapply Application
                        </button>` : ''}

                        ${adminButtonsHtml}
                        ${canInvite ? `<button class="sb-nav-btn" id="db-nav-invite"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/user-plus.svg); mask-image: url(/public/assets/icons/user-plus.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Invite User</button>` : ''}
                        ${canSetupSsh ? `<button class="sb-nav-btn" id="db-nav-ssh"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/lock.svg); mask-image: url(/public/assets/icons/lock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> SSH Setup</button>` : ''}
                        <button class="sb-nav-btn" id="db-nav-history"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/file-text.svg); mask-image: url(/public/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> History</button>
                        <button class="sb-nav-btn" id="db-nav-profile"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/user.svg); mask-image: url(/public/assets/icons/user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> My Profile</button>
                    </div>
                </div>
                <div class="sb-footer"><button id="db-logout-btn" class="sb-logout-btn"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/log-out.svg); mask-image: url(/public/assets/icons/log-out.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Sign Out</button></div>
            </div>
        </aside>`;
}

// ── Application Tracker ───────────────────────────────────────────────────────
