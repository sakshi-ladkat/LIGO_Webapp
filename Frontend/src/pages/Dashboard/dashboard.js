import { authFetch, getAccessToken, logout } from '../../utils/auth.js';
import { API } from '../../config/api.js';
import { openReviewModal } from './reviewModal.js';

// ── Module State ──────────────────────────────────────────────────────────────
let _me = {};
let _roles = [];
let _permSet = new Set();
let _meData = {};
let _myAppData = null;
let _servicesData = null;

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
    if (_meData.user) {
        _renderDashboardShell(app, startInProfile);
    } else {
        app.innerHTML = `<div class="db-shell"><div class="db-loading"><div class="spinner"></div></div></div>`;
    }

    try {
        const res = await authFetch(API.ME);
        if (!res.ok) throw new Error('Failed to load user');
        _meData = await res.json();
        _me = _meData.user || {};
        _roles = (_meData.roles || []).reduce((acc, curr) => acc.find(i => i.id === curr.id) ? acc : acc.concat([curr]), []);
        _permSet = new Set(_meData.permissions || []);
        _renderDashboardShell(app, startInProfile);
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function _renderDashboardShell(app, startInProfile) {
    const profile = _meData.profile || {};
    const reviewRoles = _roles.filter(r => REVIEW_ROLE_CONFIG[r.slug]);
    const isUserOnly = reviewRoles.length === 0;

    app.innerHTML = `<div class="db-shell">${buildSidebar(_me, profile, _roles, _meData.can_setup_ssh)}<div class="db-right" id="db-main-content"></div></div>`;
    const mainContent = app.querySelector('#db-main-content');

    const navDash = app.querySelector('#db-nav-dashboard');
    const navProf = app.querySelector('#db-nav-profile');
    const navSsh = app.querySelector('#db-nav-ssh');
    const navAdmin = app.querySelector('#db-nav-admin');

    function renderTabDashboard() {
        localStorage.setItem('db_active_tab', 'dashboard');
        [navDash, navProf, navSsh].forEach(n => n?.classList.remove('active'));
        navDash?.classList.add('active');
        if (isUserOnly) {
            mainContent.innerHTML = `<div id="tracker-body" class="db-tracker-card"><div class="db-loading-inline"><div class="spinner"></div></div></div>`;
            loadMyApplication(mainContent.querySelector('#tracker-body'));
        } else {
            // Centralized fetch for all review roles
            mainContent.innerHTML = `<div class="db-loading-inline"><div class="spinner"></div> Loading applications…</div>`;
            
            authFetch(API.APPLICATIONS).then(res => res.json()).then(allApps => {
                mainContent.innerHTML = reviewRoles.map(r => buildAccordion(r)).join('');
                reviewRoles.forEach(role => {
                    const accordion = document.getElementById(`accordion-${role.slug}`);
                    const roleApps = (allApps || []).filter(a => a.role_slug === role.slug);
                    renderRoleApplications(role.slug, roleApps);
                });

                // Wire accordion toggles
                app.querySelectorAll('.db-accordion-toggle').forEach(t => {
                    const p = t.closest('.db-accordion');
                    t.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        p.classList.toggle('open');
                    };
                });
            }).catch(err => {
                mainContent.innerHTML = `<div class="db-error-msg">Failed to load pending reviews.</div>`;
            });
        }
    }

    function renderTabProfile() {
        localStorage.setItem('db_active_tab', 'profile');
        [navDash, navProf, navSsh].forEach(n => n?.classList.remove('active'));
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
    }


    function renderTabSSH() {
        localStorage.setItem('db_active_tab', 'ssh');
        [navDash, navProf, navSsh].forEach(n => n?.classList.remove('active'));
        navSsh?.classList.add('active');
        mainContent.innerHTML = buildSshSetupHtml();
        _wireSshUpload(mainContent);
    }

    navDash?.addEventListener('click', renderTabDashboard);
    navProf?.addEventListener('click', renderTabProfile);
    navSsh?.addEventListener('click', renderTabSSH);
    navAdmin?.addEventListener('click', () => { window.location.hash = '#/admin'; });

    const savedTab = localStorage.getItem('db_active_tab') || 'dashboard';
    if (startInProfile || savedTab === 'profile') renderTabProfile();
    else if (savedTab === 'ssh' && navSsh) renderTabSSH();
    else renderTabDashboard();

    app.querySelector('#db-logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function buildSidebar(user, profile, roles, canSetupSsh = false) {
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'User';
    const initials = fullName.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
    const statusMap = { active: { label: 'Active', cls: 'sb-status--active' }, 'pending-approval': { label: 'Pending Approval', cls: 'sb-status--pending' }, rejected: { label: 'Rejected', cls: 'sb-status--rejected' } };
    const { label: statusLabel, cls: statusCls } = statusMap[user.status] || { label: user.status, cls: '' };
    const roleBadges = roles.map(r => `<span class="sb-role-badge">${escHtml(r.name)}</span>`).join('');

    return `<aside class="db-sidebar">
        <div class="sb-profile-hero">
            <div class="sb-avatar"><div class="sb-avatar-circle" style="background:linear-gradient(135deg,var(--primary-600) 0%,var(--primary-800) 100%);">${escHtml(initials)}</div></div>
            <div class="sb-hero-info"><h2 class="sb-name">${escHtml(fullName)}</h2><p class="sb-email">${escHtml(user.email)}</p><span class="sb-status ${statusCls}">${escHtml(statusLabel)}</span></div>
        </div>
        <div class="sb-section"><p class="sb-section-label">Roles</p><div class="sb-role-badges">${roleBadges}</div></div>
        <div class="sb-section sb-section--grow">
            <p class="sb-section-label">Navigation</p>
            <div class="sb-nav-list">
                <button class="sb-nav-btn" id="db-nav-dashboard"><i data-feather="grid"></i> Dashboard</button>
                ${roles.some(r => r.slug === 'super_admin') ? `<button class="sb-nav-btn" id="db-nav-admin"><i data-feather="shield"></i> Admin Panel</button>` : ''}
                ${canSetupSsh ? `<button class="sb-nav-btn" id="db-nav-ssh"><i data-feather="lock"></i> SSH Setup</button>` : ''}
                <button class="sb-nav-btn" id="db-nav-profile"><i data-feather="user"></i> My Profile</button>
            </div>
        </div>
        <div class="sb-footer"><button id="db-logout-btn" class="sb-logout-btn"><i data-feather="log-out"></i> Sign Out</button></div>
    </aside>`;
}

// ── Application Tracker ───────────────────────────────────────────────────────
async function loadMyApplication(container) {
    try {
        const [a, s] = await Promise.all([authFetch(API.MY_APPLICATION), _servicesData ? Promise.resolve({ ok: true, json: () => _servicesData }) : authFetch(API.REVIEW_SERVICES)]);
        if (a.ok) _myAppData = await a.json();
        if (s.ok && !_servicesData) _servicesData = await s.json();
        container.innerHTML = _myAppData ? buildTracker(_myAppData, _servicesData) : buildNoApplicationBanner();
        feather.replace();
    } catch (_) { container.innerHTML = `<div class="db-error-msg">Failed to load tracker.</div>`; }
}

function buildTracker(data, allServices) {
    const { application: appObj, steps = [] } = data;
    const isCompleted = ['approved', 'completed', 'approved_by_li_coordinator'].includes(appObj.status);
    const isRejected = appObj.status === 'rejected' || appObj.status === 'declined';

    const detailedItems = [
        { label: 'Application Submitted', state: 'completed', description: 'Submission record created.', date: appObj.submitted_at },
        ...steps.map(s => ({
            label: s.approved_at ? `Approved by ${s.role_name}` : (s.status_name.toLowerCase().startsWith('awaiting') ? s.status_name : `Awaiting ${s.status_name}`),
            state: s.approved_at ? 'completed' : (appObj.current_step_id === s.workflow_step_id ? (isRejected ? 'rejected' : 'active') : 'pending'),
            description: s.approved_at ? `By ${s.approved_by_name} on ${new Date(s.approved_at).toLocaleString()}` : 'Action required',
            services: s.recommended_services,
            remarks: s.comments
        }))
    ];
    if (isCompleted) {
        if (appObj.computing_services) {
            detailedItems.push({ 
                label: data.ssh_key ? 'SSH Key Registered' : 'SSH Key Required', 
                state: data.ssh_key ? 'completed' : 'active', 
                description: data.ssh_key ? `Fingerprint: ${data.ssh_key.fingerprint}` : 'Please upload your public key.' 
            });
        }
        detailedItems.push({ 
            label: data.user_data?.username ? 'Account Created (LDAP)' : 'Account Provisioning', 
            state: data.user_data?.username ? 'completed' : (data.ssh_key ? 'active' : 'pending'), 
            description: data.user_data?.username ? `Username: ${data.user_data.username}` : (data.ssh_key ? 'Setting up identity...' : 'Awaiting SSH key...') 
        });
    }
    detailedItems.push({ label: 'Account Activated', state: (isCompleted && data.user_data?.status === 'active') ? 'completed' : 'pending' });

    return `
        <div class="db-tracker-card">
            <div class="trk-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2.5rem;padding-bottom:1.5rem;border-bottom:1px solid #f1f5f9;">
                <div style="display:flex;align-items:center;gap:1rem;">
                    <div style="background:#f8fafc;width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#6366f1;"><i data-feather="clipboard"></i></div>
                    <div><h3 style="margin:0;font-size:1.4rem;font-weight:800;color:#0f172a;">Application Tracker</h3><p style="margin:0.2rem 0 0;color:#64748b;font-size:0.85rem;">Submitted on ${new Date(appObj.submitted_at).toLocaleDateString()}</p></div>
                </div>
                <div class="trk-overall-badge ${isCompleted ? 'trk-badge-done' : isRejected ? 'trk-badge-error' : 'trk-badge-active'}" style="padding:0.6rem 1.5rem;border-radius:99px;font-weight:800;font-size:0.8rem;letter-spacing:0.02em;box-shadow:0 2px 10px rgba(0,0,0,0.03);display:flex;align-items:center;gap:0.5rem;">
                    ${isCompleted ? '<i data-feather="check-circle" style="width:14px;height:14px;"></i> Account Activated' : isRejected ? '<i data-feather="x-circle" style="width:14px;height:14px;"></i> Declined' : `<i data-feather="clock" style="width:14px;height:14px;"></i> ${detailedItems.find(it => it.state === 'active')?.label || 'In Progress'}`}
                </div>
            </div>
            <div class="trk-timeline-container" style="position:relative;padding-left:10px;">
                <div class="trk-timeline-line"></div>
                <div class="trk-timeline-steps">${detailedItems.map((it, i) => buildTimelineStep(it, i)).join('')}</div>
            </div>
        </div>`;
}

function buildTimelineStep(it, i) {
    const isActive = it.state === 'active';
    const isCompleted = it.state === 'completed';
    return `<div class="trk-step trk-step--${it.state} ${isActive ? 'open' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="trk-marker">
            ${isCompleted ? '<i data-feather="check"></i>' : ''}
            ${isActive ? `<div class="trk-marker-active"><div class="trk-marker-pulse"></div></div>` : ''}
        </div>
        <div class="trk-content-card">
            <button class="trk-step-header-btn" onclick="this.closest('.trk-step').classList.toggle('open')">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <h4 class="trk-step-header-title">${escHtml(it.label)}</h4>
                    ${isActive ? `<span class="trk-badge-active-mini"><i data-feather="clock" style="width:10px;height:10px;margin-right:4px;"></i>In Progress</span>` : ''}
                </div>
                <i data-feather="chevron-down" class="trk-step-chevron"></i>
            </button>
            <div class="trk-step-body">
                <div style="font-size:0.9rem;color:#475569;margin-bottom:1rem;">${escHtml(it.description || '')}</div>
                ${it.services ? `<div style="margin-bottom:1rem;padding:0.75rem;background:#f0f4ff;border-radius:8px;border-left:4px solid #6366f1;"><strong style="font-size:0.7rem;color:#6366f1;text-transform:uppercase;">Services:</strong><div style="font-weight:700;">${escHtml(it.services)}</div></div>` : ''}
                ${it.remarks ? `<div style="padding:0.75rem;background:#f8fafc;border-radius:8px;font-style:italic;color:#64748b;font-size:0.85rem;">"${escHtml(it.remarks)}"</div>` : ''}
            </div>
        </div>
    </div>`;
}



function _internalRenderProfile(appData, allServices) {
    const p       = _meData.profile        || {};
    const quals   = (_meData.qualifications || []).sort((a,b)=>{
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return  1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    const contact = _meData.contact        || {};
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
                    ${sbField('Salutation','title',p.title)}
                    ${sbField('First Name','first_name',p.first_name)}
                    ${sbField('Middle Name','middle_name',p.middle_name)}
                    ${sbField('Last Name','last_name',p.last_name)}
                    ${sbField('Date of Birth','date_of_birth',p.date_of_birth?p.date_of_birth.split('T')[0]:''  ,'date', true)}
                    ${sbSelect('Gender','gender',p.gender,[{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'},{value:'prefer-not-to-say',label:'Prefer not to say'}])}
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
                    ${sbField('Highest Degree','highest_qualification','')}
                    ${sbField('Field of Study','field_of_study','')}
                    ${sbField('University / Institute','university','')}
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        ${sbMonthSelect('Graduation Month','graduation_month','')}
                        ${sbField('Graduation Year','graduation_year','','number', (new Date().getFullYear() - 70), '2100')}
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
            <div class="sb-view-mode" style="display:grid;grid-template-columns:1fr 2fr;gap:1.5rem;">
                <div class="sb-view-row"><span class="sb-view-label">Phone</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;font-size:1.1rem;">${escHtml(c.phone_number || '—')}</span></div>
                <div class="sb-view-row" style="grid-column:span 1;"><span class="sb-view-label">Address</span><span class="sb-view-value" style="line-height:1.5;color:#1e293b;font-weight:600;">${escHtml(addressStr)}</span></div>
            </div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1.25rem;background:#f8fafc;padding:1.5rem;border-radius:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    ${sbField('Phone','phone_number',c.phone_number,'tel')}
                    ${sbField('Address Line 1','address_line_1',c.address_line_1)}
                    ${sbField('Address Line 2','address_line_2',c.address_line_2)}
                    ${sbField('City','city',c.city)}
                    ${sbField('State / Province','state',c.state)}
                    ${sbField('Postcode','postal_code',c.postal_code)}
                    ${sbField('Country','country_name',c.country_name)}
                </div>
                <div class="sb-form-actions">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:#e2e8f0;border:none;color:#475569;padding:0.6rem 1.2rem;border-radius:0.5rem;font-weight:600;">Cancel</button>
                    <button id="sb-save-contact" class="sb-btn-save" style="background:#4f46e5;color:white;border:none;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;">Save Address</button>
                </div>
            </div>
        </div>`;
}

function sbField(label, name, value, type = 'text', min = '', max = '') {
    const disabled = false; // logic simplified for now
    const disabledAttr = disabled ? 'disabled' : '';
    const bg  = disabled ? '#f1f5f9' : '#ffffff';
    const col = disabled ? '#94a3b8' : '#0f172a';
    const cur = disabled ? 'cursor:not-allowed;' : '';
    return `
        <div class="sb-field" style="margin-bottom:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label class="sb-field-label" style="color:#64748b;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.025em;margin-left:0.25rem;">${escHtml(label)}</label>
            <input class="sb-field-input" style="background:${bg};border:1.5px solid #e2e8f0;color:${col};${cur}padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.95rem;transition:all 0.2s;font-weight:500;" type="${type}" name="${name}" value="${escHtml(value ?? '')}" ${disabledAttr} placeholder="${escHtml(label)}…">
        </div>`;
}

function sbSelect(label, name, current, options) {
    const opts = options.map(o => `<option value="${o.value}" ${String(current)===String(o.value)?'selected':''}>${o.label}</option>`).join('');
    return `
        <div class="sb-field" style="margin-bottom:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label class="sb-field-label" style="color:#64748b;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.025em;margin-left:0.25rem;">${escHtml(label)}</label>
            <select class="sb-field-input" style="background:#ffffff;border:1.5px solid #e2e8f0;color:#0f172a;padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.95rem;transition:all 0.2s;font-weight:500;" name="${name}">${opts}</select>
        </div>`;
}

function sbMonthSelect(label, name, current) {
    const months = [
        {value:1, label:'January'}, {value:2, label:'February'}, {value:3, label:'March'},
        {value:4, label:'April'}, {value:5, label:'May'}, {value:6, label:'June'},
        {value:7, label:'July'}, {value:8, label:'August'}, {value:9, label:'September'},
        {value:10, label:'October'}, {value:11, label:'November'}, {value:12, label:'December'}
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
            const editBtn  = wrapper?.querySelector('.sb-btn-edit');
            if (viewMode && formMode) {
                formMode.style.display = 'none';
                viewMode.style.display = '';
                if (editBtn) editBtn.style.display = '';
            }
        });
    });

    _wireSave(app, 'sb-save-personal', ['title','first_name','middle_name','last_name','date_of_birth','gender'], API.PROFILE_UPDATE, 'PATCH');
    _wireSave(app, 'sb-save-qual',     ['highest_qualification','field_of_study','university','graduation_year', 'graduation_month'], API.QUALIFICATION_ADD, 'POST');
    _wireSave(app, 'sb-save-contact',  ['phone_number','address_line_1','address_line_2','city','state','postal_code','country_name'], API.PROFILE_UPDATE, 'PATCH');
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
            const res  = await authFetch(url, { method, body: JSON.stringify(payload) });
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
    const roleLabel = escHtml(r.name || r.slug);
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
                            _roles.filter(r => REVIEW_ROLE_CONFIG[r.slug]).forEach(role => {
                                const roleApps = (freshApps || []).filter(a => a.role_slug === role.slug);
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

function _wireSshUpload(container) {
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
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering…';
            if (feedback) feedback.style.display = 'none';

            try {
                const res = await authFetch(API.SSH_KEY_STORE, {
                    method: 'POST',
                    body: JSON.stringify({ public_key: content })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to upload key.');

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
        reader.readAsText(selectedFile);
    };

    feather.replace();
}
