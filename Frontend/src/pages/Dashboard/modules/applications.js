import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
import { openReviewModal } from '../reviewModal.js';
export const REVIEW_ROLE_CONFIG = {
    'supervisor': { color: '#10b981', label: 'Supervisor' },
    'subsystem_lead': { color: '#3b82f6', label: 'Subsystem Lead' },
    'system_lead': { color: '#8b5cf6', label: 'System Lead' },
    'li_coordinator': { color: '#f59e0b', label: 'LI-Coordinator' },
    'pet_lead': { color: '#ec4899', label: 'PET Lead' },
    'super_admin': { color: '#64748b', label: 'Super Admin' }
};

export function buildAccordion(r) {
    const roleLabel = __esc(REVIEW_ROLE_CONFIG[r.slug]?.label || r.name || r.slug);
    const roleClass = `db-role-${r.slug.replace(/_/g, '-')}`;
    return `
        <div class="db-accordion ${roleClass}" id="accordion-${r.slug}">
            <button class="db-accordion-toggle" data-role-slug="${r.slug}">
                <span class="db-accordion-icon"><span class="extracted-svg" style="-webkit-mask: url(/assets/icons/chevron-down.svg) no-repeat center; mask: url(/assets/icons/chevron-down.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span></span>
                <span class="db-role-name-text">${roleLabel}</span>
                <span class="db-accordion-badge-label">&nbsp;&mdash;&nbsp;Pending Reviews</span>
                <span class="db-accordion-badge" id="badge-${r.slug}"></span>
            </button>
            <div class="db-accordion-body">
                <div class="db-search-wrap" style="padding: 1rem 1.5rem 0.5rem; display: flex; justify-content: flex-end; border-bottom: 1px solid #f1f5f9; background: #fafafa; margin-bottom: 1rem;">
                    <div style="position: relative; width: 300px;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/search.svg) no-repeat center; mask: url(/assets/icons/search.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none;"></span>
                        <input id="db-search-${r.slug}" class="adm-search-input" type="text"
                            style="width: 100%; box-sizing: border-box; padding: 0.5rem 1rem 0.5rem 2.25rem; border: 1.5px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.8rem; outline: none; transition: border-color 0.2s;"
                            placeholder="Search in ${roleLabel}…">
                    </div>
                </div>
                <div class="db-table-wrap" id="table-${r.slug}"></div>
            </div>
        </div>`;
}
export function renderRoleApplications(roleSlug, apps) {
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
                            state.allApps = freshApps || [];
                            const q = (document.getElementById('db-search-input')?.value || '').toLowerCase();
                            state.roles.filter(r => REVIEW_ROLE_CONFIG[r.slug]).forEach(role => {
                                const roleApps = state.allApps.filter(a => a.role_slug === role.slug && (
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

export function buildApplicationsTable(apps) {
    const rows = apps.map(a => `
        <tr>
            <td>
                <div class="db-applicant-name">${__esc(a.applicant_name || a.applicant_email || '—')}</div>
                <div class="db-applicant-email">${__esc(a.applicant_email || '')}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px; font-weight: 500;">
                    App ID: ${__esc(a.application_id || a.id || '—')}
                    ${a.reapplied_from ? `<span style="margin-left:6px; background:#fffbeb; color:#d97706; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; font-size:0.65rem; font-weight:700;" title="Reapplied from ${__esc(a.reapplied_from)}"><span class="extracted-svg" style="width:8px; height:8px; margin-right:2px; display: inline-block; -webkit-mask-image: url(/assets/icons/refresh-ccw.svg); mask-image: url(/assets/icons/refresh-ccw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>Reapplication</span>` : ''}
                </div>
            </td>
            <td>${__esc(a.request_name || '—')}</td>
            <td>${__esc(a.workflow_name || '—')}</td>
            <td><span class="db-status-pill">${__esc(a.current_status || '—')}</span></td>
            <td><span class="db-action-pill">${__esc(a.step_action || '—')}</span></td>
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
export function buildEmptyTable() {
    return `
        <div class="db-empty-table" style="padding:4rem 2rem;text-align:center;background:#f8fafc;border-radius:1rem;border:2px dashed #e2e8f0;margin:1rem 0;">
            <div style="background:#f1f5f9;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;color:#94a3b8;box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/inbox.svg) no-repeat center; mask: url(/assets/icons/inbox.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 32px; height: 32px; display: inline-block;"></span>
            </div>
            <div style="font-weight:800;color:#64748b;font-size:1.1rem;margin-bottom:0.5rem;">All Caught Up!</div>
            <p style="color:#94a3b8;font-size:0.9rem;margin:0;max-width:300px;margin:0 auto;">No pending applications are currently awaiting review for this role.</p>
        </div>`;
}
