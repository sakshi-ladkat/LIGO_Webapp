import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
export function renderProfile(mainContent) {
    const p = state.meData.profile || {};
    const quals = (state.meData.qualifications || []).sort((a, b) => {
        // Primary sort: Graduation Year (Descending)
        if (b.graduation_year !== a.graduation_year) return b.graduation_year - a.graduation_year;
        // Secondary sort: Graduation Month (Descending)
        return b.graduation_month - a.graduation_month;
    });
    const contact = state.meData.contact || {};
    if (!mainContent) {
        mainContent = document.getElementById('db-main-content');
    }
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div>

            <!-- Panels Section -->
            <div style="display:flex;flex-direction:column;gap:1.5rem;">
                <div class="db-tracker-card" style="padding:2rem 2.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div class="profile-section-header" style="margin-bottom:1.5rem;"><h3 class="profile-section-title" style="font-size:1.25rem;font-weight:800;color:#0f172a;"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/user.svg); mask-image: url(/assets/icons/user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Personal Information</h3></div>
                    ${buildPersonalPanel(p)}
                </div>

                <div class="db-tracker-card" style="padding:2rem 2.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div class="profile-section-header" style="margin-bottom:1.5rem;"><h3 class="profile-section-title" style="font-size:1.25rem;font-weight:800;color:#0f172a;"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/book-open.svg); mask-image: url(/assets/icons/book-open.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Qualification &amp; History</h3></div>
                    ${buildQualPanel(quals)}
                </div>

                <div class="db-tracker-card" style="padding:2rem 2.5rem;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div class="profile-section-header" style="margin-bottom:1.5rem;"><h3 class="profile-section-title" style="font-size:1.25rem;font-weight:800;color:#0f172a;"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/phone.svg); mask-image: url(/assets/icons/phone.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Contact Details</h3></div>
                    ${buildContactPanel(contact)}
                </div>
            </div>
        </div>`;

    _wireProfileForms(document.getElementById('app'));
    feather.replace();
}

export function buildPersonalPanel(p) {
    const fullName = [p.title, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || 'Not provided';
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom:1rem;border-bottom:1px solid #f1f5f9;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                <span class="sb-panel-title" style="font-weight:700;color:#64748b;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;">Current Details</span>
                <button type="button" class="sb-btn-edit" style="background:#6366f1;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.25);"><span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/edit-2.svg); mask-image: url(/assets/icons/edit-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Edit Info</button>
            </div>
            <div class="sb-view-mode" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;">
                <div class="sb-view-row"><span class="sb-view-label">Full Name</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;">${__esc(fullName)}</span></div>
                <div class="sb-view-row"><span class="sb-view-label">Date of Birth</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;">${__esc(p.date_of_birth ? p.date_of_birth.split('T')[0] : '—')}</span></div>
                <div class="sb-view-row"><span class="sb-view-label">Gender</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;text-transform:capitalize;">${__esc(p.gender || '—')}</span></div>
            </div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1rem;background:#f8fafc;padding:1.5rem;border-radius:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    ${sbSelect('Salutation', 'title', p.title, (state.titlesData || []).map(t => ({ value: t.name, label: t.name })))}
                    ${sbField('First Name', 'first_name', p.first_name)}
                    ${sbField('Middle Name', 'middle_name', p.middle_name)}
                    ${sbField('Last Name', 'last_name', p.last_name)}
                    ${sbField('Date of Birth', 'date_of_birth', p.date_of_birth ? p.date_of_birth.split('T')[0] : '', 'date', true)}
                    ${sbSelect('Gender', 'gender', p.gender, [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }, { value: 'prefer-not-to-say', label: 'Prefer not to say' }])}
                </div>
                <div class="sb-form-actions" style="margin-top:0.5rem;">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:#e2e8f0;border:none;color:#475569;padding:0.6rem 1.2rem;border-radius:0.5rem;font-weight:600;">Cancel</button>
                    <button id="sb-save-personal" class="sb-btn-save" style="background:#4f46e5;color:white;border:none;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;">Update Profile</button>
                </div>
            </div>
        </div>`;
}

