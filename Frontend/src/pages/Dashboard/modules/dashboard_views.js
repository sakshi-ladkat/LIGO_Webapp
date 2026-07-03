import { state } from './core.js';
import { _formatDate, __esc } from '../../../utils/helpers.js';

export function renderActiveDashboard(container) {
    const user = state.me;
    const profile = state.meData.profile || {};
    const affiliation = state.meData.affiliation || {};

    let expiryDate = null;
    const allServices = [];
    if (state.meData) {
        if (state.meData.active_services) allServices.push(...state.meData.active_services);
        if (state.meData.active_subservices) allServices.push(...state.meData.active_subservices);
    }
    
    allServices.forEach(s => {
        if (s.expires_at) {
            const d = new Date(s.expires_at);
            if (!expiryDate || d > expiryDate) {
                expiryDate = d;
            }
        }
    });

    if (!expiryDate) {
        // Fallback if no expiry is set
        expiryDate = new Date(user.created_at || new Date());
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryDate);
    expDate.setHours(0, 0, 0, 0);
    const timeDiff = expDate.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.round(timeDiff / (1000 * 3600 * 24)));

    let expiryColor = '#10b981'; // Green
    if (daysRemaining < 30) expiryColor = '#f59e0b'; // Yellow
    if (daysRemaining < 7) expiryColor = '#ef4444'; // Red

    let servicesHtml = '';
    if (state.meData && state.meData.active_services && state.meData.active_services.length > 0) {
        servicesHtml = `
            <div class="db-tracker-card" style="margin-top: 2rem; padding: 2rem;">
                <h3 style="margin: 0 0 1.5rem 0; font-size: 1.25rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="extracted-svg" style="width: 20px; height: 20px; background-color: #6366f1; -webkit-mask: url(/assets/icons/server.svg) no-repeat center; mask: url(/assets/icons/server.svg) no-repeat center;"></span> 
                    My Active Services
                </h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
        `;
        
        state.meData.active_services.forEach(srv => {
            let subservices = [];
            if (state.meData.active_subservices) {
                subservices = state.meData.active_subservices.filter(sub => sub.service_id === srv.id);
            }
            
            servicesHtml += `
                <div style="border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; background: #fff;">
                    <div style="padding: 1.25rem; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; cursor: ${subservices.length ? 'pointer' : 'default'}; transition: all 0.2s;" ${subservices.length ? `onclick="const el = this.nextElementSibling; if(el.style.display === 'none') { el.style.display = 'block'; this.style.background = '#e0e7ff'; } else { el.style.display = 'none'; this.style.background = '#f8fafc'; }"` : ''}>
                        <div>
                            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #1e293b;">${__esc(srv.name)}</h4>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            ${subservices.length ? `<span style="background: #eff6ff; color: #2563eb; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.75rem; font-weight: bold; border: 1px solid #bfdbfe;">${subservices.length}</span>` : ''}
                            <span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 800;">Active</span>
                            <span style="font-size: 0.75rem; color: #64748b;">Expires: ${_formatDate(srv.expires_at || expiryDate)}</span>
                            ${subservices.length ? `<span class="extracted-svg" style="width: 18px; height: 18px; background-color: #64748b; -webkit-mask: url(/assets/icons/chevron-down.svg) no-repeat center; mask: url(/assets/icons/chevron-down.svg) no-repeat center;"></span>` : ''}
                        </div>
                    </div>
                    ${subservices.length ? `
                        <div style="display: none; padding: 1.25rem; background: #ffffff; border-top: 1px solid #e2e8f0;">
                            <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 1rem;">
                                ${subservices.map(sub => `
                                    <li style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: #334155; padding-left: 1rem; border-left: 3px solid #60a5fa;">
                                        <span style="font-weight: 700; color: #1e293b;">${__esc(sub.name)}</span>
                                        <span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px;">Expires: ${_formatDate(sub.expires_at)}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        servicesHtml += `
                </div>
            </div>
        `;
    }

    const html = `
        <div style="display: flex; gap: 2rem; align-items: stretch; flex-wrap: wrap;">
            
            <!-- Left Div: Account Summary Section -->
            <div class="db-tracker-card" style="flex: 2; min-width: 400px; padding: 2.5rem; display: flex; flex-direction: column; justify-content: space-between; min-height: 280px;">
                <div style="margin-bottom: 2rem;">
                    <h2 style="margin: 0 0 0.5rem 0; font-size: 1.75rem; font-weight: 800; color: #0f172a;">Welcome back, ${profile.first_name || 'User'}!</h2>
                    <p style="margin: 0; color: #64748b; font-size: 1rem; line-height: 1.5;">Here is the overview of your active OrbitAccess account. You currently have access to system resources.</p>
                </div>
                
                <div style="display: flex; gap: 1.5rem; margin-top: auto;">
                    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 1rem; text-align: center;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Status</div>
                        <div style="color: #10b981; font-weight: 800; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                            <span class="extracted-svg" style="width: 20px; height: 20px; background-color: currentColor; -webkit-mask: url(/assets/icons/check-circle.svg) no-repeat center; mask: url(/assets/icons/check-circle.svg) no-repeat center;"></span> Active
                        </div>
                    </div>
                    
                    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 1rem; text-align: center;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Time Remaining</div>
                        <div style="color: ${expiryColor}; font-weight: 800; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                            <span class="extracted-svg" style="width: 20px; height: 20px; background-color: currentColor; -webkit-mask: url(/assets/icons/clock.svg) no-repeat center; mask: url(/assets/icons/clock.svg) no-repeat center;"></span> ${daysRemaining} Days
                        </div>
                        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem;">Expires: ${_formatDate(expiryDate)}</div>
                    </div>
                </div>
            </div>

            <!-- Right Div: Quick Actions Section -->
            <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; gap: 1.5rem;">
                
                <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2rem; border-radius: 1rem; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="extracted-svg" style="width: 20px; height: 20px; background-color: currentColor; -webkit-mask: url(/assets/icons/plus-circle.svg) no-repeat center; mask: url(/assets/icons/plus-circle.svg) no-repeat center;"></span>
                            Need More Access?
                        </h3>
                        <p style="margin: 0; font-size: 0.9rem; color: #3b82f6; line-height: 1.4;">Apply for additional services or workflows.</p>
                    </div>
                    <button id="btn-dashboard-apply-again" style="width: 100%; background: #2563eb; color: white; border: none; padding: 0.85rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; font-size: 0.95rem; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3); transition: all 0.2s;">
                        Request Access
                    </button>
                </div>

                <div style="flex: 1; background: #fdf4ff; border: 1px solid #fbcfe8; padding: 2rem; border-radius: 1rem; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; box-shadow: 0 4px 6px -1px rgba(217, 70, 239, 0.1);">
                    <div style="margin-bottom: 1rem;">
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; color: #86198f; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="extracted-svg" style="width: 20px; height: 20px; background-color: currentColor; -webkit-mask: url(/assets/icons/edit.svg) no-repeat center; mask: url(/assets/icons/edit.svg) no-repeat center;"></span>
                            Update Information
                        </h3>
                        <p style="margin: 0; font-size: 0.9rem; color: #d946ef; line-height: 1.4;">Modify your institute or affiliation details.</p>
                    </div>
                    <button id="btn-dashboard-modify-institute" style="width: 100%; background: #c026d3; color: white; border: none; padding: 0.85rem; border-radius: 0.5rem; font-weight: 700; cursor: pointer; font-size: 0.95rem; box-shadow: 0 2px 4px rgba(192, 38, 211, 0.3); transition: all 0.2s;">
                        Modify Institute
                    </button>
                </div>
                
            </div>

        </div>
        ${servicesHtml}
    `;

    container.innerHTML = html;

    const btnApplyAgain = container.querySelector('#btn-dashboard-apply-again');
    if (btnApplyAgain) {
        btnApplyAgain.onclick = () => {
            const navApplyAgain = document.querySelector('#db-nav-apply-again');
            if (navApplyAgain) {
                navApplyAgain.click();
            } else {
                localStorage.setItem('db_active_tab', 'apply_again');
                import('./apply_again.js').then(m => m.renderApplyAgain(document.querySelector('#db-main-content')));
            }
        };
    }

    const btnModifyInstitute = container.querySelector('#btn-dashboard-modify-institute');
    if (btnModifyInstitute) {
        btnModifyInstitute.onclick = () => {
            const navModifyInstitute = document.querySelector('#db-nav-modify-institute');
            if (navModifyInstitute) {
                navModifyInstitute.click();
            } else {
                // If the sidebar button is completely gone, we can directly render it
                import('./modify_institute.js').then(m => m.renderModifyInstitute(document.querySelector('#db-main-content')));
            }
        };
    }


}
