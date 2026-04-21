import { authFetch, logout } from '../../utils/auth.js';
import { API } from '../../config/api.js';
import { openReviewModal } from './reviewModal.js';

// ── Permission helpers ────────────────────────────────────────────────────────
let _me      = {};
let _roles   = [];
let _permSet = new Set();

export function hasPermission(slug) { return _permSet.has(slug); }
export function hasRole(...slugs)    { return _roles.some(r => slugs.includes(r.slug)); }

// Roles that get an accordion review panel
const REVIEW_ROLE_SLUGS = new Set([
    'super_admin', 'pet_lead', 'li_coordinator', 'system_lead', 'subsystem_lead',
]);

// ── Entry point ───────────────────────────────────────────────────────────────
export async function renderDashboard(app) {
    app.innerHTML = `
        <div class="db-shell">
            <div class="db-loading">
                <div class="spinner"></div>
            </div>
        </div>`;

    let meData;
    try {
        const res = await authFetch(API.ME);
        if (!res.ok) throw new Error('Failed to load user');
        meData = await res.json();
    } catch (err) {
        app.innerHTML = `<div style="padding:2rem;color:var(--error);">Session error – please <a href="#/login">log in again</a>.</div>`;
        return;
    }

    // Populate globals
    _me      = meData.user    || {};
    _roles   = meData.roles   || [];
    _permSet = new Set(meData.permissions || []);
    const profile = meData.profile || {};

    // Identify review roles the user holds
    const reviewRoles = _roles.filter(r => REVIEW_ROLE_SLUGS.has(r.slug));

    // ── Decide which right-column to show ─────────────────────────────────────
    // If the user has NO reviewer roles → show application tracker (user view)
    const isUserOnly = reviewRoles.length === 0;

    app.innerHTML = `
        <div class="db-shell">
            ${buildProfileCard(_me, profile, _roles)}
            <div class="db-right">
                ${isUserOnly
                    ? buildTrackerSkeleton()
                    : reviewRoles.map(r => buildAccordion(r)).join('')}
            </div>
        </div>`;

    // Wire accordion toggles (reviewer view)
    if (!isUserOnly) {
        app.querySelectorAll('.db-accordion-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const panel  = toggle.closest('.db-accordion');
                const isOpen = panel.classList.toggle('open');
                const slug   = toggle.dataset.roleSlug;
                if (isOpen) loadRoleApplications(slug, panel);
            });
        });
    } else {
        // Load real application status
        loadMyApplication(app.querySelector('#tracker-body'));
    }

    // Wire logout
    app.querySelector('#db-logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// ── Profile card (left column) ────────────────────────────────────────────────
function buildProfileCard(user, profile, roles) {
    const firstName = profile.first_name || '';
    const lastName  = profile.last_name  || '';
    const fullName  = [firstName, lastName].filter(Boolean).join(' ') || user.email || 'User';
    const initials  = fullName.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
    const email     = user.email || '—';
    const status    = user.status || 'unknown';

    const statusColour = {
        active:             'var(--success)',
        'pending-approval': 'var(--warning)',
        onboarding:         'var(--info)',
        rejected:           'var(--error)',
    }[status] || 'var(--gray-400)';

    const roleBadges = roles.length
        ? roles.map(r => `<span class="db-role-badge">${escHtml(r.name)}</span>`).join('')
        : '<span class="db-role-badge" style="background:var(--gray-100);color:var(--gray-500);">No roles assigned</span>';

    return `
        <aside class="db-profile-card">
            <div class="db-avatar">${initials}</div>
            <h2 class="db-profile-name">${escHtml(fullName)}</h2>
            <p class="db-profile-email">${escHtml(email)}</p>
            <div class="db-status-badge" style="--status-color:${statusColour};">
                <span class="db-status-dot"></span>
                ${escHtml(status.replace(/-/g, ' '))}
            </div>
            <div class="db-roles-section">
                <p class="db-section-label">Roles</p>
                <div class="db-role-badges">${roleBadges}</div>
            </div>
            <button id="db-logout-btn" class="btn btn-outline db-logout-btn">Sign out</button>
        </aside>`;
}

// ── Tracker skeleton (user-only view) ─────────────────────────────────────────
function buildTrackerSkeleton() {
    return `
        <div class="db-tracker-card" id="tracker-body">
            <div class="db-loading-inline"><div class="spinner"></div></div>
        </div>`;
}

// ── Fetch and render the application timeline ─────────────────────────────────
async function loadMyApplication(container) {
    if (!container) return;

    try {
        const res  = await authFetch(API.MY_APPLICATION);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data) {
            container.innerHTML = buildNoApplicationBanner();
            return;
        }

        container.innerHTML = buildTracker(data);

    } catch (err) {
        container.innerHTML = `<div class="db-error-msg">Could not load application status: ${escHtml(err.message)}</div>`;
    }
}

