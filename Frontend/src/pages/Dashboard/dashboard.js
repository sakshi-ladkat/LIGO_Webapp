import { authFetch, getAccessToken, logout } from '../../utils/auth.js';
import { API } from '../../config/api.js';
import { openReviewModal } from './reviewModal.js';

// ── Permission helpers ────────────────────────────────────────────────────────
let _me = {};
let _roles = [];
let _permSet = new Set();
let _meData = {};   // full /me response cached

export function hasPermission(slug) { return _permSet.has(slug); }
export function hasRole(...slugs) { return _roles.some(r => slugs.includes(r.slug)); }

// Roles that get an accordion review panel
const REVIEW_ROLE_SLUGS = new Set([
    'super_admin', 'pet_lead', 'li_coordinator', 'system_lead', 'subsystem_lead',
    'supervisor',
]);

// ── Entry point ───────────────────────────────────────────────────────────────
export async function renderDashboard(app, startInProfile = false) {
    app.innerHTML = `
        <div class="db-shell">
            <div class="db-loading"><div class="spinner"></div></div>
        </div>`;

    try {
        const token = getAccessToken();
        const res = await authFetch(API.ME, {
            headers: token ? {
                'Authorization': `Bearer ${token}`,
                'X-Access-Token': token,
            } : {},
        });
        if (!res.ok) throw new Error('Failed to load user');
        _meData = await res.json();
    } catch (_) {
        app.innerHTML = `<div style="padding:2rem;color:var(--error);">Session error – please <a href="#/login">log in again</a>.</div>`;
        return;
    }

    _me = _meData.user || {};
    _roles = _meData.roles || [];
    _permSet = new Set(_meData.permissions || []);
    const profile = _meData.profile || {};
    const qualifications = _meData.qualifications || [];
    const contact = _meData.contact || {};

    // ── Cache roles for router + header ──────────────────────────────────
    localStorage.setItem('user_roles', JSON.stringify(_roles.map(r => r.slug)));

    // Super admin goes straight to the admin panel
    if (_roles.some(r => r.slug === 'super_admin')) {
        window.location.hash = '#/admin';
        return;
    }

    // Sort qualifications: active first, then newest first
    qualifications.sort((a, b) => {
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    const reviewRoles = _roles.filter(r => REVIEW_ROLE_SLUGS.has(r.slug));
    const isUserOnly = reviewRoles.length === 0;

    app.innerHTML = `
        <div class="db-shell">
            ${buildSidebar(_me, profile, _roles)}
            <div class="db-right" id="db-main-content"></div>
        </div>`;

    const mainContent = app.querySelector('#db-main-content');
    const navDash = app.querySelector('#db-nav-dashboard');

    function renderTabDashboard() {
        if (navDash) navDash.classList.add('active');

        if (isUserOnly) {
            mainContent.innerHTML = `<div class="db-tracker-card" id="tracker-body"><div class="db-loading-inline"><div class="spinner"></div></div></div>`;
            loadMyApplication(mainContent.querySelector('#tracker-body'));
        } else {
            mainContent.innerHTML = reviewRoles.map(r => buildAccordion(r)).join('');
            app.querySelectorAll('.db-accordion-toggle').forEach(toggle => {
                const panel = toggle.closest('.db-accordion');
                loadRoleApplications(toggle.dataset.roleSlug, panel);
                toggle.addEventListener('click', () => panel.classList.toggle('open'));
            });
        }
    }

    function renderTabProfile() {
        if (navDash) navDash.classList.remove('active');

        mainContent.innerHTML = `
            <div class="db-tracker-card" style="margin-bottom:1.5rem; padding: 1.5rem 2rem;">
                <h3 style="margin-bottom:0.5rem; font-size:1.15rem; color:#0f172a;">Personal Info</h3>
                ${buildPersonalPanel(profile)}
            </div>
            <div class="db-tracker-card" style="margin-bottom:1.5rem; padding: 1.5rem 2rem;">
                <h3 style="margin-bottom:0.5rem; font-size:1.15rem; color:#0f172a;">Qualification History</h3>
                ${buildQualPanel(qualifications)}
            </div>
            <div class="db-tracker-card" style="padding: 1.5rem 2rem;">
                <h3 style="margin-bottom:0.5rem; font-size:1.15rem; color:#0f172a;">Contact Info</h3>
                ${buildContactPanel(contact)}
            </div>
        `;
        _wireProfileForms(app);
    }

    // Default load
    if (startInProfile) {
        renderTabProfile();
    } else {
        renderTabDashboard();
    }

    // Setup nav listeners
    if (navDash) navDash.addEventListener('click', () => {
        // Only render if not already active to avoid unneeded API calls
        if (!navDash.classList.contains('active')) renderTabDashboard();
    });

    app.querySelector('#db-logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function buildSidebar(user, profile, roles) {
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || user.email || 'User';
    const initials = fullName.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
    const email = user.email || '—';
    const status = user.status || 'unknown';

    const statusMap = {
        active: { label: 'Active', cls: 'sb-status--active' },
        'pending-approval': { label: 'Pending Approval', cls: 'sb-status--pending' },
        onboarding: { label: 'Onboarding', cls: 'sb-status--info' },
        rejected: { label: 'Rejected', cls: 'sb-status--rejected' },
    };
    const { label: statusLabel, cls: statusCls } = statusMap[status] || { label: status, cls: '' };

    const roleBadges = roles.length
        ? roles.map(r => `<span class="sb-role-badge">${escHtml(r.name)}</span>`).join('')
        : `<span class="sb-role-badge sb-role-badge--empty">No roles assigned</span>`;

    return `
        <aside class="db-sidebar">

            <!-- ── Hero ── -->
            <div class="sb-hero">
                <div class="sb-avatar">${escHtml(initials)}</div>
                <h2 class="sb-name">${escHtml(fullName)}</h2>
                <p class="sb-email">${escHtml(email)}</p>
                <span class="sb-status ${statusCls}">${escHtml(statusLabel)}</span>
            </div>

            <!-- ── Roles ── -->
            ${(roles.length === 1 && roles[0].slug === 'user') ? '' : `
            <div class="sb-section">
                <p class="sb-section-label">Roles</p>
                <div class="sb-role-badges">${roleBadges}</div>
            </div>
            `}

            <!-- ── Navigation ── -->
            <div class="sb-section sb-section--grow">
                <p class="sb-section-label">Navigation</p>
                <div class="sb-nav-list">
                    <button class="sb-nav-btn active" id="db-nav-dashboard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        Dashboard
                    </button>
                </div>
            </div>

            <!-- ── Sign out ── -->
            <div class="sb-footer">
                <button id="db-logout-btn" class="sb-logout-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                </button>
            </div>
        </aside>`;
}

// ── Wire sidebar accordion toggles + inject panel content ────────────────────
// ── Wire profile form behaviors ────────────────────────────────────────────────
function _wireProfileForms(app) {
    // Wire View/Edit mode toggles
    app.querySelectorAll('.sb-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.db-tracker-card');
            const viewMode = wrapper.querySelector('.sb-view-mode');
            const formMode = wrapper.querySelector('.sb-panel-form');
            if (viewMode && formMode) {
                viewMode.style.display = 'none';
                formMode.style.display = 'flex';
                btn.style.display = 'none';
            }
        });
    });

    // Wire Cancel edit toggles
    app.querySelectorAll('.sb-btn-cancel-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.db-tracker-card');
            const viewMode = wrapper.querySelector('.sb-view-mode');
            const formMode = wrapper.querySelector('.sb-panel-form');
            const editBtn = wrapper.querySelector('.sb-btn-edit');
            if (viewMode && formMode) {
                formMode.style.display = 'none';
                viewMode.style.display = 'flex';
                if (editBtn) editBtn.style.display = '';
            }
        });
    });

    // Wire save buttons
    _wireSave(app, 'sb-save-personal', ['title', 'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender'], API.PROFILE_UPDATE, 'PATCH');
    _wireSave(app, 'sb-save-qual', ['highest_qualification', 'field_of_study', 'university', 'graduation_year'], API.QUALIFICATION_ADD, 'POST');
    _wireSave(app, 'sb-save-contact', ['phone_number', 'city', 'state', 'postal_code', 'country_name', 'address_line_1', 'address_line_2'], API.PROFILE_UPDATE, 'PATCH');
}

