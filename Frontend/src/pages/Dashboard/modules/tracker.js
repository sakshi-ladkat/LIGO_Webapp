import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
import { renderApplicationTracker } from '../../../components/ApplicationTracker.js';
export async function loadMyApplication(container) {
    try {
        const [a, s] = await Promise.all([authFetch(API.MY_APPLICATION), state.servicesData ? Promise.resolve({ ok: true, json: () => state.servicesData }) : authFetch(API.REVIEW_SERVICES)]);
        if (a.ok) state.myAppData = await a.json();
        if (s.ok && !state.servicesData) state.servicesData = await s.json();

        let html = '';
        if (state.myAppData) {
            html += renderApplicationTracker(state.myAppData.application, state.myAppData.steps || [], { sshKey: state.myAppData.ssh_key, userData: state.myAppData.user_data, isAdminView: false });
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

export function initReapplyListeners(container) {
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

export async function loadApplicationHistoryTab(container) {
    try {
        const res = await authFetch(API.MY_APPLICATION);
        if (res.ok) {
            const data = await res.json();
            state.myAppData = data; // Update in-memory cache
        }

        let html = '';
        if (state.myAppData && state.myAppData.history && state.myAppData.history.length > 0) {
            html += buildApplicationHistory(state.myAppData.history);
        } else {
            html += `
                <div class="db-tracker-card" style="padding: 4rem 2rem; text-align: center;">
                    <div style="background: #e0e7ff; width: 64px; height: 64px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: #4f46e5; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);">
                        <span class="extracted-svg" style="width: 30px; height: 30px; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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

export function buildApplicationHistory(history) {
    return `
        <div class="db-tracker-card" style="margin-top: 2rem; padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="background: #e0e7ff; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 10px; color: #4f46e5;">
                        <span class="extracted-svg" style="width: 20px; height: 20px; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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
                            <th style="padding: 1rem 0.5rem; text-align: center;">Type</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Status</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Reviewer Remarks / Reason</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Reapplied From</th>
                            <th style="padding: 1rem 0.5rem; text-align: center;">Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(app => {
        const dateStr = _formatDate(app.submitted_at);
        const updatedStr = _formatDate(app.updated_at);

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
                                    <td style="padding: 1rem 0.5rem; font-weight: 700; color: #4f46e5; text-align: center;">${__esc(app.application_id)}</td>
                                    <td style="padding: 1rem 0.5rem; color: #64748b; text-align: center;">${dateStr}</td>
                                    <td style="padding: 1rem 0.5rem; color: #1e293b; font-weight: 700; text-align: center;">${__esc(app.request_name || 'N/A')}</td>
                                    <td style="padding: 1rem 0.5rem; text-align: center;">
                                        <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 800; ${badgeStyle}">
                                            ${badgeLabel}
                                        </span>
                                    </td>
                                    <td style="padding: 1rem 0.5rem; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569; text-align: center;" title="${__esc(remarks)}">
                                        ${__esc(remarks)}
                                    </td>
                                    <td style="padding: 1rem 0.5rem; font-family: monospace; color: #64748b; text-align: center;">${__esc(reappliedFrom)}</td>
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

export async function showHistoryDetailsModal(appId) {
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
                            <span class="extracted-svg" style="width: 20px; height: 20px; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a;">Application Details</h3>
                            <span style="font-family: monospace; color: #64748b; font-size: 0.8rem;">${appObj.application_id}</span>
                        </div>
                    </div>
                    <button id="close-modal-btn" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 6px; border-radius: 50%; transition: all 0.2s;">
                        <span class="extracted-svg" style="width: 20px; height: 20px; display: inline-block; -webkit-mask-image: url(/assets/icons/x.svg); mask-image: url(/assets/icons/x.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    </button>
                </div>
                
                <!-- Modal Body -->
                <div style="padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Overview section -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f8fafc; padding: 1.25rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Workflow / Category</div>
                            <div style="font-size: 0.9rem; color: #1e293b; font-weight: 700;">${__esc(appObj.workflow_name || 'N/A')}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Status</div>
                            <span style="display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 800; background: #fee2e2; color: #ef4444;">
                                ${appObj.status.toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Applied Date</div>
                            <div style="font-size: 0.9rem; color: #1e293b; font-weight: 700;">${_formatDate(appObj.submitted_at)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem;">Rejection Reviewer</div>
                            <div style="font-size: 0.9rem; color: #1e293b; font-weight: 700;">${__esc(appObj.rejected_by_name || 'System / Admin')}</div>
                        </div>
                    </div>
                    
                    <!-- Decline remarks -->
                    ${appObj.rejection_reason || appObj.declined_reason ? `
                        <div style="background: #fff5f5; border: 1px solid #fed7d7; padding: 1.25rem; border-radius: 12px;">
                            <div style="font-weight: 800; color: #c53030; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.05em;">Decline remarks / reason</div>
                            <div style="color: #9b2c2c; font-size: 0.9rem; line-height: 1.5; font-weight: 500;">
                                ${__esc(appObj.rejection_reason || appObj.declined_reason)}
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
                                                <h5 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: #1e293b;">${__esc(step.status_name)}</h5>
                                                <span style="font-size: 0.75rem; color: #94a3b8;">${step.approved_at ? _formatDate(step.approved_at) : ''}</span>
                                            </div>
                                            ${step.remarks ? `
                                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">
                                                    Remarks: <em>${__esc(step.remarks)}</em>
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
        window.showToast?.("Failed to load history details.", "error") ?? console.error("Failed to load history details.");
    }
}


