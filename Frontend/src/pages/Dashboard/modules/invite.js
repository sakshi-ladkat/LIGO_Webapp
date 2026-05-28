import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
export function buildInviteUserHtml() {
    return `
        <div style="display:flex; flex-direction:column; gap:2rem;">
            <!-- Invite Form Card -->
            <div class="db-tracker-card" style="padding:2rem 2.5rem; box-shadow:0 4px 20px rgba(0,0,0,0.05); border-radius:1rem;">
                <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #f1f5f9;">
                    <div style="background:linear-gradient(135deg,var(--primary-600) 0%,var(--primary-800) 100%); width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px; color:white; box-shadow:0 4px 10px rgba(99,102,241,0.25);">
                        <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/user-plus.svg); mask-image: url(/assets/icons/user-plus.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#0f172a;">Invite New User</h3>
                        <p style="margin:0.2rem 0 0; color:#64748b; font-size:0.8rem;">Send a secure invitation email to add a new team member.</p>
                    </div>
                </div>

                <form id="supervisor-invite-form" style="display:grid; grid-template-columns:1fr auto; gap:1.25rem; align-items:flex-end;">
                    <div class="sb-field" style="display:flex; flex-direction:column; gap:0.4rem; margin:0; width:100%;">
                        <label style="color:#64748b; font-weight:700; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.025em; margin-left:0.25rem;">Email Address</label>
                        <input class="sb-field-input" style="background:#ffffff; border:1.5px solid #e2e8f0; padding:0.75rem 1rem; border-radius:0.75rem; font-size:0.95rem; font-weight:500;" type="email" id="invite-email" required placeholder="member@example.com">
                    </div>

                    <button type="submit" id="supervisor-invite-btn" style="background:#4f46e5; color:white; border:none; padding:0.8rem 2rem; border-radius:0.75rem; font-weight:700; font-size:0.95rem; display:flex; align-items:center; gap:0.5rem; box-shadow:0 4px 12px rgba(79,70,229,0.25); cursor:pointer; height:47px; transition:all 0.2s;">
                        <span class="extracted-svg" style="width:16px; height:16px; display: inline-block; -webkit-mask-image: url(/assets/icons/send.svg); mask-image: url(/assets/icons/send.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Send Invite
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

export async function _wireInviteUser(container) {
    const form = container.querySelector('#supervisor-invite-form');
    const emailInput = container.querySelector('#invite-email');
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
                            <button class="invite-action-btn resend-btn" data-id="${inv.id}" style="background:#e0e7ff; color:#4338ca; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:700; font-size:0.75rem; display:flex; align-items:center; gap:0.25rem; cursor:pointer;" title="Resend Email"><span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/refresh-cw.svg); mask-image: url(/assets/icons/refresh-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Resend</button>
                            <button class="invite-action-btn cancel-btn" data-id="${inv.id}" style="background:#fef2f2; color:#b91c1c; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:700; font-size:0.75rem; display:flex; align-items:center; gap:0.25rem; cursor:pointer;" title="Cancel Invite"><span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/trash-2.svg); mask-image: url(/assets/icons/trash-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Cancel</button>
                        </div>
                    `;
                } else if (inv.status === 'expired' || inv.status === 'cancelled') {
                    actionsHtml = `
                        <button class="invite-action-btn resend-btn" data-id="${inv.id}" style="background:#e0e7ff; color:#4338ca; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:700; font-size:0.75rem; display:flex; align-items:center; gap:0.25rem; cursor:pointer;"><span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/refresh-cw.svg); mask-image: url(/assets/icons/refresh-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Resend</button>
                    `;
                } else {
                    actionsHtml = `<span style="color:#166534; font-weight:700; font-size:0.8rem; display:flex; align-items:center; gap:0.25rem;"><span class="extracted-svg" style="width:14px; height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/check-circle.svg); mask-image: url(/assets/icons/check-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Accepted</span>`;
                }

                return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:1rem; font-weight:700; color:#0f172a; font-size:0.9rem;">${__esc(inv.email)}</td>
                        <td style="padding:1rem; font-size:0.8rem; color:#64748b; font-weight:600;">
                            <div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:0.15rem;">${dateLabel}</div>
                            ${_formatDate(dateVal)}
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
                        btn.innerHTML = `<span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/refresh-cw.svg); mask-image: url(/assets/icons/refresh-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Resend`;
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
                        btn.innerHTML = `<span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/trash-2.svg); mask-image: url(/assets/icons/trash-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Cancel`;
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

        if (!email) return;

        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<div class="spinner" style="width:16px; height:16px; border-color:white; border-top-color:transparent;"></div> Sending…`;

        try {
            const res = await authFetch(API.INVITATIONS, {
                method: 'POST',
                body: JSON.stringify({ email })
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