function _wireSave(app, btnId, fields, url, method) {
    const btn = app.querySelector(`#${btnId}`);
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const original = btn.textContent;
        btn.textContent = 'Saving…';
        btn.disabled = true;

        const payload = {};
        fields.forEach(f => {
            const el = btn.closest('.sb-panel-form')?.querySelector(`[name="${f}"]`);
            if (el) payload[f] = el.value;
        });

        const fb = btn.closest('.sb-panel-form')?.querySelector('.sb-save-feedback');

        try {
            const res = await authFetch(url, { method: method, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(Object.values(data.errors || {}).flat().join(' ') || data.message || 'Error');
            if (fb) { fb.textContent = '✓ Saved'; fb.className = 'sb-save-feedback sb-save-feedback--ok'; }

            // Reload dashboard cleanly to show updated view modes
            setTimeout(() => {
                const dbApp = document.getElementById('app');
                // By triggering renderDashboard again, it'll fetch newer data and recreate the dashboard
                if (dbApp) {
                    renderDashboard(dbApp).then(() => {
                        // Immediately pop the profile tab back open since that's where they were
                        const navProfile = dbApp.querySelector('#db-nav-profile');
                        if (navProfile) navProfile.click();
                    });
                }
            }, 800);

        } catch (err) {
            if (fb) { fb.textContent = err.message; fb.className = 'sb-save-feedback sb-save-feedback--err'; }
        } finally {
            btn.textContent = original;
            btn.disabled = false;
            if (fb) setTimeout(() => { fb.textContent = ''; fb.className = 'sb-save-feedback'; }, 3000);
        }
    });
}

