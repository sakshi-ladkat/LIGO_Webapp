import { authFetch, getAccessToken, logout } from '../../utils/auth.js';
import { API } from '../../config/api.js';
import { openReviewModal } from './reviewModal.js';
import { renderHeader } from '../../components/header.js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

// ── Module State ──────────────────────────────────────────────────────────────
let _me = {};
let _roles = [];
let _permSet = new Set();
let _meData = {};
let _myAppData = null;
let _servicesData = null;
let _titlesData = null;
let _allApps = [];

export function hasPermission(slug) { return _permSet.has(slug); }
export function hasRole(...slugs) { return _roles.some(r => slugs.includes(r.slug)); }

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
    if (!_meData.user) {
        app.innerHTML = `<div class="db-shell"><div class="db-loading"><div class="spinner"></div></div></div>`;
    }

    try {
        const [meRes, appRes] = await Promise.all([
            authFetch(API.ME),
            authFetch(API.MY_APPLICATION)
        ]);

        if (!meRes.ok) throw new Error('Failed to load user');
        const data = await meRes.json();
        if (appRes.ok) _myAppData = await appRes.json();

        // Update local state and sync with localStorage to prevent redirect loops
        _meData = data;
        _me = data.user || {};

        localStorage.setItem('user_status', _me.status || 'onboarding');
        if (data.roles) {
            localStorage.setItem('user_roles', JSON.stringify(data.roles.map(r => r.slug)));
            try { renderHeader(); } catch (_) {}
        }

        // Redirect to onboarding if status is onboarding (Router handles this too, but sync here is safer)
        if (_me.status === 'onboarding' && window.location.hash !== '#/registration') {
            window.location.hash = '#/registration';
            return;
        }

        _roles = (data.roles || []).reduce((acc, curr) => acc.find(i => i.id === curr.id) ? acc : acc.concat([curr]), []);
        _permSet = new Set(data.permissions || []);

        // Fetch titles if not already loaded
        if (!_titlesData) {
            try {
                const tr = await authFetch(API.REFERENCE_TITLES);
                if (tr.ok) _titlesData = await tr.json();
            } catch (e) { console.error("Titles fetch error:", e); }
        }

        // Render shell and icons
        _renderDashboardShell(app, startInProfile);
        feather.replace();
    } catch (err) {
        if (err.message === 'AUTH_SESSION_EXPIRED') return;
        console.error("Dashboard error:", err);
        // If we have cached data, try to render it as fallback
        if (_meData.user) {
            _renderDashboardShell(app, startInProfile);
            feather.replace();
        }
    }
}