export function buildQualPanel(quals) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let historyHtml = '';
    if (quals.length > 0) {
        const rows = quals.map(q => {
            const isActive = q.graduation_year > currentYear || (q.graduation_year == currentYear && q.graduation_month >= currentMonth);
            return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:1.25rem 1rem;font-weight:700;color:#0f172a;font-size:0.95rem;">${__esc(q.highest_qualification || '—')}</td>
                <td style="padding:1.25rem 1rem;color:#475569;font-size:0.9rem;">${__esc(q.field_of_study || '—')}</td>
                <td style="padding:1.25rem 1rem;">
                    <div style="font-weight:700;color:#1e293b;font-size:0.95rem;">${__esc(q.university || '—')}</div>
                    <div style="font-size:0.8rem;color:#94a3b8;margin-top:0.25rem;display:flex;align-items:center;gap:0.3rem;"><span class="extracted-svg" style="width:12px;height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/calendar.svg); mask-image: url(/assets/icons/calendar.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Class of ${__esc(q.graduation_month || '—')}/${__esc(q.graduation_year || '—')}</div>
                </td>
                <td style="padding:1.25rem 1rem;">
                    ${isActive ? '<span style="background:#6366f1;color:white;padding:0.3rem 0.8rem;border-radius:99px;font-size:0.65rem;font-weight:800;text-transform:uppercase;box-shadow:0 2px 6px rgba(99,102,241,0.2);">Active</span>' : '<span style="color:#94a3b8;font-size:0.75rem;font-weight:600;display:flex;align-items:center;gap:0.3rem;"><span class="extracted-svg" style="width:12px;height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/check-circle.svg); mask-image: url(/assets/icons/check-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Completed</span>'}
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
                <button type="button" class="sb-btn-edit" style="background:#6366f1;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.25);"><span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/plus.svg); mask-image: url(/assets/icons/plus.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Add New</button>
            </div>
            <div class="sb-view-mode">${historyHtml}</div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1.25rem;background:#f8fafc;padding:2rem;border-radius:1rem;border:1px solid #e2e8f0;">
                <div style="font-size:0.85rem;color:#1e1b4b;padding:1rem;background:#e0e7ff;border-radius:0.75rem;text-align:center;font-weight:600;border:1px solid #c7d2fe;">Note: Future-dated qualifications will be automatically marked as your primary active status.</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                    ${sbField('Highest Degree', 'highest_qualification', '')}
                    ${sbField('Field of Study', 'field_of_study', '')}
                    ${sbField('University / Institute', 'university', '')}
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        ${sbMonthSelect('Graduation Month', 'graduation_month', '')}
                        ${sbField('Graduation Year', 'graduation_year', '', 'number', false, (new Date().getFullYear() - 70), '2100')}
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

export function buildContactPanel(c) {
    const addressStr = [c.address_line_1, c.address_line_2, c.city, c.state, c.country_name, c.postal_code].filter(Boolean).join(', ') || '—';
    return `
        <div>
            <div class="sb-header-action" style="padding-bottom:1rem;border-bottom:1px solid #f1f5f9;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                <span class="sb-panel-title" style="font-weight:700;color:#64748b;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;">Current Details</span>
                <button type="button" class="sb-btn-edit" style="background:#6366f1;color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;transition:all 0.2s;box-shadow:0 2px 8px rgba(99,102,241,0.25);"><span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/edit-2.svg); mask-image: url(/assets/icons/edit-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Edit Details</button>
            </div>
            <div class="sb-view-mode" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;">
                <div class="sb-view-row"><span class="sb-view-label">Phone</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;font-size:1.1rem;">${__esc(c.phone_number || '—')}</span></div>
                <div class="sb-view-row"><span class="sb-view-label">Fax</span><span class="sb-view-value" style="font-weight:700;color:#1e293b;">${__esc(c.fax_number || '—')}</span></div>
                <div class="sb-view-row" style="grid-column:span 1;"><span class="sb-view-label">Address</span><span class="sb-view-value" style="line-height:1.5;color:#1e293b;font-weight:600;">${__esc(addressStr)}</span></div>
            </div>
            <div class="sb-panel-form" style="display:none;flex-direction:column;gap:1.25rem;background:#f8fafc;padding:1.5rem;border-radius:1rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    ${sbField('Phone', 'phone_number', c.phone_number, 'tel')}
                    ${sbField('Fax', 'fax_number', c.fax_number, 'tel')}
                    ${sbField('Address Line 1', 'address_line_1', c.address_line_1)}
                    ${sbField('Address Line 2', 'address_line_2', c.address_line_2)}
                    ${sbField('City', 'city', c.city)}
                    ${sbField('State / Province', 'state', c.state)}
                    ${sbField('Postcode', 'postal_code', c.postal_code)}
                    ${sbField('Country', 'country_name', c.country_name)}
                </div>
                <div class="sb-form-actions">
                    <span class="sb-save-feedback"></span>
                    <button type="button" class="sb-btn-save sb-btn-cancel-edit" style="background:#e2e8f0;border:none;color:#475569;padding:0.6rem 1.2rem;border-radius:0.5rem;font-weight:600;">Cancel</button>
                    <button id="sb-save-contact" class="sb-btn-save" style="background:#4f46e5;color:white;border:none;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;">Save Address</button>
                </div>
            </div>
        </div>`;
}

export function sbField(label, name, value, type = 'text', disabled = false, min = '', max = '') {
    const disabledAttr = disabled ? 'disabled' : '';
    const bg = disabled ? '#f1f5f9' : '#ffffff';
    const col = disabled ? '#94a3b8' : '#0f172a';
    const cur = disabled ? 'cursor:not-allowed;' : '';
    return `
        <div class="sb-field" style="margin-bottom:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label class="sb-field-label" style="color:#64748b;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.025em;margin-left:0.25rem;">${__esc(label)}</label>
            <input class="sb-field-input" 
                style="background:${bg};border:1.5px solid #e2e8f0;color:${col};${cur}padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.95rem;transition:all 0.2s;font-weight:500;" 
                type="${type}" name="${name}" value="${__esc(value ?? '')}" 
                min="${__esc(min)}" max="${__esc(max)}"
                ${disabledAttr} placeholder="${__esc(label)}…">
        </div>`;
}

export function sbSelect(label, name, current, options) {
    const opts = options.map(o => `<option value="${o.value}" ${String(current) === String(o.value) ? 'selected' : ''}>${o.label}</option>`).join('');
    return `
        <div class="sb-field" style="margin-bottom:0.5rem;display:flex;flex-direction:column;gap:0.4rem;">
            <label class="sb-field-label" style="color:#64748b;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.025em;margin-left:0.25rem;">${__esc(label)}</label>
            <select class="sb-field-input" style="background:#ffffff;border:1.5px solid #e2e8f0;color:#0f172a;padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.95rem;transition:all 0.2s;font-weight:500;" name="${name}">${opts}</select>
        </div>`;
}

export function sbMonthSelect(label, name, current) {
    const months = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];
    return sbSelect(label, name, current, months);
}

export function _wireProfileForms(app) {
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
            const editBtn = wrapper?.querySelector('.sb-btn-edit');
            if (viewMode && formMode) {
                formMode.style.display = 'none';
                viewMode.style.display = '';
                if (editBtn) editBtn.style.display = '';
            }
        });
    });

    _wireSave(app, 'sb-save-personal', ['title', 'first_name', 'middle_name', 'last_name', 'date_of_birth', 'gender'], API.PROFILE_UPDATE, 'PATCH');
    _wireSave(app, 'sb-save-qual', ['highest_qualification', 'field_of_study', 'university', 'graduation_year', 'graduation_month'], API.QUALIFICATION_ADD, 'POST');
    _wireSave(app, 'sb-save-contact', ['phone_number', 'fax_number', 'address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country_name'], API.PROFILE_UPDATE, 'PATCH');
}

export function _wireSave(app, btnId, fields, url, method) {
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
            const res = await authFetch(url, { method, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) throw new Error(Object.values(data.errors || {}).flat().join(' ') || data.message || 'Error');

            // Refresh _meData so the view reflects saved values
            const fresh = await authFetch(API.ME);
            if (fresh.ok) state.meData = await fresh.json();

            if (fb) { fb.textContent = '✓ Saved'; fb.className = 'sb-save-feedback sb-save-feedback--ok'; }
            setTimeout(() => renderProfile(document.getElementById('db-main-content')), 900);
        } catch (err) {
            if (fb) { fb.textContent = err.message; fb.className = 'sb-save-feedback sb-save-feedback--err'; }
        } finally {
            btn.textContent = original;
            btn.disabled = false;
            if (fb) setTimeout(() => { fb.textContent = ''; fb.className = 'sb-save-feedback'; }, 3500);
        }
    });
}
