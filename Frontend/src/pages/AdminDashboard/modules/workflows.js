/**
 * MODULE: Workflows
 * 
 * Handles the "Workflow Engine" tab logic.
 * Fetches existing workflows, handles versioning, rollbacks, and mapping 
 * workflows to request types and categories.
 */

import { authFetch } from '../../../utils/auth.js';
import { API, BASE_URL } from '../../../config/api.js';
import { _app, _state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
import { _showToast, _buildHierarchicalPageHtml, _wireHierarchicalPage } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW ENGINE — live from backend
// ═══════════════════════════════════════════════════════════════════════════
export async function _loadWorkflows() {
    const container = _app.querySelector('#adm-wf-container');
    container.innerHTML = await _buildHierarchicalPageHtml('workflows');
    _wireHierarchicalPage(container, 'workflows');
}

function _buildWorkflowCard(wf) {
    const steps = wf.steps || [];
    const stepCount = steps.length;
    const finalStep = steps.find(s => s.is_final_step);
    const finalRole = finalStep?.role_name || '—';

    // Pick a colour accent per workflow (cycle through a palette)
    const accents = ['#6366f1', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'];
    const color = accents[(wf.workflow_id || 0) % accents.length];

    return `
    <div class="adm-data-card adm-wf-summary-card" data-wfid="${wf.workflow_id}"
         style="--adm-card-accent:${color}; text-align:left; position:relative;">
        <div style="display:flex;align-items:center;gap:0.65rem;margin-bottom:1rem;">
            <div style="width:36px;height:36px;border-radius:0.5rem;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <span class="extracted-svg" style="-webkit-mask: url(/public/assets/icons/ic_ui_element_32.svg) no-repeat center; mask: url(/public/assets/icons/ic_ui_element_32.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 16px; height: 16px; display: inline-block;"></span>
            </div>
            <div>
                <div class="adm-data-card-title" style="text-align:left;">${__esc(wf.workflow_name)} ${wf.version ? `<span style="font-size:0.75rem; color:#64748b; font-weight:600;">v${wf.version}</span>` : ''}</div>
                <div class="adm-data-card-sub" style="text-align:left;">${stepCount} step${stepCount !== 1 ? 's' : ''}</div>
            </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">
            ${steps.slice(0, 3).map((s, i) => `
            <span style="font-size:0.68rem;font-weight:600;padding:0.15rem 0.5rem;border-radius:999px;
                  background:${s.is_final_step ? '#f0fdf4' : '#f1f5f9'};
                  color:${s.is_final_step ? '#16a34a' : '#64748b'}; border: 1px solid ${s.is_final_step ? '#dcfce7' : '#e2e8f0'};">
                ${i + 1}. ${__esc(s.role_name || '—')} <span style="font-weight:400; opacity:0.8;">(${__esc(s.status_name || '—')})</span>
            </span>`).join('')}
            ${steps.length > 3 ? `<span style="font-size:0.68rem;color:#94a3b8;">+${steps.length - 3} more</span>` : ''}
        </div>
        <div style="margin-top:0.85rem;font-size:0.72rem;color:#6366f1;font-weight:600;">Click to view →</div>
    </div>`;
}

function _openWorkflowModal(wf) {
    const modal = _app.querySelector('#adm-wf-modal');
    const title = _app.querySelector('#adm-wf-modal-title');
    const content = _app.querySelector('#adm-wf-modal-content');
    const steps = wf.steps || [];

    title.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><span class="extracted-svg" style="-webkit-mask: url(/public/assets/icons/ic_ui_element_33.svg) no-repeat center; mask: url(/public/assets/icons/ic_ui_element_33.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span> ${wf.workflow_name}</div>`;

    const stepsHtml = steps.length ? steps.map((s, i) => {
        const isFinal = s.is_final_step;
        return `
        <div class="adm-wf-step">
            <div class="adm-wf-step-dot ${isFinal ? 'final' : ''}">${isFinal ? '<span class="extracted-svg" style="-webkit-mask: url(/public/assets/icons/check.svg) no-repeat center; mask: url(/public/assets/icons/check.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>' : i + 1}</div>
            <div class="adm-wf-step-info">
                <div class="adm-wf-step-name">
                    <span style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; display:block; margin-bottom:2px;">Status Name</span>
                    ${__esc(s.status_name || `Step ${i + 1}`)}
                </div>
                <div class="adm-wf-step-role">
                    <span style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; display:block; margin-bottom:2px;">Authorized Role</span>
                    ${__esc(s.role_name || 'No role assigned')}
                </div>
            </div>
            ${isFinal ? `<span class="adm-pill adm-pill-approved" style="align-self:center;margin-left:auto;">Final</span>` : ''}
        </div>`;
    }).join('') : `<div class="adm-empty"><span><span class="extracted-svg" style="-webkit-mask: url(/public/assets/icons/ic_ui_element_34.svg) no-repeat center; mask: url(/public/assets/icons/ic_ui_element_34.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 24px; height: 24px; display: inline-block;"></span></span>No steps configured.</div>`;

    content.innerHTML = `
    <div style="background:#f8fafc;border-radius:0.65rem;padding:1rem;margin-bottom:1.25rem;border:1px solid #e2e8f0;">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;margin-bottom:0.5rem;">Pipeline Overview</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
            ${steps.map((s, i) => `
            <span style="font-size:0.75rem;font-weight:600;padding:0.2rem 0.65rem;border-radius:999px;
                  background:${s.is_final_step ? '#f0fdf4' : '#eef2ff'};
                  color:${s.is_final_step ? '#16a34a' : '#6366f1'};border:1px solid ${s.is_final_step ? '#86efac' : '#c7d2fe'};">
                ${i + 1}. ${__esc(s.role_name || '—')} <span style="font-weight:400; font-size:0.7rem; opacity:0.8;">(${__esc(s.status_name || '—')})</span>
            </span>
            ${i < steps.length - 1 ? '<span style="color:#cbd5e1;font-size:0.9rem;">→</span>' : ''}`).join('')}
        </div>
    </div>
    <div class="adm-wf-steps">${stepsHtml}</div>`;

    modal.classList.add('open');
}