function _renderDashboardShell(app, startInProfile) {
    const profile = _meData.profile || {};
    const reviewRoles = _roles.filter(r => REVIEW_ROLE_CONFIG[r.slug]);
    const isUserOnly = reviewRoles.length === 0;

    app.innerHTML = `<div class="db-shell">${buildSidebar(_me, profile, _roles, _meData.can_setup_ssh, _myAppData?.application, _meData.affiliation)}<div class="db-right" id="db-main-content"></div></div>`;
    const mainContent = app.querySelector('#db-main-content');

    const navDash = app.querySelector('#db-nav-dashboard');
    const navProf = app.querySelector('#db-nav-profile');
    const navSsh = app.querySelector('#db-nav-ssh');
    const navAdmin = app.querySelector('#db-nav-admin');
    const navInvite = app.querySelector('#db-nav-invite');
    const navHistory = app.querySelector('#db-nav-history');

    function renderTabDashboard() {
        localStorage.setItem('db_active_tab', 'dashboard');
        [navDash, navProf, navSsh, navInvite, navHistory].forEach(n => n?.classList.remove('active'));
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
            if (_myAppData && _myAppData.application) {
                const hasUserRole = _roles.some(r => r.slug === 'user');
                const hasSupervisorRole = _roles.some(r => r.slug === 'supervisor');

                if (hasUserRole && hasSupervisorRole) {
                    trackerContainer.innerHTML = `
                        <div class="db-accordion open" id="accordion-my-tracker" style="margin-bottom: 2.5rem;">
                            <button class="db-accordion-toggle">
                                <span class="db-accordion-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
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
                _allApps = allApps || [];
                queuesContent.innerHTML = reviewRoles.map(r => buildAccordion(r)).join('');
                reviewRoles.forEach(role => {
                    const roleApps = _allApps.filter(a => a.role_slug === role.slug);
                    renderRoleApplications(role.slug, roleApps);

                    // Wire search input for this specific role's accordion
                    const searchInput = document.getElementById(`db-search-${role.slug}`);
                    if (searchInput) {
                        searchInput.oninput = (e) => {
                            const q = e.target.value.toLowerCase();
                            const roleAppsFiltered = _allApps.filter(a => a.role_slug === role.slug && (
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
        [navDash, navProf, navSsh, navInvite, navHistory].forEach(n => n?.classList.remove('active'));
        navProf?.classList.add('active');

        // Render immediately with cached data — no spinner
        _internalRenderProfile(null, null);

        // Silently refresh in background so next view shows fresh data
        authFetch(API.ME).then(res => {
            if (!res.ok) return;
            return res.json();
        }).then(data => {
            if (!data) return;
            _meData = data;
            _me = data.user || _me;
            // Only re-render if profile tab is still active
            if (navProf?.classList.contains('active')) {
                _internalRenderProfile(null, null);
            }
        }).catch(() => { /* silent — cached data already displayed */ });
        feather.replace();
    }


    function renderTabSSH() {
        localStorage.setItem('db_active_tab', 'ssh');
        [navDash, navProf, navSsh, navInvite, navHistory].forEach(n => n?.classList.remove('active'));
        navSsh?.classList.add('active');
        mainContent.innerHTML = buildSshSetupHtml();
        _wireSshUpload(mainContent, renderTabDashboard);
        feather.replace();
    }
    function renderTabUploadId() {
        localStorage.setItem('db_active_tab', 'upload_id');
        [navDash, navProf, navSsh, navInvite, navHistory].forEach(n => n?.classList.remove('active'));
        const navUpload = app.querySelector('#db-nav-upload-id');
        if (navUpload) navUpload.classList.add('active');
        mainContent.innerHTML = buildUploadIdHtml(_myAppData.application);
        _wireUploadId(mainContent, _myAppData.application, () => renderDashboard(app));
        feather.replace();
    }


    function renderTabInvite() {
        localStorage.setItem('db_active_tab', 'invite');
        [navDash, navProf, navSsh, navInvite, navHistory].forEach(n => n?.classList.remove('active'));
        navInvite?.classList.add('active');
        mainContent.innerHTML = buildInviteUserHtml();
        _wireInviteUser(mainContent);
        feather.replace();
    }

    function renderTabHistory() {
        localStorage.setItem('db_active_tab', 'history');
        [navDash, navProf, navSsh, navInvite, navHistory].forEach(n => n?.classList.remove('active'));
        navHistory?.classList.add('active');

        mainContent.innerHTML = `
            <div id="history-tab-body">
                <div class="db-loading-inline"><div class="spinner"></div></div>
            </div>
        `;
        loadApplicationHistoryTab(mainContent.querySelector('#history-tab-body'));
        feather.replace();
    }

    navDash?.addEventListener('click', renderTabDashboard);
    navProf?.addEventListener('click', renderTabProfile);
    navSsh?.addEventListener('click', renderTabSSH);
    navInvite?.addEventListener('click', renderTabInvite);
    navHistory?.addEventListener('click', renderTabHistory);
    navAdmin?.addEventListener('click', () => { window.location.hash = '#/admin'; });

    app.querySelector('#db-nav-upload-id')?.addEventListener('click', () => {
        renderTabUploadId();
    });

    const savedTab = localStorage.getItem('db_active_tab') || 'dashboard';
    if (startInProfile || savedTab === 'profile') renderTabProfile();
    else if (savedTab === 'ssh' && navSsh) renderTabSSH();
    else if (savedTab === 'invite' && navInvite) renderTabInvite();
    else if (savedTab === 'history' && navHistory) renderTabHistory();
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
    const roleBadges = roles.map(r => `<span class="sb-role-badge">${escHtml(r.name)}</span>`).join('');

    const isReviewer = roles.some(r => REVIEW_ROLE_CONFIG[r.slug] || r.slug === 'super_admin');
    const rolesHtml = isReviewer ? `<div class="sb-section"><p class="sb-section-label">Roles</p><div class="sb-role-badges">${roleBadges}</div></div>` : '';

    const needsIdCard = myApp && myApp.status === 'id_card_reupload_required';

    return `<aside class="db-sidebar">
        <div class="sb-profile-hero" style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1.5rem 1rem;">
            <div class="sb-avatar" style="margin-bottom: 0.75rem;">
                <div class="sb-avatar-circle" style="width: 64px; height: 64px; font-size: 1.5rem; background:linear-gradient(135deg,var(--primary-600) 0%,var(--primary-800) 100%); display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid rgba(255,255,255,0.2);">
                    ${escHtml(initials)}
                </div>
            </div>
            <div class="sb-hero-info">
                <h2 class="sb-name" style="margin: 0; font-size: 1.1rem; font-weight: 800;">${escHtml(fullName)}</h2>
                <p class="sb-email" style="margin: 0.2rem 0; font-size: 0.8rem; opacity: 0.7; word-break: break-all;">${escHtml(email)}</p>
                ${(affiliation?.institute_name || affiliation?.institute_code) ? `
                <div style="margin: 0.5rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.3rem;">
                    <div style="background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(4px); border: 1px solid rgba(255, 255, 255, 0.15); padding: 0.4rem 0.8rem; border-radius: 10px; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <i data-feather="home" style="width: 13px; height: 13px; color: #fffbeb; opacity: 0.9;"></i>
                        <span title="${escHtml(affiliation.institute_name || '')}" style="font-size: 0.72rem; color: #fffbeb; font-weight: 800; white-space: nowrap; letter-spacing: 0.02em;">${escHtml(affiliation.institute_code || affiliation.institute_name)}</span>
                    </div>
                    ${affiliation.department ? `<div style="font-size: 0.65rem; color: #cbd5e1; font-weight: 600; letter-spacing: 0.03em;">${escHtml(affiliation.department)}</div>` : ''}
                </div>` : ''}
                <div style="margin-top: 0.5rem;">
                    <span class="sb-status ${statusCls}" style="${statusStyle || ''}; display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.7rem; font-weight: 800;">${escHtml(statusLabel)}</span>
                </div>
            </div>
        </div>
        <div class="sb-nav-scroll">
            ${rolesHtml}
            <div class="sb-section sb-section--grow">
                <p class="sb-section-label">Navigation</p>
                <div class="sb-nav-list">
                    <button class="sb-nav-btn" id="db-nav-dashboard"><i data-feather="grid"></i> Dashboard</button>
                    
                    ${needsIdCard ? `
                    <button class="sb-nav-btn" id="db-nav-upload-id" style="background: #fffbeb; color: #d97706; border: 1px solid #fde68a; animation: trkBadgePulse 2s infinite;">
                        <i data-feather="upload-cloud"></i> Upload Valid ID Card
                    </button>` : ''}

                    ${roles.some(r => r.slug === 'super_admin') ? `<button class="sb-nav-btn" id="db-nav-admin"><i data-feather="shield"></i> Admin Panel</button>` : ''}
                    ${roles.some(r => r.slug === 'supervisor') ? `<button class="sb-nav-btn" id="db-nav-invite"><i data-feather="user-plus"></i> Invite User</button>` : ''}
                    ${canSetupSsh ? `<button class="sb-nav-btn" id="db-nav-ssh"><i data-feather="lock"></i> SSH Setup</button>` : ''}
                    <button class="sb-nav-btn" id="db-nav-history"><i data-feather="file-text"></i> History</button>
                    <button class="sb-nav-btn" id="db-nav-profile"><i data-feather="user"></i> My Profile</button>
                </div>
            </div>
            <div class="sb-footer"><button id="db-logout-btn" class="sb-logout-btn"><i data-feather="log-out"></i> Sign Out</button></div>
        </div>
    </aside>`;
}

// ── Application Tracker ───────────────────────────────────────────────────────
async function loadMyApplication(container) {
    try {
        const [a, s] = await Promise.all([authFetch(API.MY_APPLICATION), _servicesData ? Promise.resolve({ ok: true, json: () => _servicesData }) : authFetch(API.REVIEW_SERVICES)]);
        if (a.ok) _myAppData = await a.json();
        if (s.ok && !_servicesData) _servicesData = await s.json();
        
        let html = '';
        if (_myAppData) {
            html += buildTracker(_myAppData, _servicesData);
        } else {
            html += buildNoApplicationBanner();
        }
        
        container.innerHTML = html;
        initReapplyListeners(container);
        feather.replace();
    } catch (err) {
        if (err.message === 'AUTH_SESSION_EXPIRED') return;
        container.innerHTML = `<div class="db-error-msg">Failed to load tracker.</div>`;
    }
}

function initReapplyListeners(container) {
    const reapplyBtn = container.querySelector('#reapplyBtn');
    if (reapplyBtn) {
        reapplyBtn.addEventListener('click', () => {
            localStorage.removeItem('registration_draft');
            window.location.hash = '#/registration?mode=reapply';
        });
    }

    const viewBtns = container.querySelectorAll('.view-history-detail-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const appId = e.target.dataset.id;
            if (!appId) return;
            await showHistoryDetailsModal(appId);
        });
    });
}

async function loadApplicationHistoryTab(container) {
    try {
        const res = await authFetch(API.MY_APPLICATION);
        if (res.ok) {
            const data = await res.json();
            _myAppData = data; // Update in-memory cache
        }
        
        let html = '';
        if (_myAppData && _myAppData.history && _myAppData.history.length > 0) {
            html += buildApplicationHistory(_myAppData.history);
        } else {
            html += `
                <div class="db-tracker-card" style="padding: 4rem 2rem; text-align: center;">
                    <div style="background: #e0e7ff; width: 64px; height: 64px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: #4f46e5; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);">
                        <i data-feather="file-text" style="width: 30px; height: 30px;"></i>
                    </div>
                    <h3 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: #0f172a;">No History</h3>
                    <p style="margin: 0.75rem auto 0; max-width: 420px; color: #64748b; font-size: 0.9rem; line-height: 1.6;">
                        You do not have any past application requests yet. Once you submit or reapply, your history timeline will be displayed here.
                    </p>
                </div>
            `;
        }
        container.innerHTML = html;
        initReapplyListeners(container);
        feather.replace();
    } catch (err) {
        if (err.message === 'AUTH_SESSION_EXPIRED') return;
        container.innerHTML = `<div class="db-error-msg">Failed to load application history.</div>`;
    }
}

function buildApplicationHistory(history) {
    return `
        <div class="db-tracker-card" style="margin-top: 2rem; padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="background: #e0e7ff; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 10px; color: #4f46e5;">
                        <i data-feather="file-text" style="width: 20px; height: 20px;"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">History</h4>
                        <p style="margin: 0.1rem 0 0; color: #64748b; font-size: 0.75rem;">Track your past application requests</p>
                    </div>
                </div>
            </div>
            <div class="table-responsive" style="overflow-x: auto;">
                <table class="db-table" style="width: 100%; border-collapse: collapse; text-align: center;">
                    <thead>
                        <tr style="border-bottom: 2px solid #f1f5f9; color: #475569; font-weight: 700; font-size: 0.8rem; text-transform: uppercase;">
                            <th style="padding: 1rem 0.5rem; text-align: center;">Application ID</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Applied Date</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Status</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Reviewer Remarks / Reason</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Reapplied From</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(app => {
                            const dateStr = formatDate(app.submitted_at);
                            const updatedStr = formatDate(app.updated_at);
                            
                            let badgeStyle = '';
                            let badgeLabel = app.status;
                            if (app.status === 'pending') {
                                badgeStyle = 'background: #fef3c7; color: #d97706;';
                                badgeLabel = 'Pending';
                            } else if (app.status === 'under_review') {
                                badgeStyle = 'background: #e0f2fe; color: #0284c7;';
                                badgeLabel = 'Under Review';
                            } else if (app.status === 'approved' || app.status === 'completed' || app.status === 'provisioning_pending') {
                                badgeStyle = 'background: #dcfce7; color: #166534;';
                                badgeLabel = 'Approved';
                            } else if (app.status === 'rejected' || app.status === 'declined') {
                                badgeStyle = 'background: #fee2e2; color: #ef4444;';
                                badgeLabel = 'Declined';
                            } else if (app.status === 'reapplied') {
                                badgeStyle = 'background: #f1f5f9; color: #64748b; border: 1px dashed #cbd5e1;';
                                badgeLabel = 'Reapplied';
                            } else {
                                badgeStyle = 'background: #e2e8f0; color: #475569;';
                            }

                            const remarks = app.declined_reason || app.rejection_reason || 'N/A';
                            const reappliedFrom = app.reapplied_from || 'N/A';

                            return `
                                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; color: #334155;">
                                    <td style="padding: 1rem 0.5rem; font-weight: 700; color: #4f46e5; text-align: center;">${escHtml(app.application_id)}</td>
                                    <td style="padding: 1rem 0.5rem; color: #64748b; text-align: center;">${dateStr}</td>
                                    <td style="padding: 1rem 0.5rem; text-align: center;">
                                        <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 800; ${badgeStyle}">
                                            ${badgeLabel}
                                        </span>
                                    </td>
                                    <td style="padding: 1rem 0.5rem; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569; text-align: center;" title="${escHtml(remarks)}">
                                        ${escHtml(remarks)}
                                    </td>
                                    <td style="padding: 1rem 0.5rem; font-family: monospace; color: #64748b; text-align: center;">${escHtml(reappliedFrom)}</td>
                                    <td style="padding: 1rem 0.5rem; color: #64748b; text-align: center;">${updatedStr}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function showHistoryDetailsModal(appId) {
    try {
        const res = await authFetch(`/api/auth/tracker/${appId}`);
        if (!res.ok) throw new Error("Failed to fetch history details");
        const details = await res.json();
        
        const { application: appObj, steps = [] } = details;
        
        const modalId = 'history-detail-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
                <!-- Modal Header -->
                <div style="padding: 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-top-left-radius: 16px; border-top-right-radius: 16px;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="background: #e0e7ff; color: #4f46e5; padding: 8px; border-radius: 8px;">
                            <i data-feather="file-text" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a;">Application Details</h3>
                            <span style="font-family: monospace; color: #64748b; font-size: 0.8rem;">${appObj.application_id}</span>
                        </div>
                    </div>
                    <button id="close-modal-btn" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 6px; border-radius: 50%; transition: all 0.2s;">
                        <i data-feather="x" style="width: 20px; height: 20px;"></i>
                    </button>
                </div>
                
                <!-- Modal Body -->
                <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Overview section -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f8fafc; padding: 1.25rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Workflow / Category</div>
                            <div style="font-size: 0.9rem; color: #1e293b; font-weight: 700;">${escHtml(appObj.workflow_name || 'N/A')}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Status</div>
                            <span style="display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 800; background: #fee2e2; color: #ef4444;">
                                ${appObj.status.toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Applied Date</div>
                            <div style="font-size: 0.9rem; color: #1e293b; font-weight: 700;">${formatDate(appObj.submitted_at)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Rejection Reviewer</div>
                            <div style="font-size: 0.9rem; color: #1e293b; font-weight: 700;">${escHtml(appObj.rejected_by_name || 'System / Admin')}</div>
                        </div>
                    </div>
                    
                    <!-- Decline remarks -->
                    ${appObj.rejection_reason || appObj.declined_reason ? `
                        <div style="background: #fff5f5; border: 1px solid #fed7d7; padding: 1.25rem; border-radius: 12px;">
                            <div style="font-weight: 800; color: #c53030; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Decline remarks / reason</div>
                            <div style="color: #9b2c2c; font-size: 0.9rem; line-height: 1.5; font-weight: 500;">
                                ${escHtml(appObj.rejection_reason || appObj.declined_reason)}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Timeline Steps -->
                    <div>
                        <h4 style="margin: 0 0 1rem; color: #0f172a; font-size: 1rem; font-weight: 800;">Review Timeline History</h4>
                        <div style="display: flex; flex-direction: column; gap: 1rem; position: relative; padding-left: 1.5rem;">
                            <div style="position: absolute; left: 6px; top: 8px; bottom: 8px; width: 2px; background: #e2e8f0;"></div>
                            
                            ${steps.map(step => {
                                const isDone = step.status === 'approved' || step.approved_at;
                                const isDeclined = step.status === 'rejected' || step.status === 'declined';
                                
                                let markerColor = '#e2e8f0';
                                if (isDone) markerColor = '#10b981';
                                if (isDeclined) markerColor = '#ef4444';

                                return `
                                    <div style="position: relative;">
                                        <div style="position: absolute; left: -23px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${markerColor}; border: 2px solid white; box-shadow: 0 0 0 2px ${markerColor};"></div>
                                        <div>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <h5 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #1e293b;">${escHtml(step.status_name)}</h5>
                                                <span style="font-size: 0.75rem; color: #94a3b8;">${step.approved_at ? formatDate(step.approved_at) : ''}</span>
                                            </div>
                                            ${step.remarks ? `
                                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">
                                                    Remarks: <em>${escHtml(step.remarks)}</em>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Modal Footer -->
                <div style="padding: 1.25rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; background: #f8fafc; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
                    <button id="close-modal-footer-btn" class="btn-secondary" style="width: auto; padding: 8px 20px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        if (window.feather) window.feather.replace();

        const close = () => { modal.remove(); };
        modal.querySelector('#close-modal-btn').addEventListener('click', close);
        modal.querySelector('#close-modal-footer-btn').addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    } catch (err) {
        console.error(err);
        alert("Failed to load history details.");
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function buildTracker(data, allServices) {
    const { application: appObj, steps = [] } = data;
    const isCompleted = ['approved', 'completed', 'approved_by_li_coordinator'].includes(appObj.status);
    const isRejected = ['rejected', 'declined', 'final_rejected', 'final_rejection'].includes(appObj.status);
    const isStandardCorrection = appObj.status === 'correction_required';
    const isIdCorrection = appObj.status === 'id_card_reupload_required';
    const isCorrection = isStandardCorrection || isIdCorrection;

    const detailedItems = [
        { label: 'Application Submitted', state: 'completed', description: 'Application submitted successfully.', date: appObj.submitted_at },
        ...steps.map(s => {
            const isStepRejected = ['rejected', 'declined', 'final_rejected', 'final_rejection'].includes(s.status);
            const isStepApproved = s.status === 'approved' || s.approved_at;

            let label = s.status_name;
            if (isStepApproved) label = s.status_name;
            if (isStepRejected) label = s.status_name;

            let description = '';
            if (isStepApproved) {
                description = `Approved by ${s.role_name} (${s.approved_by_name}) on ${formatDate(s.approved_at)}`;
            } else if (isStepRejected) {
                description = `Declined by ${s.role_name} (${s.approved_by_name}) on ${formatDate(s.approved_at)}`;
            } else if (s.status === 'correction' || (appObj.status === 'id_card_reupload_required' && appObj.paused_workflow_step === s.workflow_step_id)) {
                description = `Correction requested by ${s.approved_by_name || appObj.correction_requested_by_name || 'Reviewer'}. Please check the remarks below.`;
            } else if (appObj.current_step_id === s.workflow_step_id && appObj.status !== 'rejected') {
                description = 'Action required';
            }

            let state = 'pending';
            if (isStepRejected) {
                state = 'rejected';
            } else if (isStepApproved) {
                state = 'completed';
            } else if (s.status === 'correction' || (appObj.status === 'id_card_reupload_required' && appObj.paused_workflow_step === s.workflow_step_id)) {
                state = 'correction';
            } else if (appObj.current_step_id === s.workflow_step_id) {
                state = isRejected ? 'rejected' : 'active';
            }

            return {
                label,
                state,
                description,
                services: s.recommended_services,
                remarks: s.comments,
                approver_email: s.approver_email,
                ligo_member: appObj.ligo_member,
                assigned_system: appObj.assigned_system_name,
                assigned_subsystem: appObj.assigned_subsystem_name
            };
        })
    ];

    // Scenario: Application is approved or beyond -> show post-approval steps
    const isPostApproval = isCompleted || appObj.status === 'provisioning_pending' || appObj.status === 'approved_by_li_coordinator';

    // 1. SSH Key Step (ONLY if computing services are involved)
    const hasComputing = appObj.computing_services === true || appObj.computing_services === 1 || appObj.computing_services === "1";
    if (isPostApproval) {
        if (hasComputing || data.ssh_key) {
            detailedItems.push({
                label: data.ssh_key ? 'SSH Key Uploaded' : 'Upload SSH Key',
                state: data.ssh_key ? 'completed' : 'active',
                description: data.ssh_key ? 'Public key successfully registered in system.' : 'Please upload your public key to proceed.'
            });
        }

        // 2. Provisioning Step (For ALL)
        detailedItems.push({
            label: data.user_data?.username ? 'Account Created (LDAP)' : 'Account Provisioning',
            state: data.user_data?.username ? 'completed' : (hasComputing ? (data.ssh_key ? 'active' : 'pending') : 'active'),
            description: data.user_data?.username ? 'Identity successfully provisioned.' : 'Setting up system identity in LDAP...'
        });

        // 3. Activation Step (For ALL)
        detailedItems.push({
            label: 'Account Activated',
            state: (data.user_data?.status === 'active') ? 'completed' : 'pending',
            description: (data.user_data?.status === 'active') ? 'Full access to services granted.' : 'Final activation pending.'
        });
    }

    const isFullyActive = isCompleted && data.user_data?.status === 'active';
    const activeStepLabel = detailedItems.find(it => it.state === 'active')?.label || 'In Progress';

    return `
        <div class="db-tracker-card">
            <div class="trk-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2.5rem;padding-bottom:1.5rem;border-bottom:1px solid #f1f5f9;">
                <div style="display:flex;align-items:center;gap:1rem;">
                    <div style="background:#f8fafc;width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#6366f1;"><i data-feather="clipboard"></i></div>
                    <div><h3 style="margin:0;font-size:1.4rem;font-weight:800;color:#0f172a;">Application Tracker</h3><p style="margin:0.2rem 0 0;color:#64748b;font-size:0.85rem;">Submitted on ${formatDate(appObj.submitted_at)}</p></div>
                </div>
                <div class="trk-overall-badge ${isFullyActive ? 'trk-badge-done' : isRejected ? 'trk-badge-error' : isCorrection ? 'trk-badge-warning' : 'trk-badge-active'}" style="padding:0.6rem 1.5rem;border-radius:99px;font-weight:800;font-size:0.8rem;letter-spacing:0.02em;box-shadow:0 2px 10px rgba(0,0,0,0.03);display:flex;align-items:center;gap:0.5rem; ${isCorrection ? 'background: #fffbeb; color: #d97706; border: 1px solid #fde68a;' : ''}">
                    ${isFullyActive ? '<i data-feather="check-circle" style="width:14px;height:14px;"></i> Account Activated' : isRejected ? '<i data-feather="x-circle" style="width:14px;height:14px;"></i> Declined' : isCorrection ? '<i data-feather="alert-circle" style="width:14px;height:14px;"></i> Correction Needed' : `<i data-feather="clock" style="width:14px;height:14px;"></i> ${activeStepLabel}`}
                </div>
            </div>
            ${(isRejected ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1.25rem; flex-direction: column;">
                    <div style="display: flex; align-items: flex-start; gap: 1rem; width: 100%;">
                        <div style="background: #ef4444; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);">
                            <i data-feather="x" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 800; color: #991b1b; font-size: 1rem; margin-bottom: 0.3rem;">Application Declined</div>
                            <div style="color: #b91c1c; font-size: 0.85rem; line-height: 1.5; font-weight: 500; margin-bottom: 1rem;">
                                Reason: ${escHtml(appObj.rejection_reason || appObj.declined_reason || 'No specific reason provided.')}
                            </div>
                            <div>
                                <button id="reapplyBtn" class="btn-primary" style="width: auto; padding: 0.6rem 1.5rem; font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; background: #ef4444; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); cursor: pointer; transition: all 0.2s;">
                                    <i data-feather="refresh-cw" style="width: 14px; height: 14px;"></i> Reapply Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ` : '')}
            <div class="trk-timeline-container" style="position:relative;padding-left:10px;">
                <div class="trk-timeline-line"></div>
                <div class="trk-timeline-steps">${detailedItems.map((it, i) => buildTimelineStep(it, i)).join('')}</div>
            </div>
        </div>`;
}

function buildTimelineStep(it, i) {
    const isActive = it.state === 'active';
    const isCompleted = it.state === 'completed';
    const isRejected = it.state === 'rejected';
    const isCorrection = it.state === 'correction';

    // Distinguish between submission and approval for the badge
    const isSubmission = it.label === 'Application Submitted';
    const badgeText = isSubmission ? 'Submitted' : 'Approved';
    const badgeIcon = 'check-circle';

    return `<div class="trk-step trk-step--${it.state} ${isActive || isRejected || isCorrection ? 'open' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="trk-marker">
            ${isCompleted ? '<i data-feather="check"></i>' : ''}
            ${isRejected ? '<i data-feather="x" style="color:white; width: 14px; height: 14px;"></i>' : ''}
            ${isCorrection ? '<i data-feather="alert-circle" style="color:white; width: 14px; height: 14px;"></i>' : ''}
            ${isActive ? `<div class="trk-marker-active"><div class="trk-marker-pulse"></div></div>` : ''}
        </div>
        <div class="trk-content-card">
            <button class="trk-step-header-btn" onclick="this.closest('.trk-step').classList.toggle('open')">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <h4 class="trk-step-header-title">${escHtml(it.label)}</h4>
                    ${isActive ? `<span class="trk-badge-active-mini"><i data-feather="clock" style="width:10px;height:10px;margin-right:4px;"></i>In Progress</span>` : ''}
                    ${isRejected ? `<span class="trk-badge-error-mini" style="background:#fee2e2; color:#ef4444; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:800; display:flex; align-items:center;"><i data-feather="x-circle" style="width:10px;height:10px;margin-right:4px;"></i>Declined</span>` : ''}
                    ${isCorrection ? `<span class="trk-badge-warning-mini" style="background:#fffbeb; color:#d97706; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:800; display:flex; align-items:center; border:1px solid #fde68a;"><i data-feather="refresh-cw" style="width:10px;height:10px;margin-right:4px;"></i>Resubmit with Correction</span>` : ''}
                    ${isCompleted ? `<span class="trk-badge-success-mini" style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:800; display:flex; align-items:center;"><i data-feather="${badgeIcon}" style="width:10px;height:10px;margin-right:4px;"></i>${badgeText}</span>` : ''}
                </div>
                <i data-feather="chevron-down" class="trk-step-chevron"></i>
            </button>
            <div class="trk-step-body">
                <div style="font-size:0.9rem;color:#475569;margin-bottom:1rem;">${escHtml(it.description || '')}</div>
                ${it.services ? `
                    <div style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 0.75rem; border: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                            <div>
                                <div style="font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.05em;">Recommended Services</div>
                                <div style="font-size: 0.85rem; color: #1e293b; font-weight: 700;">${escHtml(it.services)}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.05em;">LIGO Status</div>
                                <span style="background: ${it.ligo_member ? '#f0f9ff' : '#f8fafc'}; color: ${it.ligo_member ? '#0369a1' : '#475569'}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; border: 1px solid ${it.ligo_member ? '#bae6fd' : '#e2e8f0'};">
                                    ${it.ligo_member ? 'MEMBER' : 'NON-MEMBER'}
                                </span>
                            </div>
                        </div>
                        ${(it.assigned_system || it.assigned_subsystem) ? `
                            <div style="padding-top: 0.75rem; border-top: 1px dashed #e2e8f0; display: flex; gap: 1.5rem;">
                                ${it.assigned_system ? `
                                    <div>
                                        <div style="font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">System</div>
                                        <div style="font-size: 0.75rem; color: #475569; font-weight: 600;">${escHtml(it.assigned_system)}</div>
                                    </div>
                                ` : ''}
                                ${it.assigned_subsystem ? `
                                    <div>
                                        <div style="font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Subsystem</div>
                                        <div style="font-size: 0.75rem; color: #475569; font-weight: 600;">${escHtml(it.assigned_subsystem)}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                ${it.remarks ? `<div style="padding:0.75rem;background:${isRejected ? '#fff1f2' : '#f8fafc'};border-radius:8px;font-style:italic;color:${isRejected ? '#991b1b' : '#64748b'};font-size:0.85rem; border-left: ${isRejected ? '3px solid #ef4444' : 'none'};">"${escHtml(it.remarks)}"</div>` : ''}
            </div>
        </div>
    </div>`;
}



function _internalRenderProfile(appData, allServices) {
    const p = _meData.profile || {};
    const quals = (_meData.qualifications || []).sort((a, b) => {
        // Primary sort: Graduation Year (Descending)
        if (b.graduation_year !== a.graduation_year) return b.graduation_year - a.graduation_year;
        // Secondary sort: Graduation Month (Descending)
        return b.graduation_month - a.graduation_month;
    });
    const contact = _meData.contact || {};
    const mainContent = document.getElementById('db-main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div>

            <!-- Panels Section -->
            <div style="display:flex;flex-direction:column;gap:1.5rem;">
                <div class="db-tracker-card" style="padding:2rem 2.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div class="profile-section-header" style="margin-bottom:1.5rem;"><h3 class="profile-section-title" style="font-size:1.25rem;font-weight:800;color:#0f172a;"><i data-feather="user"></i> Personal Information</h3></div>
                    ${buildPersonalPanel(p)}
                </div>

                <div class="db-tracker-card" style="padding:2rem 2.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div class="profile-section-header" style="margin-bottom:1.5rem;"><h3 class="profile-section-title" style="font-size:1.25rem;font-weight:800;color:#0f172a;"><i data-feather="book-open"></i> Qualification &amp; History</h3></div>
                    ${buildQualPanel(quals)}
                </div>

                <div class="db-tracker-card" style="padding:2rem 2.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div class="profile-section-header" style="margin-bottom:1.5rem;"><h3 class="profile-section-title" style="font-size:1.25rem;font-weight:800;color:#0f172a;"><i data-feather="phone"></i> Contact Details</h3></div>
                    ${buildContactPanel(contact)}
                </div>
            </div>
        </div>`;

    _wireProfileForms(document.getElementById('app'));
    feather.replace();
}

function buildPersonalPanel(p) {
    const fullName = [p.title, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || 'Not provided';
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom:1rem;border-bottom:1px solid #f1f5f9;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                <span class="sb-panel-title" style="font-weight:700;color:#64748b;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;">Current Details</span>
                <button type="button" class="sb-btn-edit" style="background:#6366f1;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.25);"><i data-feather="edit-2" style="width:14px;height:14px;"></i> Edit Info</button>
            </div>
            <div class="sb-view-mode" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;">
                <div class="sb-view-row"><span class="sb-view-label">Full Name</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;">${escHtml(fullName)}</span></div>
                <div class="sb-view-row"><span class="sb-view-label">Date of Birth</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;">${escHtml(p.date_of_birth ? p.date_of_birth.split('T')[0] : '—')}</span></div>
                <div class="sb-view-row"><span class="sb-view-label">Gender</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;text-transform:capitalize;">${escHtml(p.gender || '—')}</span></div>
            </div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1rem;background:#f8fafc;padding:1.5rem;border-radius:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    ${sbSelect('Salutation', 'title', p.title, (_titlesData || []).map(t => ({ value: t.name, label: t.name })))}
                    ${sbField('First Name', 'first_name', p.first_name)}
                    ${sbField('Middle Name', 'middle_name', p.middle_name)}
                    ${sbField('Last Name', 'last_name', p.last_name)}
                    ${sbField('Date of Birth', 'date_of_birth', p.date_of_birth ? p.date_of_birth.split('T')[0] : '', 'date', true)}
                    ${sbSelect('Gender', 'gender', p.gender, [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }, { value: 'prefer-not-to-say', label: 'Prefer not to say' }])}
                </div>
                <div class="sb-form-actions" style="margin-top:0.5rem;">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:#e2e8f0;border:none;color:#475569;padding:0.6rem 1.2rem;border-radius:0.5rem;font-weight:600;">Cancel</button>
                    <button id="sb-save-personal" class="sb-btn-save" style="background:#4f46e5;color:white;border:none;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;">Update Profile</button>
                </div>
            </div>
        </div>`;
}

function buildQualPanel(quals) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let historyHtml = '';
    if (quals.length > 0) {
        const rows = quals.map(q => {
            const isActive = q.graduation_year > currentYear || (q.graduation_year == currentYear && q.graduation_month >= currentMonth);
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:1.25rem 1rem;font-weight:700;color:#0f172a;font-size:0.95rem;">${escHtml(q.highest_qualification || '—')}</td>
                <td style="padding:1.25rem 1rem;color:#475569;font-size:0.9rem;">${escHtml(q.field_of_study || '—')}</td>
                <td style="padding:1.25rem 1rem;">
                    <div style="font-weight:700;color:#1e293b;font-size:0.95rem;">${escHtml(q.university || '—')}</div>
                    <div style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem;display:flex;align-items:center;gap:0.3rem;"><i data-feather="calendar" style="width:12px;height:12px;"></i> Class of ${escHtml(q.graduation_month || '—')}/${escHtml(q.graduation_year || '—')}</div>
                </td>
                <td style="padding:1.25rem 1rem;">
                    ${isActive ? '<span style="background:#6366f1;color:white;padding:0.3rem 0.8rem;border-radius:99px;font-size:0.65rem;font-weight:800;text-transform:uppercase;box-shadow:0 2px 6px rgba(99,102,241,0.2);">Active</span>' : '<span style="color:#94a3b8;font-size:0.75rem;font-weight:600;display:flex;align-items:center;gap:0.3rem;"><i data-feather="check-circle" style="width:12px;height:12px;"></i> Completed</span>'}
                </td>
            </tr>`;
        }).join('');

        historyHtml = `
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;margin-top:0.5rem;">
                    <thead>
                        <tr style="text-align:left;background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                            <th style="padding:1rem;color:#64748b;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:800;">Degree</th>
                            <th style="padding:1rem;color:#64748b;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:800;">Field of Study</th>
                            <th style="padding:1rem;color:#64748b;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:800;">Institute & Year</th>
                            <th style="padding:1rem;color:#64748b;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;font-weight:800;">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } else {
        historyHtml = '<div style="color:#94a3b8;font-style:italic;padding:3rem;text-align:center;background:#f8fafc;border-radius:1rem;border:2px dashed #e2e8f0;">No qualifications added yet.</div>';
    }
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom:1rem;border-bottom:1px solid #f1f5f9;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                <span class="sb-panel-title" style="font-weight:700;color:#64748b;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;">Educational History</span>
                <button type="button" class="sb-btn-edit" style="background:#6366f1;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.25);"><i data-feather="plus" style="width:14px;height:14px;"></i> Add New</button>
            </div>
            <div class="sb-view-mode">${historyHtml}</div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1.25rem;background:#f8fafc;padding:2rem;border-radius:1rem;border:1px solid #e2e8f0;">
                <div style="font-size:0.85rem;color:#1e1b4b;padding:1rem;background:#e0e7ff;border-radius:0.75rem;text-align:center;font-weight:600;border:1px solid #c7d2fe;">Note: Future-dated qualifications will be automatically marked as your primary active status.</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                    ${sbField('Highest Degree', 'highest_qualification', '')}
                    ${sbField('Field of Study', 'field_of_study', '')}
                    ${sbField('University / Institute', 'university', '')}
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        ${sbMonthSelect('Graduation Month', 'graduation_month', '')}
                        ${sbField('Graduation Year', 'graduation_year', '', 'number', false, (new Date().getFullYear() - 70), '2100')}
                    </div>
                </div>
                <div class="sb-form-actions" style="margin-top:1rem;display:flex;justify-content:flex-end;gap:1rem;">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:#e2e8f0;border:none;color:#475569;padding:0.75rem 1.5rem;border-radius:0.5rem;font-weight:600;">Cancel</button>
                    <button id="sb-save-qual" class="sb-btn-save" style="background:#4f46e5;color:white;border:none;padding:0.75rem 2rem;border-radius:0.5rem;font-weight:700;box-shadow:0 4px 12px rgba(79,70,229,0.2);">Save Qualification</button>
                </div>
            </div>
        </div>`;
}

function buildContactPanel(c) {
    const addressStr = [c.address_line_1, c.address_line_2, c.city, c.state, c.country_name, c.postal_code].filter(Boolean).join(', ') || '—';
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom:1rem;border-bottom:1px solid #f1f5f9;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                <span class="sb-panel-title" style="font-weight:700;color:#64748b;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;">Current Details</span>
                <button type="button" class="sb-btn-edit" style="background:#6366f1;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.25);"><i data-feather="edit-2" style="width:14px;height:14px;"></i> Edit Details</button>
            </div>
            <div class="sb-view-mode" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;">
                <div class="sb-view-row"><span class="sb-view-label">Phone</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;font-size:1.1rem;">${escHtml(c.phone_number || '—')}</span></div>
                <div class="sb-view-row"><span class="sb-view-label">Fax</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;">${escHtml(c.fax_number || '—')}</span></div>
                <div class="sb-view-row" style="grid-column:span 1;"><span class="sb-view-label">Address</span><span class="sb-view-value" style="line-height:1.5;color:#1e293b;font-weight:600;">${escHtml(addressStr)}</span></div>
            </div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1.25rem;background:#f8fafc;padding:1.5rem;border-radius:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    ${sbField('Phone', 'phone_number', c.phone_number, 'tel')}
                    ${sbField('Fax', 'fax_number', c.fax_number, 'tel')}
                    ${sbField('Address Line 1', 'address_line_1', c.address_line_1)}
                    ${sbField('Address Line 2', 'address_line_2', c.address_line_2)}
                    ${sbField('City', 'city', c.city)}
                    ${sbField('State / Province', 'state', c.state)}
                    ${sbField('Postcode', 'postal_code', c.postal_code)}
                    ${sbField('Country', 'country_name', c.country_name)}
                </div>
                <div class="sb-form-actions">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:#e2e8f0;border:none;color:#475569;padding:0.6rem 1.2rem;border-radius:0.5rem;font-weight:600;">Cancel</button>
                    <button id="sb-save-contact" class="sb-btn-save" style="background:#4f46e5;color:white;border:none;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;">Save Address</button>
                </div>
            </div>
        </div>`;
}

function sbField(label, name, value, type = 'text', disabled = false, min = '', max = '') {
    const disabledAttr = disabled ? 'disabled' : '';
    const bg = disabled ? '#f1f5f9' : '#ffffff';
    const col = disabled ? '#94a3b8' : '#0f172a';
    const cur = disabled ? 'cursor:not-allowed;' : '';
    return `
        <div class="sb-field" style="margin-bottom:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label class="sb-field-label" style="color:#64748b;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.025em;margin-left:0.25rem;">${escHtml(label)}</label>
            <input class="sb-field-input" 
                style="background:${bg};border:1.5px solid #e2e8f0;color:${col};${cur}padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.95rem;transition:all 0.2s;font-weight:500;" 
                type="${type}" name="${name}" value="${escHtml(value ?? '')}" 
                min="${escHtml(min)}" max="${escHtml(max)}"
                ${disabledAttr} placeholder="${escHtml(label)}…">
        </div>`;
}

function sbSelect(label, name, current, options) {
    const opts = options.map(o => `<option value="${o.value}" ${String(current) === String(o.value) ? 'selected' : ''}>${o.label}</option>`).join('');
    return `
        <div class="sb-field" style="margin-bottom:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label class="sb-field-label" style="color:#64748b;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.025em;margin-left:0.25rem;">${escHtml(label)}</label>
            <select class="sb-field-input" style="background:#ffffff;border:1.5px solid #e2e8f0;color:#0f172a;padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.95rem;transition:all 0.2s;font-weight:500;" name="${name}">${opts}</select>
        </div>`;
}

function sbMonthSelect(label, name, current) {
    const months = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];
    return sbSelect(label, name, current, months);
}

function _wireProfileForms(app) {
    app.querySelectorAll('.sb-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.db-tracker-card');
            const viewMode = wrapper?.querySelector('.sb-view-mode');
            const formMode = wrapper?.querySelector('.sb-panel-form');
            if (viewMode && formMode) {
                viewMode.style.display = 'none';
                formMode.style.display = 'flex';
                btn.style.display = 'none';
            }
        });
    });

    app.querySelectorAll('.sb-btn-cancel-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.db-tracker-card');
            const viewMode = wrapper?.querySelector('.sb-view-mode');
            const formMode = wrapper?.querySelector('.sb-panel-form');
            const editBtn = wrapper?.querySelector('.sb-btn-edit');
            if (viewMode && formMode) {
                formMode.style.display = 'none';
                viewMode.style.display = '';
                if (editBtn) editBtn.style.display = '';
            }
        });
    });

    _wireSave(app, 'sb-save-personal', ['title', 'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender'], API.PROFILE_UPDATE, 'PATCH');
    _wireSave(app, 'sb-save-qual', ['highest_qualification', 'field_of_study', 'university', 'graduation_year', 'graduation_month'], API.QUALIFICATION_ADD, 'POST');
    _wireSave(app, 'sb-save-contact', ['phone_number', 'fax_number', 'address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country_name'], API.PROFILE_UPDATE, 'PATCH');
}

function _wireSave(app, btnId, fields, url, method) {
    const btn = app.querySelector('#' + btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const original = btn.textContent;
        btn.textContent = 'Saving…';
        btn.disabled = true;

        const form = btn.closest('.sb-panel-form');
        const payload = {};
        fields.forEach(f => {
            const el = form?.querySelector(`[name="${f}"]`);
            if (el) payload[f] = el.value;
        });

        const fb = form?.querySelector('.sb-save-feedback');
        try {
            const res = await authFetch(url, { method, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(Object.values(data.errors || {}).flat().join(' ') || data.message || 'Error');

            // Refresh _meData so the view reflects saved values
            const fresh = await authFetch(API.ME);
            if (fresh.ok) _meData = await fresh.json();

            if (fb) { fb.textContent = '✓ Saved'; fb.className = 'sb-save-feedback sb-save-feedback--ok'; }
            setTimeout(() => _internalRenderProfile(null, null), 900);
        } catch (err) {
            if (fb) { fb.textContent = err.message; fb.className = 'sb-save-feedback sb-save-feedback--err'; }
        } finally {
            btn.textContent = original;
            btn.disabled = false;
            if (fb) setTimeout(() => { fb.textContent = ''; fb.className = 'sb-save-feedback'; }, 3500);
        }
    });
}
function buildAccordion(r) {
    const roleLabel = escHtml(REVIEW_ROLE_CONFIG[r.slug]?.label || r.name || r.slug);
    const roleClass = `db-role-${r.slug.replace(/_/g, '-')}`;
    return `
        <div class="db-accordion ${roleClass}" id="accordion-${r.slug}">
            <button class="db-accordion-toggle" data-role-slug="${r.slug}">
                <span class="db-accordion-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                <span class="db-role-name-text">${roleLabel}</span>
                <span class="db-accordion-badge-label">&nbsp;&mdash;&nbsp;Pending Reviews</span>
                <span class="db-accordion-badge" id="badge-${r.slug}"></span>
            </button>
            <div class="db-accordion-body">
                <div class="db-search-wrap" style="padding: 1rem 1.5rem 0.5rem; display: flex; justify-content: flex-end; border-bottom: 1px solid #f1f5f9; background: #fafafa; margin-bottom: 1rem;">
                    <div style="position: relative; width: 300px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input id="db-search-${r.slug}" class="adm-search-input" type="text"
                            style="width: 100%; box-sizing: border-box; padding: 0.5rem 1rem 0.5rem 2.25rem; border: 1.5px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.8rem; outline: none; transition: border-color 0.2s;"
                            placeholder="Search in ${roleLabel}…">
                    </div>
                </div>
                <div class="db-table-wrap" id="table-${r.slug}"></div>
            </div>
        </div>`;
}
function renderRoleApplications(roleSlug, apps) {
    const tableWrap = document.getElementById(`table-${roleSlug}`);
    const badge = document.getElementById(`badge-${roleSlug}`);
    const count = apps.length;

    if (badge) {
        badge.textContent = count;
        if (count === 0) badge.classList.add('sb-badge--zero');
        else badge.classList.remove('sb-badge--zero');
    }

    if (tableWrap) {
        tableWrap.innerHTML = count ? buildApplicationsTable(apps) : buildEmptyTable();
        if (count) {
            tableWrap.querySelectorAll('.db-review-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    openReviewModal(apps.find(x => x.id == btn.dataset.appId), () => {
                        // Refresh all by re-fetching centralized data
                        authFetch(API.APPLICATIONS).then(res => res.json()).then(freshApps => {
                            _allApps = freshApps || [];
                            const q = (document.getElementById('db-search-input')?.value || '').toLowerCase();
                            _roles.filter(r => REVIEW_ROLE_CONFIG[r.slug]).forEach(role => {
                                const roleApps = _allApps.filter(a => a.role_slug === role.slug && (
                                    (a.applicant_name || '').toLowerCase().includes(q) ||
                                    (a.applicant_email || '').toLowerCase().includes(q) ||
                                    (a.application_id || '').toLowerCase().includes(q) ||
                                    String(a.id).includes(q)
                                ));
                                renderRoleApplications(role.slug, roleApps);
                            });
                        });
                    });
                };
            });
        }
    }
}