// ── Build the full tracker card ────────────────────────────────────────────────
function buildTracker(data) {
    const { application: appObj, steps = [] } = data || {};

    if (!appObj) {
        return buildNoApplicationBanner();
    }

    // Determine step states
    const currentStepNo = appObj.current_step_no ?? null;
    const isCompleted   = appObj.current_step_id === null;

    // ── "Submitted" step is always first and always completed ──
    const stepItems = [
        {
            label:       'Application Submitted',
            description: `Your ${escHtml(appObj.request_name || 'registration')} application was received and entered the ${escHtml(appObj.workflow_name || '')} workflow.`,
            state:       'completed',
        },
        ...steps.map((s) => {
            let state;
            if (isCompleted) {
                state = 'completed';                       // all steps done
            } else if (s.step_no < currentStepNo) {
                state = 'completed';                       // already passed
            } else if (s.step_no === currentStepNo) {
                state = 'active';                          // currently here
            } else {
                state = 'pending';                         // not yet reached
            }

            return {
                label:       escHtml(s.status_name || `Step ${s.step_no}`),
                description: escHtml(s.step_action  || ''),
                state,
            };
        }),
        {
            label:       'Account Activated',
            description: 'All approvals complete. Your account will be fully activated.',
            state:       isCompleted ? 'completed' : 'pending',
        },
    ];

    const timelineHtml = stepItems.map((item, i) => buildTimelineStep(item, i)).join('');

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
            ${timelineHtml}
        </div>`;
}

function buildTimelineStep({ label, description, state }, index) {
    const delay = `animation-delay:${index * 0.08}s`;
    let iconHtml;
    if (state === 'completed') {
        iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (state === 'active') {
        iconHtml = `<span class="trk-pulse"></span>`;
    } else {
        iconHtml = '';
    }

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

// ── Accordion section for a reviewer role ─────────────────────────────────────
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

// ── Load applications for a reviewer role ──────────────────────────────────────
async function loadRoleApplications(roleSlug, accordionEl) {
    const wrap = accordionEl.querySelector(`#table-${roleSlug}`);
    if (!wrap) return;

    wrap.innerHTML = `<div class="db-loading-inline"><div class="spinner"></div></div>`;

    try {
        const res  = await authFetch(`${API.APPLICATIONS}?role_slug=${encodeURIComponent(roleSlug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const apps = await res.json();

        const badge = accordionEl.querySelector(`#badge-${roleSlug}`);
        if (badge) badge.textContent = apps.length > 0 ? apps.length : '';

        if (apps.length === 0) {
            wrap.innerHTML = buildEmptyTable();
            return;
        }

        wrap.innerHTML = buildApplicationsTable(apps);

        wrap.querySelectorAll('.db-review-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const appId   = parseInt(btn.dataset.appId, 10);
                const appData = apps.find(a => a.id === appId);
                if (!appData) return;
                openReviewModal(appData, () => loadRoleApplications(roleSlug, accordionEl));
            });
        });

    } catch (err) {
        wrap.innerHTML = `<div class="db-error-msg">Failed to load applications: ${escHtml(err.message)}</div>`;
    }
}

// ── Table builders ────────────────────────────────────────────────────────────
function buildApplicationsTable(apps) {
    const rows = apps.map(a => `
        <tr>
            <td>
                <div class="db-applicant-name">${escHtml(a.applicant_name || a.applicant_email || '—')}</div>
                <div class="db-applicant-email">${escHtml(a.applicant_email || '')}</div>
            </td>
            <td>${escHtml(a.request_name    || '—')}</td>
            <td>${escHtml(a.workflow_name   || '—')}</td>
            <td><span class="db-status-pill">${escHtml(a.current_status || '—')}</span></td>
            <td><span class="db-action-pill">${escHtml(a.step_action    || '—')}</span></td>
            <td>${a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-GB') : '—'}</td>
            <td>
                <button class="btn db-review-btn" data-app-id="${a.id}">Review</button>
            </td>
        </tr>`).join('');

    return `
        <table class="db-table">
            <thead>
                <tr>
                    <th>Applicant</th>
                    <th>Request</th>
                    <th>Workflow</th>
                    <th>Current Status</th>
                    <th>Required Action</th>
                    <th>Submitted</th>
                    <th>Action</th>
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
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
