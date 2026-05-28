/**
 * MODULE: Institutes
 * 
 * Handles the "Institute Management" tab.
 * Responsible for listing partnered institutes, reviewing registrations,
 * and toggling block/active statuses.
 */

import { authFetch } from '../../../utils/auth.js';
import { API, BASE_URL } from '../../../config/api.js';
import { _app, _state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
import { _showToast } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// 6. INSTITUTE MANAGEMENT (NEW)
// ═══════════════════════════════════════════════════════════════════════════
export async function _loadInstitutes() {
    _state.cachedInstitutesList = null;
    const container = _app.querySelector('#adm-inst-container');
    container.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading institutes…</div>`;

    try {
        const res = await authFetch(API.ADMIN_INSTITUTES);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const all = data.all || [...(data.active || []), ...(data.pending || [])];
        _renderInstitutes(container, all);
    } catch (err) {
        container.innerHTML = `<div class="adm-empty"><span>❌</span>Failed to load institutes: ${err.message}</div>`;
    }
}

function _renderInstitutes(container, all) {
    container.innerHTML = `
        <div class="adm-page-header" style="margin-bottom:2rem; display:flex; align-items:center; gap:1.5rem;">
            <button class="adm-btn adm-btn-secondary" onclick="_switchTab('modify')" style="padding:0.5rem; border-radius:50%; width:40px; height:40px;">
                <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/arrow-left.svg); mask-image: url(/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
            </button>
            <div>
                <h2 class="adm-page-title"><span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_35.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_35.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 24px; height: 24px; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>Modify Institutes</h2>
                <p class="adm-page-sub">Manage institute names, correct spellings, and remove incorrect entries</p>
            </div>
        </div>

        <!-- Direct Register (Accordion) -->
        <div class="adm-accordion" id="inst-register-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
            <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/plus-circle.svg); mask-image: url(/assets/icons/plus-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    </div>
                    <div>
                        <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">REGISTER NEW INSTITUTE</h4>
                        <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">DIRECTLY AUTHORIZE A NEW INSTITUTION</p>
                    </div>
                </div>
                <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
            </div>
            <div class="adm-accordion-content" style="padding:1.5rem;">
                <div class="adm-form" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1.25rem; margin-bottom:1.5rem;">
                    <div class="adm-form-group">
                        <label class="adm-label">Institute Name</label>
                        <input type="text" id="adm-in-name" placeholder="Oxford University" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">Institute Code</label>
                        <input type="text" id="adm-in-code" placeholder="OXF" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">City</label>
                        <input type="text" id="adm-in-city" placeholder="London" />
                    </div>
                </div>
                <div id="adm-in-fb" style="min-height:1.2rem; font-size:0.85rem; margin-bottom:1rem;"></div>
                <button id="adm-in-btn" class="adm-btn adm-btn-primary" style="width:auto; padding:0.75rem 2.5rem; background:#6366f1;">Register &amp; Save</button>
            </div>
        </div>

        <!-- All Institutes (Accordion) -->
        <div class="adm-accordion open" id="inst-active-accordion" style="margin-bottom:2rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
            <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/list.svg); mask-image: url(/assets/icons/list.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    </div>
                    <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">ALL INSTITUTES</h4>
                    <span style="margin-left:auto; background:#6366f1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center;">${all.length}</span>
                </div>
                <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; margin-left:10px; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
            </div>
            <div class="adm-accordion-content" style="padding:1.5rem;">
                <div style="display:flex; gap:1.25rem; margin-bottom:1.25rem; flex-wrap:wrap; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                    <div style="display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:6px 12px; width:100%; max-width:360px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                        <span class="extracted-svg" style="width:16px; height:16px; color:#64748b; display: inline-block; -webkit-mask-image: url(/assets/icons/search.svg); mask-image: url(/assets/icons/search.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        <input type="text" id="adm-inst-search" placeholder="Search by name, code, city..." style="border:none; outline:none; font-size:0.85rem; width:100%; color:#1e293b; font-weight:500;" />
                    </div>
                </div>

                <div class="adm-table-wrap" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>Institute</th>
                                <th>Code</th>
                                <th>City</th>
                                <th>Status</th>
                                <th style="text-align:center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="adm-inst-active-tbody">
                            ${all.length ? all.map(a => `
                                <tr class="adm-inst-row" data-name="${__esc(a.name)}" data-code="${__esc(a.code || '')}" data-city="${__esc(a.city || '')}">
                                    <td>
                                        <div>
                                            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                                                <strong style="color:#1e293b;">${__esc(a.name)}</strong>
                                                ${a.is_user_suggested ? '<span class="adm-pill" style="font-size:0.6rem; padding:2px 8px; background:#fffbeb; color:#b45309; border:1px solid #fef3c7; border-radius:4px; font-weight:700;">User Suggested</span>' : ''}
                                            </div>
                                            <div style="font-size:0.7rem; color:#64748b; margin-top:4px; display:flex; flex-direction:column; gap:2px;">
                                                ${a.creator_name ? `<span><strong>Added by:</strong> ${__esc(a.creator_name)}</span>` : ''}
                                                ${a.modifier_name ? `<span><strong>Modified by:</strong> ${__esc(a.modifier_name)}</span>` : ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td><code style="color:#6366f1; font-weight:600;">${__esc(a.code || '—')}</code></td>
                                    <td><span style="color:#64748b; font-size:0.85rem;">${__esc(a.city || '—')}</span></td>
                                    <td>
                                        <div style="display:inline-flex; align-items:center; gap:8px;">
                                            <span class="adm-pill ${a.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}" style="font-size:0.65rem; min-width:55px; text-align:center; text-transform:uppercase; font-weight:700; letter-spacing:0.02em;">
                                                ${a.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                            <label class="adm-switch" style="margin:0;" title="${a.is_active ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}">
                                                <input type="checkbox" class="adm-inst-toggle-switch" data-id="${a.id}" ${a.is_active ? 'checked' : ''}>
                                                <span class="adm-switch-slider"></span>
                                            </label>
                                        </div>
                                    </td>
                                    <td style="text-align:center; white-space:nowrap;">
                                        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                                            <button class="adm-inst-edit-btn"
                                                data-id="${a.id}"
                                                data-name="${__esc(a.name)}"
                                                data-code="${__esc(a.code || '')}"
                                                data-city="${__esc(a.city || '')}"
                                                data-creator="${__esc(a.creator_name || '')}"
                                                data-modifier="${__esc(a.modifier_name || '')}"
                                                style="display:inline-flex; align-items:center; gap:5px; padding:0.35rem 0.85rem; font-size:0.72rem; font-weight:700; border:none; border-radius:8px; cursor:pointer; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; box-shadow:0 2px 8px rgba(99,102,241,0.3); transition:all 0.2s; letter-spacing:0.02em;"
                                                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(99,102,241,0.45)';"
                                                onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(99,102,241,0.3)';">
                                                <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/edit-3.svg); mask-image: url(/assets/icons/edit-3.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Modify
                                            </button>

                                            <button class="adm-inst-remove-btn"
                                                data-id="${a.id}"
                                                data-name="${__esc(a.name)}"
                                                style="display:inline-flex; align-items:center; gap:5px; padding:0.35rem 0.85rem; font-size:0.72rem; font-weight:700; border:none; border-radius:8px; cursor:pointer; background:linear-gradient(135deg,#fee2e2,#fecaca); color:#dc2626; box-shadow:0 2px 6px rgba(239,68,68,0.15); transition:all 0.2s; letter-spacing:0.02em;"
                                                onmouseover="this.style.background='linear-gradient(135deg,#ef4444,#dc2626)';this.style.color='#fff';this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(239,68,68,0.4)';"
                                                onmouseout="this.style.background='linear-gradient(135deg,#fee2e2,#fecaca)';this.style.color='#dc2626';this.style.transform='';this.style.boxShadow='0 2px 6px rgba(239,68,68,0.15)';">
                                                <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/trash-2.svg); mask-image: url(/assets/icons/trash-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>`).join('') : `<tr><td colspan="5"><div class="adm-empty" style="padding:2rem 0;"><span>📂</span>No institutes found.</div></td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    _wireInstituteActions(container);
}


function _wireInstituteActions(container) {
    // Accordion toggles
    container.querySelector('#inst-register-accordion')?.querySelector('.adm-accordion-header')?.addEventListener('click', function() {
        container.querySelector('#inst-register-accordion').classList.toggle('open');
    });
    container.querySelector('#inst-active-accordion')?.querySelector('.adm-accordion-header')?.addEventListener('click', function() {
        container.querySelector('#inst-active-accordion').classList.toggle('open');
    });

    // Search
    const searchInput = container.querySelector('#adm-inst-search');
    const rows = container.querySelectorAll('#adm-inst-active-tbody tr');

    function applyFilters() {
        const query = (searchInput?.value || '').toLowerCase().trim();
        rows.forEach(row => {
            const name = (row.dataset.name || '').toLowerCase();
            const code = (row.dataset.code || '').toLowerCase();
            const city = (row.dataset.city || '').toLowerCase();
            row.style.display = (!query || name.includes(query) || code.includes(query) || city.includes(query)) ? '' : 'none';
        });
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // Direct Register
    const regBtn = container.querySelector('#adm-in-btn');
    if (regBtn) {
        regBtn.addEventListener('click', async () => {
            const name = container.querySelector('#adm-in-name').value.trim();
            const code = container.querySelector('#adm-in-code').value.trim();
            const city = container.querySelector('#adm-in-city').value.trim();
            const fb = container.querySelector('#adm-in-fb');
            if (!name || !code) { fb.style.color = '#ef4444'; fb.textContent = 'Name and Code are required.'; return; }
            regBtn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = 'Processing…';
            try {
                const res = await authFetch(API.ADMIN_INSTITUTES, { method: 'POST', body: JSON.stringify({ name, code, city }) });
                if (res.ok) { _showToast('Institute registered successfully', 'success'); _loadInstitutes(); }
                else { const err = await res.json(); fb.style.color = '#ef4444'; fb.textContent = err.message || 'Registration failed.'; }
            } catch (e) { fb.style.color = '#ef4444'; fb.textContent = e.message; }
            finally { regBtn.disabled = false; }
        });
    }

    // Modify Button — works for ALL institutes (pending or approved)
    container.querySelectorAll('.adm-inst-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = _app.querySelector('#adm-inst-edit-modal');
            const form = modal.querySelector('#adm-inst-edit-form');
            modal.querySelector('.adm-modal-title').textContent = 'Modify Institute';
            form.querySelector('#adm-inst-edit-submit').textContent = 'Save Changes';

            const auditEl = form.querySelector('#adm-inst-edit-audit');
            const creator = btn.dataset.creator;
            const modifier = btn.dataset.modifier;
            if (creator || modifier) {
                auditEl.style.display = 'flex';
                auditEl.innerHTML = `
                    ${creator ? `<div><strong>Added by:</strong> ${creator}</div>` : ''}
                    ${modifier ? `<div><strong>Last modified by:</strong> ${modifier}</div>` : ''}
                `;
            } else { auditEl.style.display = 'none'; }

            form.querySelector('[name="name"]').value = btn.dataset.name;
            form.querySelector('[name="code"]').value = btn.dataset.code || '';
            form.querySelector('[name="city"]').value = btn.dataset.city || '';
            modal.classList.add('open');

            form.onsubmit = async (e) => {
                e.preventDefault();
                const updated = {
                    name: form.querySelector('[name="name"]').value,
                    code: form.querySelector('[name="code"]').value,
                    city: form.querySelector('[name="city"]').value,
                };
                try {
                    const res = await authFetch(`${API.ADMIN_INSTITUTES}/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify(updated) });
                    if (res.ok) { modal.classList.remove('open'); _showToast('Institute updated', 'success'); _loadInstitutes(); }
                    else { const err = await res.json(); _showToast(err.message || 'Update failed', 'error'); }
                } catch (err) { _showToast(err.message, 'error'); }
            };
        });
    });

    // Toggle switch for Visibility (Active/Inactive)
    container.querySelectorAll('.adm-inst-toggle-switch').forEach(sw => {
        sw.addEventListener('change', async () => {
            const instId = sw.dataset.id;
            try {
                const res = await authFetch(`${API.ADMIN_INSTITUTES}/${instId}/toggle-status`, { method: 'PATCH' });
                if (res.ok) {
                    const data = await res.json();
                    _showToast(data.message || 'Visibility updated', 'success');
                    _loadInstitutes();
                } else {
                    _showToast('Failed to update visibility', 'error');
                    sw.checked = !sw.checked;
                }
            } catch (err) {
                _showToast(err.message, 'error');
                sw.checked = !sw.checked;
            }
        });
    });

    // Remove Button — two-step inline confirmation instead of browser alert
    container.querySelectorAll('.adm-inst-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            // If already in confirm state, execute delete
            if (btn.dataset.confirming === 'true') {
                btn.dataset.confirming = 'false';
                btn.innerHTML = '<span class="extracted-svg" style="width:12px;height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/trash-2.svg); mask-image: url(/assets/icons/trash-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Remove';
                btn.style.background = 'linear-gradient(135deg,#fee2e2,#fecaca)';
                btn.style.color = '#dc2626';
                try {
                    const res = await authFetch(`${API.ADMIN_INSTITUTES}/${btn.dataset.id}`, { method: 'DELETE' });
                    if (res.ok) { _showToast('Institute removed', 'info'); _loadInstitutes(); }
                    else { _showToast('Failed to remove institute', 'error'); }
                } catch (err) { _showToast(err.message, 'error'); }
                return;
            }
            // First click — show confirmation state on the button
            btn.dataset.confirming = 'true';
            btn.innerHTML = '⚠️ Confirm Remove?';
            btn.style.background = 'linear-gradient(135deg,#f97316,#ea580c)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 2px 8px rgba(234,88,12,0.4)';
            // Auto-reset after 3 seconds if not clicked again
            setTimeout(() => {
                if (btn.dataset.confirming === 'true') {
                    btn.dataset.confirming = 'false';
                    btn.innerHTML = '<span class="extracted-svg" style="width:12px;height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/trash-2.svg); mask-image: url(/assets/icons/trash-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Remove';
                    btn.style.background = 'linear-gradient(135deg,#fee2e2,#fecaca)';
                    btn.style.color = '#dc2626';
                    btn.style.boxShadow = '0 2px 6px rgba(239,68,68,0.15)';
                }
            }, 3000);
        });
    });

    // Modal close
    _app.querySelector('#adm-inst-edit-close').onclick = () => _app.querySelector('#adm-inst-edit-modal').classList.remove('open');
    _app.querySelector('#adm-inst-edit-cancel').onclick = () => _app.querySelector('#adm-inst-edit-modal').classList.remove('open');
}