function buildApplicationsTable(apps) {
    const rows = apps.map(a => `
        <tr>
            <td>
                <div class="db-applicant-name">${escHtml(a.applicant_name || a.applicant_email || '—')}</div>
                <div class="db-applicant-email">${escHtml(a.applicant_email || '')}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 500;">App ID: ${escHtml(a.application_id || a.id || '—')}</div>
            </td>
            <td>${escHtml(a.request_name || '—')}</td>
            <td>${escHtml(a.workflow_name || '—')}</td>
            <td><span class="db-status-pill">${escHtml(a.current_status || '—')}</span></td>
            <td><span class="db-action-pill">${escHtml(a.step_action || '—')}</span></td>
            <td>${a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-GB') : '—'}</td>
            <td><button class="db-review-btn" data-app-id="${a.id}">Review</button></td>
        </tr>`).join('');
    return `
        <table class="db-table">
            <thead><tr>
                <th>Applicant</th><th>Request</th><th>Workflow</th>
                <th>Status</th><th>Action Required</th><th>Submitted</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}
function buildEmptyTable() {
    return `
        <div class="db-empty-table" style="padding:4rem 2rem;text-align:center;background:#f8fafc;border-radius:1rem;border:2px dashed #e2e8f0;margin:1rem 0;">
            <div style="background:#f1f5f9;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;color:#94a3b8;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <div style="font-weight:800;color:#64748b;font-size:1.1rem;margin-bottom:0.5rem;">All Caught Up!</div>
            <p style="color:#94a3b8;font-size:0.9rem;margin:0;max-width:300px;margin:0 auto;">No pending applications are currently awaiting review for this role.</p>
        </div>`;
}
function escHtml(s) { if (!s) return ''; const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return String(s).replace(/[&<>"']/g, k => m[k]); }
function buildSshSetupHtml() {
    return `
        <div class="db-tracker-card" style="padding:2rem;">
            <div style="margin-bottom:2rem;display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <h3 style="margin:0;font-size:1.25rem;font-weight:800;color:#0f172a;"><i data-feather="key" style="vertical-align:middle;margin-right:0.5rem;width:20px;"></i> SSH Key Registration</h3>
                    <p style="margin:0.5rem 0 0;color:#64748b;font-size:0.9rem;">Register your public key to enable secure computing access.</p>
                </div>
                <button id="ssh-help-toggle" style="background:#f1f5f9;border:none;color:#475569;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:0.4rem;">
                    <i data-feather="help-circle" style="width:14px;"></i> How to generate?
                </button>
            </div>

            <div id="ssh-instructions" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.75rem;padding:1.5rem;margin-bottom:2rem;font-size:0.85rem;color:#334155;">
                <h4 style="margin:0 0 1rem;font-weight:800;color:#0f172a;">Generating your SSH Key</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                    <div>
                        <strong style="display:block;margin-bottom:0.5rem;color:#6366f1;">Linux / macOS</strong>
                        <p style="margin-bottom:0.5rem;">Open Terminal and run:</p>
                        <code style="display:block;background:#e2e8f0;padding:0.75rem;border-radius:0.5rem;font-family:monospace;margin-bottom:1rem;position:relative;">
                            ssh-keygen -t ed25519
                        </code>
                        <p>Press Enter for all defaults. Your <strong>public key</strong> will be at <code>~/.ssh/id_ed25519.pub</code></p>
                    </div>
                    <div>
                        <strong style="display:block;margin-bottom:0.5rem;color:#6366f1;">Windows (PowerShell)</strong>
                        <p style="margin-bottom:0.5rem;">Open PowerShell and run:</p>
                        <code style="display:block;background:#e2e8f0;padding:0.75rem;border-radius:0.5rem;font-family:monospace;margin-bottom:1rem;">
                            ssh-keygen.exe
                        </code>
                        <p>Your <strong>public key</strong> will be at <code>C:\\Users\\YourName\\.ssh\\id_rsa.pub</code></p>
                    </div>
                </div>
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid #e2e8f0;text-align:right;">
                    <button id="ssh-help-close" style="background:none;border:none;color:#6366f1;font-weight:700;cursor:pointer;">Got it, thanks!</button>
                </div>
            </div>

            <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:1rem;padding:2.5rem;text-align:center;" id="ssh-drop-zone">
                <div id="ssh-upload-idle">
                    <div style="color:#94a3b8;margin-bottom:1rem;"><i data-feather="upload-cloud" style="width:40px;height:40px;"></i></div>
                    <h4 style="margin:0 0 0.5rem;font-weight:700;color:#1e293b;">Upload Public Key</h4>
                    <p style="color:#64748b;font-size:0.85rem;margin-bottom:1.5rem;">id_rsa.pub or similar public key file</p>
                    <button class="sb-btn-save" style="background:#6366f1;color:white;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;border:none;cursor:pointer;" onclick="document.getElementById('ssh-file-input').click()">Browse Files</button>
                    <input type="file" id="ssh-file-input" style="display:none" accept=".pub,text/plain">
                </div>
                <div id="ssh-upload-selected" style="display:none">
                    <div style="background:white;padding:1rem;border-radius:0.75rem;display:flex;align-items:center;gap:1rem;border:1px solid #e2e8f0;margin-bottom:1.5rem;text-align:left;">
                        <div style="color:#6366f1;"><i data-feather="file-text"></i></div>
                        <div style="flex:1;"><div id="ssh-filename" style="font-weight:700;color:#1e293b;font-size:0.9rem;">filename.pub</div><div id="ssh-filesize" style="font-size:0.75rem;color:#94a3b8;">—</div></div>
                        <button style="background:none;border:none;color:#ef4444;cursor:pointer;" id="ssh-remove-file"><i data-feather="x"></i></button>
                    </div>
                    <button class="sb-btn-save" id="ssh-submit-btn" style="background:#10b981;color:white;width:100%;padding:0.75rem;border-radius:0.5rem;font-weight:800;border:none;cursor:pointer;">Register Key</button>
                </div>
            </div>

            <div style="margin-top:2rem;padding:1.25rem;background:#fefce8;border:1px solid #fef08a;border-radius:0.75rem;display:flex;gap:0.75rem;">
                <div style="color:#ca8a04;"><i data-feather="info" style="width:18px;"></i></div>
                <div style="font-size:0.85rem;color:#854d0e;line-height:1.5;">
                    <strong>Important:</strong> Only upload your <strong>Public Key</strong>. Never share your private key. This key is required for automated provisioning.
                </div>
            </div>
            <div id="ssh-feedback" style="margin-top:1.5rem;padding:1rem;border-radius:0.5rem;display:none;font-size:0.9rem;font-weight:600;"></div>
        </div>`;
}

function _wireSshUpload(container, onSuccessRedirect) {
    const helpToggle = container.querySelector('#ssh-help-toggle');
    const helpClose = container.querySelector('#ssh-help-close');
    const helpPanel = container.querySelector('#ssh-instructions');

    if (helpToggle) helpToggle.onclick = () => { helpPanel.style.display = 'block'; helpToggle.style.display = 'none'; };
    if (helpClose) helpClose.onclick = () => { helpPanel.style.display = 'none'; helpToggle.style.display = 'flex'; };

    const fileInput = container.querySelector('#ssh-file-input');
    const dropZone = container.querySelector('#ssh-drop-zone');
    const idleView = container.querySelector('#ssh-upload-idle');
    const selectedView = container.querySelector('#ssh-upload-selected');
    const filenameEl = container.querySelector('#ssh-filename');
    const filesizeEl = container.querySelector('#ssh-filesize');
    const removeBtn = container.querySelector('#ssh-remove-file');
    const submitBtn = container.querySelector('#ssh-submit-btn');
    const feedback = container.querySelector('#ssh-feedback');

    let selectedFile = null;

    const handleFile = (file) => {
        if (!file) return;
        selectedFile = file;
        filenameEl.textContent = file.name;
        filesizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
        if (idleView) idleView.style.display = 'none';
        if (selectedView) selectedView.style.display = 'block';
        if (dropZone) { dropZone.style.background = '#f0f9ff'; dropZone.style.borderColor = '#6366f1'; }
    };

    if (fileInput) fileInput.onchange = (e) => handleFile(e.target.files[0]);
    if (removeBtn) removeBtn.onclick = () => {
        selectedFile = null;
        if (idleView) idleView.style.display = 'block';
        if (selectedView) selectedView.style.display = 'none';
        if (dropZone) { dropZone.style.background = '#f8fafc'; dropZone.style.borderColor = '#e2e8f0'; }
        if (fileInput) fileInput.value = '';
    };

    if (submitBtn) submitBtn.onclick = async () => {
        if (!selectedFile) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering…';
        if (feedback) feedback.style.display = 'none';

        const formData = new FormData();
        formData.append('ssh_key', selectedFile);

        try {
            const res = await authFetch(API.SSH_KEY_STORE, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || (data.errors ? Object.values(data.errors).flat().join(' ') : 'Failed to upload key.'));

            if (feedback) {
                feedback.style.display = 'block';
                feedback.style.background = '#f0fdf4';
                feedback.style.color = '#15803d';
                feedback.style.border = '1px solid #bbf7d0';
                feedback.textContent = '✓ SSH Key successfully registered. System provisioning will begin shortly.';
            }

            if (selectedView) selectedView.style.display = 'none';
            if (idleView) {
                idleView.style.display = 'block';
                idleView.innerHTML = `<div style="color:#10b981;margin-bottom:1.5rem;"><i data-feather="check-circle" style="width:48px;height:48px;"></i></div><h4 style="color:#065f46;">Key Registered</h4><p style="color:#065f46;font-size:0.85rem;">You have already uploaded your public key.</p>`;
            }
            feather.replace();

            // Refresh user data to update sidebar (hide SSH Setup)
            authFetch(API.ME).then(r => r.json()).then(data => {
                if (data.user) {
                    _meData = data;
                    _me = data.user;
                    // If option is now disabled, redirect back to dashboard after a short delay
                    if (!data.can_setup_ssh && onSuccessRedirect) {
                        setTimeout(() => onSuccessRedirect(), 2000);
                    }
                }
            }).catch(() => { });
        } catch (err) {
            if (feedback) {
                feedback.style.display = 'block';
                feedback.style.background = '#fef2f2';
                feedback.style.color = '#b91c1c';
                feedback.style.border = '1px solid #fecaca';
                feedback.textContent = err.message;
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register Public Key';
        }
    };

    feather.replace();
}

function buildUploadIdHtml(app) {
    return `
    <div class="db-tracker-card" style="padding: 2.5rem; max-width: 800px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #f1f5f9;">
            <div style="background: #fff7ed; width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
                <i data-feather="upload-cloud" style="width: 32px; height: 32px;"></i>
            </div>
            <div>
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #0f172a;">Upload Valid ID Card</h3>
                <p style="margin: 0.25rem 0 0; color: #64748b; font-size: 0.9rem;">Your application requires a valid institutional identity card to continue.</p>
            </div>
        </div>

        <!-- Reviewer Remark Section -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <label style="font-size: 0.7rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-feather="message-square" style="width: 14px; height: 14px;"></i> Reviewer Remarks
                </label>
                <div style="background: #fef2f2; color: #991b1b; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.65rem; font-weight: 800; border: 1px solid #fecaca; display: flex; align-items: center; gap: 0.4rem;">
                    <i data-feather="clock" style="width: 12px; height: 12px;"></i> 72H DEADLINE
                </div>
            </div>
            <div style="color: #451a03; font-size: 1rem; line-height: 1.6; font-weight: 500; font-style: italic; margin-bottom: 0.75rem;">
                "${escHtml(app.id_card_reupload_remarks || 'Please upload a valid institutional ID card for verification.')}"
            </div>
            <p style="margin: 0; font-size: 0.75rem; color: #92400e; opacity: 0.8; font-weight: 600;">
                <i data-feather="alert-circle" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                Failure to provide a valid ID card within 72 hours of the request will result in automatic application rejection.
            </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
            <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.75rem; text-transform: uppercase;">Current Identity Card</label>
                <div id="current-id-preview-container" style="border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; background: #f8fafc; height: 200px; display: flex; align-items: center; justify-content: center; position: relative;">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                </div>
                <div style="margin-top: 0.5rem; text-align: center;">
                    <button type="button" id="btn-view-full-id" style="background: none; border: none; color: #6366f1; font-size: 0.75rem; font-weight: 700; cursor: pointer; text-decoration: underline; display: none;">View Full Resolution</button>
                </div>
            </div>

            <!-- New ID Upload -->
            <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.75rem; text-transform: uppercase;">Upload New Valid ID Card</label>
                <div id="id-dropzone" style="border: 2px dashed #cbd5e1; border-radius: 0.75rem; padding: 2rem; text-align: center; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; transition: all 0.2s; overflow: hidden;">
                    <i data-feather="image" style="width: 40px; height: 40px; color: #94a3b8; margin-bottom: 1rem;"></i>
                    <p style="margin: 0; font-size: 0.85rem; color: #64748b; font-weight: 500;">Click to select or drag & drop</p>
                    <p style="margin: 0.25rem 0 0; font-size: 0.7rem; color: #94a3b8;">PDF, JPG, JPEG, or PNG (Max 5MB)</p>
                    <input type="file" id="new-id-input" accept="image/*,application/pdf" style="display: none;">
                </div>
                <div id="file-name-preview" style="margin-top: 0.75rem; font-size: 0.8rem; color: #6366f1; font-weight: 700; text-align: center;"></div>
            </div>
        </div>

        <div id="upload-feedback" style="display: none; padding: 1rem; border-radius: 0.75rem; margin-bottom: 2rem; font-size: 0.9rem; font-weight: 600;"></div>

        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
            <button class="sb-btn-save sb-btn-cancel-edit" style="background: #e2e8f0; border: none; color: #475569; padding: 0.75rem 2.5rem; border-radius: 0.75rem; font-weight: 700; cursor: pointer; min-width: 160px;" onclick="window.location.hash = '#/dashboard'">Cancel</button>
            <button id="btn-submit-reupload" class="btn-primary" style="background: #6366f1; border: none; color: white; padding: 0.75rem 2.5rem; border-radius: 0.75rem; font-weight: 700; box-shadow: 0 4px 12px rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; min-width: 160px;">
                <i data-feather="send"></i> Submit
            </button>
        </div>
    </div>
    
    <!-- Cropper Modal -->
    <div id="cropper-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:2rem; border-radius:1rem; max-width:90%; width:600px; position:relative;">
            <h3 style="margin-top:0; margin-bottom:1.5rem; font-weight:800; color:#0f172a;">Adjust Your ID Card</h3>
            <div style="max-height:400px; overflow:hidden; background:#f1f5f9; border-radius:0.5rem; margin-bottom:1.5rem;">
                <img id="cropper-image" style="max-width:100%; display:block;">
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:1.5rem;">
                <button id="rotate-left-btn" class="sb-btn-edit" title="Rotate Left"><i data-feather="rotate-ccw"></i></button>
                <button id="rotate-right-btn" class="sb-btn-edit" title="Rotate Right"><i data-feather="rotate-cw"></i></button>
                <div style="width:1px; height:24px; background:#e2e8f0; margin:0 0.5rem;"></div>
                <button id="zoom-in-btn" class="sb-btn-edit" title="Zoom In"><i data-feather="zoom-in"></i></button>
                <button id="zoom-out-btn" class="sb-btn-edit" title="Zoom Out"><i data-feather="zoom-out"></i></button>
            </div>
            <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                <button id="cancel-crop-btn" style="background:#e2e8f0; border:none; color:#475569; padding:0.6rem 1.25rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Cancel</button>
                <button id="crop-btn" style="background:#6366f1; border:none; color:white; padding:0.6rem 2rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Apply Crop & Save</button>
            </div>
        </div>
    </div>`;
}

function _wireUploadId(container, app, onSuccess) {
    const dropzone = container.querySelector('#id-dropzone');
    const input = container.querySelector('#new-id-input');
    const preview = container.querySelector('#file-name-preview');
    const submitBtn = container.querySelector('#btn-submit-reupload');
    const feedback = container.querySelector('#upload-feedback');
    const currentIdBox = container.querySelector('#current-id-preview-container');
    const fullViewBtn = container.querySelector('#btn-view-full-id');

    // Load current ID securely
    (async () => {
        try {
            const targetUid = _me.user_id || app.user_id;
            if (!targetUid) throw new Error('User ID missing');

            const res = await authFetch(API.SECURE_FILE(targetUid));
            if (!res.ok) throw new Error('Not found');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const hasPdfPath = app.id_card_path && String(app.id_card_path).toLowerCase().endsWith('.pdf');
            const isPdfBlob = blob.type === 'application/pdf';

            if (hasPdfPath || isPdfBlob) {
                currentIdBox.innerHTML = `<div style="text-align:center;"><i data-feather="file-text" style="width:48px;height:48px;color:#94a3b8;margin-bottom:0.5rem;"></i><div style="font-size:0.75rem;color:#64748b;">PDF Document</div></div>`;
            } else {
                currentIdBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit: cover;">`;
            }

            fullViewBtn.style.display = 'inline-block';
            fullViewBtn.onclick = () => window.open(url, '_blank');
            feather.replace();
        } catch (e) {
            console.error('[Dashboard] ID fetch error:', e);
            currentIdBox.innerHTML = `<div style="padding:1rem; text-align:center; color:#94a3b8; font-size:0.8rem;">Preview not available</div>`;
        }
    })();

    dropzone.onclick = () => input.click();

    let cropper = null;
    const cropperModal = container.querySelector('#cropper-modal');
    const cropperImg = container.querySelector('#cropper-image');
    const cropBtn = container.querySelector('#crop-btn');
    const cancelCropBtn = container.querySelector('#cancel-crop-btn');

    const rotateLeftBtn = container.querySelector('#rotate-left-btn');
    const rotateRightBtn = container.querySelector('#rotate-right-btn');
    const zoomInBtn = container.querySelector('#zoom-in-btn');
    const zoomOutBtn = container.querySelector('#zoom-out-btn');

    let finalFile = null;

    input.onchange = () => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    cropperImg.src = e.target.result;
                    cropperModal.style.display = 'flex';
                    if (cropper) cropper.destroy();
                    cropper = new Cropper(cropperImg, {
                        aspectRatio: NaN,
                        viewMode: 1,
                        background: false
                    });
                    feather.replace();
                };
                reader.readAsDataURL(file);
            } else {
                // PDF or other
                finalFile = file;
                preview.textContent = `Selected: ${file.name}`;
                dropzone.innerHTML = `<i data-feather="file-text" style="width:40px;height:40px;color:#6366f1;margin-bottom:1rem;"></i><p style="margin:0;font-size:0.85rem;color:#0f172a;font-weight:700;">${file.name}</p>`;
                feather.replace();
            }
        }
    };

    cropBtn.onclick = () => {
        const canvas = cropper.getCroppedCanvas({ maxWidth: 2000, maxHeight: 2000 });
        canvas.toBlob((blob) => {
            finalFile = new File([blob], input.files[0].name, { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            dropzone.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit: contain; border-radius:0.5rem;">`;
            preview.textContent = `Selected & Cropped: ${finalFile.name}`;
            cropperModal.style.display = 'none';
            cropper.destroy();
            cropper = null;
        }, 'image/jpeg', 0.9);
    };

    cancelCropBtn.onclick = () => {
        cropperModal.style.display = 'none';
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        if (!finalFile) input.value = '';
    };

    rotateLeftBtn.onclick = () => cropper && cropper.rotate(-90);
    rotateRightBtn.onclick = () => cropper && cropper.rotate(90);
    zoomInBtn.onclick = () => cropper && cropper.zoom(0.1);
    zoomOutBtn.onclick = () => cropper && cropper.zoom(-0.1);

    submitBtn.onclick = async () => {
        if (!input.files || input.files.length === 0) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.textContent = 'Please select a valid identity card file first.';
            return;
        }

        const formData = new FormData();
        formData.append('id_card', finalFile || input.files[0]);
        formData.append('application_id', app.id);

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-border spinner-border-sm" style="width: 1.2rem; height: 1.2rem; border-width: 0.15em;"></div> Processing...';

            const res = await authFetch(`/api/auth/applications/${app.id}/reupload-id-card`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to re-upload ID card.');

            feedback.style.display = 'block';
            feedback.style.background = '#f0fdf4';
            feedback.style.color = '#15803d';
            feedback.style.border = '1px solid #bbf7d0';
            feedback.textContent = '✓ Identity Proof successfully re-uploaded. Application resumed at previous review stage.';

            setTimeout(() => {
                onSuccess();
            }, 2500);

        } catch (err) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-feather="send"></i> Submit';
            feather.replace();
        }
    };

    feather.replace();
}

