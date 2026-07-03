import { authFetch } from '../../../utils/auth.js';
import { state } from './core.js';
import { BASE_URL } from '../../../config/api.js';

function __esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function renderApplyAgain(container) {
    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
            <div id="apply-again-feedback" style="display: none; padding: 1rem; border-radius: 0.5rem; font-size: 0.9rem; font-weight: 600; margin-bottom: 1.5rem;"></div>
            <div id="apply-again-content">
                <div class="adm-loading" style="display: flex; justify-content: center; margin-bottom: 2rem;">
                    <div class="adm-spinner"></div> Loading application data...
                </div>
            </div>
        </div>
    `;

    const contentDiv = container.querySelector('#apply-again-content');
    const feedback = container.querySelector('#apply-again-feedback');
    
    let approvedApp = null;
    let inactiveServices = [];

    try {
        const appRes = await authFetch(`${BASE_URL}/api/auth/applications/approved`);
        if (appRes.ok) {
            const data = await appRes.json();
            approvedApp = data.application;
        }

        if (approvedApp) {
            const svcRes = await authFetch(`${BASE_URL}/api/auth/applications/${approvedApp.id}/inactive-services`);
            if (svcRes.ok) {
                const svcData = await svcRes.json();
                inactiveServices = svcData.services || [];
            }
        }
    } catch (e) {
        console.error("Failed to load approved applications", e);
    }

    if (approvedApp) {
        // Service Expansion Flow: 2-column layout

        // Use live user data instead of historical snapshot
        const me = state.meData || {};
        const profile = me.profile || {};
        const affil = me.affiliation || {};
        const instName = affil.institute_name || affil.other_institute || 'Unknown';

        const ligoMemberStatus = (approvedApp.ligo_member === 'yes' || approvedApp.ligo_member === 1 || approvedApp.ligo_member === true) ? 'Yes' : 'No';
        const ligoUsStatus = (approvedApp.ligo_us_member === 'yes') ? 'Yes' : (approvedApp.ligo_us_member === 'no' ? 'No' : 'Unknown');
        const ligoIndiaStatus = (approvedApp.ligo_india_member === 'yes') ? 'Yes' : (approvedApp.ligo_india_member === 'no' ? 'No' : 'Unknown');

        const profileHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.25rem;">Application ID</label>
                    <input type="text" disabled value="${__esc(approvedApp.application_id)}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; color: #64748b; cursor: not-allowed; font-size: 0.85rem;">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.25rem;">LIGO Member</label>
                    <input type="text" disabled value="${ligoMemberStatus}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; color: #64748b; cursor: not-allowed; font-size: 0.85rem;">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.25rem;">LIGO-US Member</label>
                    <input type="text" disabled value="${ligoUsStatus}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; color: #64748b; cursor: not-allowed; font-size: 0.85rem;">
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.25rem;">LIGO-India Member</label>
                    <input type="text" disabled value="${ligoIndiaStatus}" style="width: 100%; box-sizing: border-box; padding: 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; color: #64748b; cursor: not-allowed; font-size: 0.85rem;">
                </div>
            </div>
        `;

        // Format services
        const checkboxesHtml = inactiveServices.map(s => {
            if (s.is_currently_active) {
                return `
                    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid #bbf7d0; border-radius: 6px; cursor: not-allowed; text-align: left; background: #f0fdf4; margin-bottom: 8px; opacity: 0.8;">
                        <input type="checkbox" checked disabled style="margin-top: 2px; width: 16px; height: 16px; accent-color: #166534;">
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 700; color: #166534; font-size: 0.9rem; display: flex; align-items: center; justify-content: space-between;">
                                ${__esc(s.name)}
                                <span style="font-size: 0.7rem; background: #86efac; color: #14532d; padding: 2px 8px; border-radius: 12px; display: flex; align-items: center; gap: 4px;">
                                    <span style="-webkit-mask: url(/assets/icons/ic_ui_element_38.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_38.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 10px; height: 10px; display: inline-block;"></span>
                                    Active
                                </span>
                            </div>
                            <div style="font-size: 0.75rem; color: #15803d;">${__esc(s.description || 'Currently active service')}</div>
                        </div>
                    </label>
                `;
            } else {
                return `
                    <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: background 0.2s; text-align: left; background: #fff; margin-bottom: 8px;">
                        <input type="checkbox" class="expansion-service-cb" value="${s.id}" style="margin-top: 2px; width: 16px; height: 16px; accent-color: #4f46e5;">
                        <div>
                            <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">${__esc(s.name)}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${__esc(s.description || 'Request access to this service')}</div>
                        </div>
                    </label>
                `;
            }
        }).join('');

        let servicesHtml = `
            <div style="margin-bottom: 1rem; max-height: 400px; overflow-y: auto; padding-right: 8px;">
                ${checkboxesHtml}
            </div>
        `;
        
        // Only show request button if there are actually unrequested services
        const hasAvailableServices = inactiveServices.some(s => !s.is_currently_active);
        
        if (hasAvailableServices) {
            servicesHtml += `
                <button id="reapply-expansion-btn" style="width: 100%; background: #4f46e5; color: white; border: none; padding: 0.75rem; border-radius: 4px; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">
                    Send Access Request
                </button>
            `;
        } else {
            servicesHtml += `
                <button disabled style="width: 100%; background: #94a3b8; color: white; border: none; padding: 0.75rem; border-radius: 4px; font-weight: 700; font-size: 0.9rem; cursor: not-allowed;">
                    No New Services Available
                </button>
            `;
        }

        contentDiv.innerHTML = `
            <!-- Top: Profile Snapshot & LIGO Status -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem; font-size: 1.1rem; color: #0f172a; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                    <span class="extracted-svg" style="width: 14px; height: 14px; display: inline-block; background-color: currentColor; -webkit-mask-image: url(/assets/icons/clock.svg); mask-image: url(/assets/icons/clock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center;"></span>
                    Application Details
                </h3>
                ${profileHtml}
            </div>

            <!-- Services Form -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); max-width: 600px; margin: 0 auto;">
                <h3 style="margin: 0 0 1rem; font-size: 1.1rem; color: #0f172a; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                    <span class="extracted-svg" style="width: 18px; height: 18px; display: inline-block; background-color: #64748b; -webkit-mask-image: url(/assets/icons/plus-circle.svg); mask-image: url(/assets/icons/plus-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center;"></span>
                    Select Extra Access
                </h3>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem;">
                    Select the non-active services you need. The expiration date for these new services will match your current account expiration. Active services are disabled.
                </p>
                ${servicesHtml}
            </div>
        `;

        if (hasAvailableServices && inactiveServices.length > 0) {
            const expBtn = contentDiv.querySelector('#reapply-expansion-btn');
            expBtn.onclick = async () => {
                const selected = Array.from(contentDiv.querySelectorAll('.expansion-service-cb:checked:not(:disabled)')).map(cb => cb.value);
                
                if (selected.length === 0) {
                    feedback.style.display = 'block';
                    feedback.style.background = '#fffbeb';
                    feedback.style.color = '#b45309';
                    feedback.style.border = '1px solid #fde68a';
                    feedback.textContent = 'Please select at least one service to request.';
                    return;
                }

                expBtn.disabled = true;
                expBtn.textContent = 'Submitting Request...';
                expBtn.style.opacity = '0.7';
                feedback.style.display = 'none';

                try {
                    const res = await authFetch(`${BASE_URL}/api/auth/applications/reapply-expansion`, {
                        method: 'POST',
                        body: JSON.stringify({
                            parent_application_id: approvedApp.id,
                            services: selected
                        })
                    });
                    const data = await res.json();
                    
                    if (!res.ok) throw new Error(data.error || 'Failed to submit service expansion request.');
                    
                    feedback.style.display = 'block';
                    feedback.style.background = '#dcfce7';
                    feedback.style.color = '#166534';
                    feedback.style.border = '1px solid #bbf7d0';
                    feedback.textContent = 'Service expansion successfully requested! Redirecting to tracker...';
                    
                    setTimeout(() => window.location.hash = '#/dashboard', 1500);
                } catch (err) {
                    feedback.style.display = 'block';
                    feedback.style.background = '#fef2f2';
                    feedback.style.color = '#b91c1c';
                    feedback.style.border = '1px solid #fecaca';
                    feedback.textContent = err.message;
                    
                    expBtn.disabled = false;
                    expBtn.textContent = 'Request Selected Services';
                    expBtn.style.opacity = '1';
                }
            };
        }
    } else {
        contentDiv.innerHTML = `
            <div style="background: white; border: 1px dashed #e2e8f0; border-radius: 0.75rem; padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem;">
                <span style="font-size: 2rem; display: block; margin-bottom: 0.75rem;">🔒</span>
                You do not have an active application. Please contact support or wait for your application to be approved.
            </div>
        `;
    }
}