// ── Panel builders ────────────────────────────────────────────────────────────
function buildPersonalPanel(p) {
    const fullName = [p.title, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || 'Not provided';
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
                <span class="sb-panel-title" style="color: #64748b;">Current Details</span>
                <button type="button" class="sb-btn-edit" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">Edit</button>
            </div>
            
            <div class="sb-view-mode" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="sb-view-row"><span class="sb-view-label" style="color:#94a3b8;">Full Name</span><span class="sb-view-value" style="color:#334155;">${escHtml(fullName)}</span></div>
                <div class="sb-view-row"><span class="sb-view-label" style="color:#94a3b8;">DOB</span><span class="sb-view-value" style="color:#334155;">${escHtml(p.date_of_birth ? p.date_of_birth.split('T')[0] : '—')}</span></div>
                <div class="sb-view-row"><span class="sb-view-label" style="color:#94a3b8;">Gender</span><span class="sb-view-value" style="color:#334155; text-transform: capitalize;">${escHtml(p.gender || '—')}</span></div>
            </div>

            <div class="sb-panel-form" style="display:none; padding: 0;">
                ${sbField('Title', 'title', p.title, 'text')}
                ${sbField('First Name', 'first_name', p.first_name, 'text')}
                ${sbField('Middle Name', 'middle_name', p.middle_name, 'text')}
                ${sbField('Last Name', 'last_name', p.last_name, 'text')}
                ${sbField('Date of Birth', 'date_of_birth', p.date_of_birth ? p.date_of_birth.split('T')[0] : '', 'date', true)}
                ${sbSelect('Gender', 'gender', p.gender, [
        { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
        { value: 'other', label: 'Other' }, { value: 'prefer-not-to-say', label: 'Prefer not to say' }
    ])}
                <div class="sb-form-actions">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:transparent; border:none; color: #64748b;">Cancel</button>
                    <button id="sb-save-personal" class="sb-btn-save" style="background-color: var(--primary-600); border-color: var(--primary-700);">Save Changes</button>
                </div>
            </div>
        </div>`;
}

function buildQualPanel(quals) {
    const activeQ = quals.find(q => q.is_active) || {};

    let historyHtml = '';
    if (quals.length > 0) {
        historyHtml = quals.map(q => `
            <div class="sb-history-item ${q.is_active ? 'sb-history-item--active' : ''}" style="background: #f8fafc; border: 1px solid ${q.is_active ? '#cbd5e1' : '#e2e8f0'};">
                ${q.is_active ? '<span class="sb-history-badge">Active</span>' : ''}
                <div class="sb-view-row" style="margin-bottom:0.25rem;"><span class="sb-view-value" style="font-weight:600; color:#0f172a;">${escHtml(q.highest_qualification)}</span></div>
                <div class="sb-view-row"><span class="sb-view-label" style="color:#64748b;">${escHtml(q.field_of_study)}</span></div>
                <div class="sb-view-row" style="flex-direction:row; justify-content:space-between; margin-top:0.4rem;">
                    <span class="sb-view-value" style="font-size:0.75rem; color:#64748b;">${escHtml(q.university)}</span>
                    <span class="sb-view-value" style="font-size:0.75rem; color:#64748b;">${escHtml(q.graduation_year)}</span>
                </div>
            </div>
        `).join('');
    } else {
        historyHtml = '<div class="sb-view-value" style="color: #94a3b8; font-style:italic;">No qualifications added.</div>';
    }

    return `
        <div>
            <div class="sb-header-action" style="padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
                <span class="sb-panel-title" style="color: #64748b;">History</span>
                <button type="button" class="sb-btn-edit" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">+ Add New</button>
            </div>
            
            <div class="sb-view-mode">
                ${historyHtml}
            </div>

            <div class="sb-panel-form" style="display:none; padding: 0;">
                <div style="font-size:0.8rem; color:#64748b; margin-bottom:1rem; padding:0.75rem; background:#f8fafc; border-radius:0.5rem; text-align:center;">
                    Adding a new qualification will make it the active one.
                </div>
                ${sbField('Highest Degree', 'highest_qualification', '', 'text')}
                ${sbField('Field of Study', 'field_of_study', '', 'text')}
                ${sbField('University', 'university', '', 'text')}
                ${sbField('Graduation Year', 'graduation_year', '', 'number')}
                <div class="sb-form-actions">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:transparent; border:none; color: #64748b;">Cancel</button>
                    <button id="sb-save-qual" class="sb-btn-save" style="background-color: var(--primary-600); border-color: var(--primary-700);">Submit Addition</button>
                </div>
            </div>
        </div>`;
}

function buildContactPanel(c) {
    const addressStr = [c.address_line_1, c.address_line_2, c.city, c.state, c.country_name, c.postal_code].filter(Boolean).join(', ') || '—';
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom: 1rem; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
                <span class="sb-panel-title" style="color: #64748b;">Current Details</span>
                <button type="button" class="sb-btn-edit" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">Edit</button>
            </div>
            
            <div class="sb-view-mode" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="sb-view-row"><span class="sb-view-label" style="color:#94a3b8;">Phone</span><span class="sb-view-value" style="color:#334155;">${escHtml(c.phone_number || '—')}</span></div>
                <div class="sb-view-row"><span class="sb-view-label" style="color:#94a3b8;">Address</span><span class="sb-view-value" style="color:#334155; line-height:1.4;">${escHtml(addressStr)}</span></div>
            </div>

            <div class="sb-panel-form" style="display:none; padding: 0;">
                ${sbField('Phone', 'phone_number', c?.phone_number, 'tel')}
                ${sbField('Address', 'address_line_1', c?.address_line_1, 'text')}
                ${sbField('Address 2', 'address_line_2', c?.address_line_2, 'text')}
                ${sbField('City', 'city', c?.city, 'text')}
                ${sbField('State', 'state', c?.state, 'text')}
                ${sbField('Postcode', 'postal_code', c?.postal_code, 'text')}
                ${sbField('Country', 'country_name', c?.country_name, 'text')}
                <div class="sb-form-actions">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:transparent; border:none; color: #64748b;">Cancel</button>
                    <button id="sb-save-contact" class="sb-btn-save" style="background-color: var(--primary-600); border-color: var(--primary-700);">Save Changes</button>
                </div>
            </div>
        </div>`;
}

function sbField(label, name, value, type = 'text', disabled = false) {
    const disabledAttr = disabled ? 'disabled' : '';
    const bgColor = disabled ? '#f8fafc' : 'white';
    const textCol = disabled ? '#94a3b8' : '#0f172a';
    const cursorStyle = disabled ? 'cursor: not-allowed;' : '';
    return `
        <div class="sb-field" style="margin-bottom: 0.5rem;">
            <label class="sb-field-label" style="color: #64748b;">${escHtml(label)}</label>
            <input class="sb-field-input" style="background: ${bgColor}; border: 1px solid #cbd5e1; color: ${textCol}; ${cursorStyle}" type="${type}" name="${name}" value="${escHtml(value ?? '')}" ${disabledAttr}>
        </div>`;
}

function sbSelect(label, name, current, options) {
    const opts = options.map(o =>
        `<option value="${o.value}" ${current === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');
    return `
        <div class="sb-field" style="margin-bottom: 0.5rem;">
            <label class="sb-field-label" style="color: #64748b;">${escHtml(label)}</label>
            <select class="sb-field-input" style="background: white; border: 1px solid #cbd5e1; color: #0f172a;" name="${name}">${opts}</select>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT COLUMN: Tracker
// ─────────────────────────────────────────────────────────────────────────────
async function loadMyApplication(container) {
    if (!container) return;
    try {
        const res = await authFetch(API.MY_APPLICATION);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        container.innerHTML = data ? buildTracker(data) : buildNoApplicationBanner();
    } catch (err) {
        container.innerHTML = `<div class="db-error-msg">Could not load application status: ${escHtml(err.message)}</div>`;
    }
}

function buildTracker(data) {
    const { application: appObj, steps = [] } = data || {};
    if (!appObj) return buildNoApplicationBanner();

    const currentStepNo = appObj.current_step_no ?? null;
    const isCompleted = appObj.current_step_id === null;

    const stepItems = [
        {
            label: 'Application Submitted',
            state: 'completed',
        },
        ...steps.map((s) => {
            let state;
            if (isCompleted) state = 'completed';
            else if (s.step_no < currentStepNo) state = 'completed';
            else if (s.step_no === currentStepNo) state = 'active';
            else state = 'pending';

            let stepLabel = escHtml(s.status_name || `Step ${s.step_no}`);
            let stepDesc = ''; // Remove default subtitle

            if (state === 'completed') {
                stepLabel = 'Approved';
                if (s.approved_by_name) {
                    let dateStr = '';
                    if (s.approved_at) {
                        const d = new Date(s.approved_at);
                        const options = { day: '2-digit', month: 'short', year: 'numeric' };
                        dateStr = ` on ${d.toLocaleDateString('en-GB', options)}`;
                    }
                    stepDesc = `Approved by: ${escHtml(s.approved_by_name)}${dateStr}`;
                }
            }
            return { label: stepLabel, description: stepDesc, state };
        }),
        {
            label: 'Account Activated',
            state: isCompleted ? 'completed' : 'pending',
        },
    ];

    const submittedDate = appObj.submitted_at
        ? new Date(appObj.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    const overallState = isCompleted ? '✅ Account Activated' : `⏳ ${escHtml(appObj.current_status || 'Under Review')}`;

    return `
        <div class="trk-header">
            <div class="trk-header-icon">📋</div>
            <div class="trk-header-meta">
                <h3 class="trk-title">Application Status Tracker</h3>
                <p class="trk-subtitle">${escHtml(appObj.workflow_name || 'Onboarding Workflow')} · Submitted ${submittedDate}</p>
            </div>
            <span class="trk-overall-badge ${isCompleted ? 'trk-badge-done' : 'trk-badge-active'}">${overallState}</span>
        </div>
        <div class="trk-timeline">
            ${stepItems.map((item, i) => buildTimelineStep(item, i)).join('')}
        </div>`;
}

function buildTimelineStep({ label, description, state }, index) {
    const delay = `animation-delay:${index * 0.08}s`;
    let iconHtml = '';
    if (state === 'completed') iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    else if (state === 'active') iconHtml = `<span class="trk-pulse"></span>`;

    return `
        <div class="trk-step trk-step--${state}" style="${delay}">
            <div class="trk-marker">${iconHtml}</div>
            <div class="trk-content">
                <h4 class="trk-step-label">
                    ${label}
                    ${state === 'active' ? '<span class="trk-in-progress-pill">In Progress</span>' : ''}
                </h4>
                ${description ? `<p class="trk-step-desc">${description}</p>` : ''}
            </div>
        </div>`;
}

function buildNoApplicationBanner() {
    return `
        <div class="db-empty-banner">
            <div class="db-empty-icon">📬</div>
            <h3>No application found</h3>
            <p>Your registration has not been submitted yet, or is still being processed.</p>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT COLUMN: Reviewer Accordion
// ─────────────────────────────────────────────────────────────────────────────
function buildAccordion(role) {
    const roleLabel = escHtml(role.name || role.slug);
    return `
        <div class="db-accordion" id="accordion-${role.slug}">
            <button class="db-accordion-toggle" data-role-slug="${role.slug}">
                <span class="db-accordion-icon">▶</span>
                <span>${roleLabel} — Pending Reviews</span>
                <span class="db-accordion-badge" id="badge-${role.slug}"></span>
            </button>
            <div class="db-accordion-body">
                <div class="db-table-wrap" id="table-${role.slug}">
                    <div class="db-loading-inline"><div class="spinner"></div></div>
                </div>
            </div>
        </div>`;
}

async function loadRoleApplications(roleSlug, accordionEl) {
    const wrap = accordionEl.querySelector(`#table-${roleSlug}`);
    if (!wrap) return;
    wrap.innerHTML = `<div class="db-loading-inline"><div class="spinner"></div></div>`;

    try {
        const res = await authFetch(`${API.APPLICATIONS}?role_slug=${encodeURIComponent(roleSlug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const apps = await res.json();

        const badge = accordionEl.querySelector(`#badge-${roleSlug}`);
        if (badge) badge.textContent = apps.length > 0 ? apps.length : '';

        if (apps.length === 0) { wrap.innerHTML = buildEmptyTable(); return; }

        wrap.innerHTML = buildApplicationsTable(apps);
        wrap.querySelectorAll('.db-review-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const appId = parseInt(btn.dataset.appId, 10);
                const appData = apps.find(a => a.id === appId);
                if (!appData) return;
                openReviewModal(appData, () => loadRoleApplications(roleSlug, accordionEl));
            });
        });

    } catch (err) {
        wrap.innerHTML = `<div class="db-error-msg">Failed to load applications: ${escHtml(err.message)}</div>`;
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
            <td>
                <button class="btn db-review-btn" data-app-id="${a.id}">Review</button>
            </td>
        </tr>`).join('');

    return `
        <table class="db-table">
            <thead>
                <tr>
                    <th>Applicant</th><th>Request</th><th>Workflow</th>
                    <th>Current Status</th><th>Required Action</th><th>Submitted</th><th>Action</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function buildEmptyTable() {
    return `
        <div class="db-empty-table">
            <span class="db-empty-table-icon">✅</span>
            <p>No pending applications for this role.</p>
        </div>`;
}

// ── XSS guard ─────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