window.handleQuickIdResubmit = async function (appInternalId) {
    // Redirect to the dedicated page for consistent flow
    localStorage.setItem('db_active_tab', 'upload_id');
    const app = document.getElementById('app');
    if (app) renderDashboard(app);
};

// ── Invite User Section ───────────────────────────────────────────────────────
function buildInviteUserHtml() {
    return `
        <div style="display:flex; flex-direction:column; gap:2rem;">
            <!-- Invite Form Card -->
            <div class="db-tracker-card" style="padding:2rem 2.5rem; box-shadow:0 4px 20px rgba(0,0,0,0.05); border-radius:1rem;">
                <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #f1f5f9;">
                    <div style="background:linear-gradient(135deg,var(--primary-600) 0%,var(--primary-800) 100%); width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px; color:white; box-shadow:0 4px 10px rgba(99,102,241,0.25);">
                        <i data-feather="user-plus"></i>
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#0f172a;">Invite New User</h3>
                        <p style="margin:0.2rem 0 0; color:#64748b; font-size:0.8rem;">Send a secure invitation email to add a new team member.</p>
                    </div>
                </div>

                <form id="supervisor-invite-form" style="display:grid; grid-template-columns:1fr 1fr auto; gap:1.25rem; align-items:flex-end;">
                    <div class="sb-field" style="display:flex; flex-direction:column; gap:0.4rem; margin:0;">
                        <label style="color:#64748b; font-weight:700; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.025em; margin-left:0.25rem;">Email Address</label>
                        <input class="sb-field-input" style="background:#ffffff; border:1.5px solid #e2e8f0; padding:0.75rem 1rem; border-radius:0.75rem; font-size:0.95rem; font-weight:500;" type="email" id="invite-email" required placeholder="member@example.com">
                    </div>

                    <div class="sb-field" style="display:flex; flex-direction:column; gap:0.4rem; margin:0;">
                        <label style="color:#64748b; font-weight:700; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.025em; margin-left:0.25rem;">Role Designation</label>
                        <select class="sb-field-input" style="background:#ffffff; border:1.5px solid #e2e8f0; padding:0.75rem 1rem; border-radius:0.75rem; font-size:0.95rem; font-weight:500;" id="invite-role">
                            <option value="user">User (Default)</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="subsystem_lead">Sub-System Lead</option>
                            <option value="system_lead">System Lead</option>
                            <option value="li_coordinator">LI Coordinator</option>
                            <option value="pet_lead">PET Lead</option>
                        </select>
                    </div>

                    <button type="submit" id="supervisor-invite-btn" style="background:#4f46e5; color:white; border:none; padding:0.8rem 2rem; border-radius:0.75rem; font-weight:700; font-size:0.95rem; display:flex; align-items:center; gap:0.5rem; box-shadow:0 4px 12px rgba(79,70,229,0.25); cursor:pointer; height:47px; transition:all 0.2s;">
                        <i data-feather="send" style="width:16px; height:16px;"></i> Send Invite
                    </button>
                </form>
            </div>

            <!-- Sent Invitations Card -->
            <div class="db-tracker-card" style="padding:2rem 2.5rem; box-shadow:0 4px 20px rgba(0,0,0,0.05); border-radius:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #f1f5f9;">
                    <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#0f172a;">Sent Invitations</h3>
                    <span id="invitations-count-badge" style="background:#e0e7ff; color:#4338ca; padding:0.25rem 0.75rem; border-radius:99px; font-weight:800; font-size:0.75rem;">0 Total</span>
                </div>

                <div id="invitations-table-container">
                    <div class="db-loading-inline"><div class="spinner"></div> Loading sent invitations…</div>
                </div>
            </div>
        </div>
    `;
}

async function _wireInviteUser(container) {
    const form = container.querySelector('#supervisor-invite-form');
    const emailInput = container.querySelector('#invite-email');
    const roleSelect = container.querySelector('#invite-role');
    const submitBtn = container.querySelector('#supervisor-invite-btn');
    const tableContainer = container.querySelector('#invitations-table-container');
    const countBadge = container.querySelector('#invitations-count-badge');

    // Fetch and render list
    async function loadInvitations() {
        try {
            const res = await authFetch(API.INVITATIONS);
            if (!res.ok) throw new Error('Failed to load invitations.');
            const list = await res.json();

            countBadge.textContent = `${list.length} Total`;

            if (list.length === 0) {
                tableContainer.innerHTML = `
                    <div style="text-align:center; padding:3rem; color:#94a3b8; font-style:italic; border:2px dashed #e2e8f0; border-radius:0.75rem; background:#f8fafc;">
                        No invitations sent yet.
                    </div>
                `;
                return;
            }

            const rows = list.map(inv => {
                const roleLabel = inv.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                
                let badgeStyle = '';
                let statusLabel = inv.status;
                if (inv.status === 'pending') {
                    badgeStyle = 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;';
                } else if (inv.status === 'accepted') {
                    badgeStyle = 'background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0;';
                } else if (inv.status === 'expired') {
                    badgeStyle = 'background:#fef2f2; color:#b91c1c; border:1px solid #fecaca;';
                } else {
                    badgeStyle = 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;';
                }

                // Expiry or accepted date display
                const dateVal = inv.status === 'accepted' ? inv.accepted_at : inv.expires_at;
                const dateLabel = inv.status === 'accepted' ? 'Accepted At' : 'Expires At';
                
                // Action buttons
                let actionsHtml = '';
                if (inv.status === 'pending') {
                    actionsHtml = `
                        <div style="display:flex; gap:0.5rem;">
                            <button class="invite-action-btn resend-btn" data-id="${inv.id}" style="background:#e0e7ff; color:#4338ca; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:700; font-size:0.75rem; display:flex; align-items:center; gap:0.25rem; cursor:pointer;" title="Resend Email"><i data-feather="refresh-cw" style="width:12px; height:12px;"></i> Resend</button>
                            <button class="invite-action-btn cancel-btn" data-id="${inv.id}" style="background:#fef2f2; color:#b91c1c; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:700; font-size:0.75rem; display:flex; align-items:center; gap:0.25rem; cursor:pointer;" title="Cancel Invite"><i data-feather="trash-2" style="width:12px; height:12px;"></i> Cancel</button>
                        </div>
                    `;
                } else if (inv.status === 'expired' || inv.status === 'cancelled') {
                    actionsHtml = `
                        <button class="invite-action-btn resend-btn" data-id="${inv.id}" style="background:#e0e7ff; color:#4338ca; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:700; font-size:0.75rem; display:flex; align-items:center; gap:0.25rem; cursor:pointer;"><i data-feather="refresh-cw" style="width:12px; height:12px;"></i> Resend</button>
                    `;
                } else {
                    actionsHtml = `<span style="color:#166534; font-weight:700; font-size:0.8rem; display:flex; align-items:center; gap:0.25rem;"><i data-feather="check-circle" style="width:14px; height:14px;"></i> Accepted</span>`;
                }

                return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:1rem; font-weight:700; color:#0f172a; font-size:0.9rem;">${escHtml(inv.email)}</td>
                        <td style="padding:1rem;"><span style="background:#e0f2fe; color:#0369a1; padding:0.25rem 0.6rem; border-radius:6px; font-weight:700; font-size:0.75rem; border:1px solid #bae6fd;">${escHtml(roleLabel)}</span></td>
                        <td style="padding:1rem;"><span style="padding:0.25rem 0.6rem; border-radius:99px; font-weight:800; font-size:0.7rem; text-transform:uppercase; ${badgeStyle}">${escHtml(statusLabel)}</span></td>
                        <td style="padding:1rem; font-size:0.8rem; color:#64748b; font-weight:600;">
                            <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:0.15rem;">${dateLabel}</div>
                            ${formatDate(dateVal)}
                        </td>
                        <td style="padding:1rem; text-align:right;">${actionsHtml}</td>
                    </tr>
                `;
            }).join('');

            tableContainer.innerHTML = `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="text-align:left; background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                                <th style="padding:0.75rem 1rem; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Invited User</th>
                                <th style="padding:0.75rem 1rem; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Designated Role</th>
                                <th style="padding:0.75rem 1rem; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Status</th>
                                <th style="padding:0.75rem 1rem; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Timeline</th>
                                <th style="padding:0.75rem 1rem; text-align:right; color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:800;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
            feather.replace();

            // Wire action buttons
            tableContainer.querySelectorAll('.resend-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    const id = btn.getAttribute('data-id');
                    btn.disabled = true;
                    btn.innerHTML = `<div class="spinner" style="width:12px; height:12px; border-width:1.5px;"></div>`;
                    try {
                        const r = await authFetch(API.INVITATION_RESEND(id), { method: 'POST' });
                        const resData = await r.json();
                        if (!r.ok) throw new Error(resData.error || 'Failed to resend invitation.');
                        window.showToast('Invitation resent successfully!', 'success');
                        loadInvitations();
                    } catch (err) {
                        window.showToast(err.message, 'error');
                        btn.disabled = false;
                        btn.innerHTML = `<i data-feather="refresh-cw" style="width:12px; height:12px;"></i> Resend`;
                        feather.replace();
                    }
                };
            });

            tableContainer.querySelectorAll('.cancel-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    if (!confirm('Are you sure you want to cancel this invitation?')) return;
                    const id = btn.getAttribute('data-id');
                    btn.disabled = true;
                    btn.innerHTML = `<div class="spinner" style="width:12px; height:12px; border-width:1.5px;"></div>`;
                    try {
                        const r = await authFetch(API.INVITATION_CANCEL(id), { method: 'POST' });
                        const resData = await r.json();
                        if (!r.ok) throw new Error(resData.error || 'Failed to cancel invitation.');
                        window.showToast('Invitation cancelled successfully!', 'success');
                        loadInvitations();
                    } catch (err) {
                        window.showToast(err.message, 'error');
                        btn.disabled = false;
                        btn.innerHTML = `<i data-feather="trash-2" style="width:12px; height:12px;"></i> Cancel`;
                        feather.replace();
                    }
                };
            });

        } catch (err) {
            tableContainer.innerHTML = `<div class="db-error-msg">Failed to load sent invitations: ${err.message}</div>`;
        }
    }

    // Handle Form Submit
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const role = roleSelect.value;

        if (!email) return;

        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<div class="spinner" style="width:16px; height:16px; border-color:white; border-top-color:transparent;"></div> Sending…`;

        try {
            const res = await authFetch(API.INVITATIONS, {
                method: 'POST',
                body: JSON.stringify({ email, role })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send invitation.');

            window.showToast('Invitation email sent successfully!', 'success');
            emailInput.value = '';
            loadInvitations();
        } catch (err) {
            window.showToast(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            feather.replace();
        }
    };

    // Load initial list
    loadInvitations();
}


