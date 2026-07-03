import { __esc, _formatDate } from '../utils/helpers.js';

export function _buildProfileHtml(p, app) {
    const fullName = [p.title, p.first_name, p.last_name].filter(Boolean).join(' ') || p.email;
    const initials = [p.first_name, p.last_name].filter(Boolean).map(w => w[0]).join('').toUpperCase() || '?';

    const rows = [
        ['Email', p.email],
        ['Status', p.status],
        ['Gender', p.gender],
        ['Date of Birth', p.date_of_birth],
        ['Affiliated Institute', p.other_institute || p.institute_name],
        ['Designation', p.designation],
        ['Qualification', p.highest_qualification],
        ['Field of Study', p.field_of_study],
        ['University', p.university],
        ['Graduation Year', p.graduation_year],
        ['Country', p.country_name],
        ['City', p.city],
        ['Contact Number', p.phone_number],
    ].filter(([, v]) => v);

    return `
        ${p.duplicate_warnings && p.duplicate_warnings.matches.length > 0 ? `
            <div style="background: ${String(p.duplicate_warnings.risk_score?.risk || '').toUpperCase() === 'HIGH' ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${String(p.duplicate_warnings.risk_score?.risk || '').toUpperCase() === 'HIGH' ? '#fecaca' : '#fde68a'}; border-radius: 0.5rem; padding: 1rem; margin-top: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                    <div style="background: ${String(p.duplicate_warnings.risk_score?.risk || '').toUpperCase() === 'HIGH' ? '#ef4444' : '#f59e0b'}; color: white; padding: 4px; border-radius: 4px; flex-shrink: 0;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/upload.svg) no-repeat center; mask: url(/assets/icons/upload.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 800; color: ${String(p.duplicate_warnings.risk_score?.risk || '').toUpperCase() === 'HIGH' ? '#991b1b' : '#92400e'}; font-size: 0.9rem; margin-bottom: 0.25rem;">
                            Identity Warning: Potential Duplicate profile RISK
                        </div>
                        <div style="font-size: 0.8rem; color: ${p.duplicate_warnings.risk_score === 'HIGH' ? '#b91c1c' : '#b45309'}; line-height: 1.4; margin-bottom: 0.75rem;">
                            ${p.duplicate_warnings.matches.length} similar profiles found. Please verify identity before proceeding.
                        </div>
                        <button
                            id="rm-compare-identity-btn"
                            data-matches='${__esc(JSON.stringify(p.duplicate_warnings.matches))}'
                            style="display:inline-flex; align-items:center; gap:6px; background:#7c3aed; color:white; border:none; border-radius:6px; padding:0.45rem 1rem; font-size:0.8rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(124,58,237,0.25); transition: background 0.2s;"
                            onmouseover="this.style.background='#6d28d9'" onmouseout="this.style.background='#7c3aed'">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_50.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_50.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
                            Compare Identity
                        </button>
                    </div>
                </div>
            </div>
        ` : ''}

        <div class="rm-profile-avatar">${__esc(initials)}</div>
        <h3 class="rm-profile-name">${__esc(fullName)}</h3>
        <dl class="rm-profile-dl">
            ${rows.map(([label, value]) => `
                <div class="rm-dl-row">
                    <dt>${__esc(label)}</dt>
                    <dd>${__esc(String(value))}</dd>
                </div>`).join('')}
        </dl>
        ${p.id_card_path && app.request_name !== 'Modify Affiliation' ? `
            <div style="margin-top: 1.5rem;">
                ${app.id_card_approved_by ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: #065f46; display: flex; align-items: flex-start; gap: 0.6rem;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_51.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_51.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block; margin-top: 2px; flex-shrink: 0;"></span>
                        <div>
                            <strong style="display:block; font-size:0.85rem; margin-bottom:2px;">Identity Verified</strong>
                            <span style="opacity: 0.85;">by ${__esc(app.id_card_approved_by_name || 'Supervisor')} (${__esc(app.id_card_approved_by_role || 'Role')})</span><br>
                            <span style="opacity: 0.75; font-size: 0.75rem;">${app.id_card_approved_at ? new Date(app.id_card_approved_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                    </div>
                ` : ''}
                <button class="rm-identity-btn" id="rm-identity-btn" style="width: 100%; background: ${app.id_card_approved_by ? '#10b981' : 'var(--primary-600)'}; color: white; border: none; box-shadow: var(--shadow-sm); transition: background 0.2s;">
                    <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/credit-card.svg) no-repeat center; mask: url(/assets/icons/credit-card.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block; margin-right:8px;"></span>
                    ${app.id_card_approved_by ? 'View Verified ID Card' : 'View Identity Card'}
                </button>
            </div>
        ` : ''}
    `;
}



export function _buildProfileFallback(app) {
    const rows = [
        ['Name', app.applicant_name],
        ['Email', app.applicant_email],
        ['Request', app.request_name],
        ['Status', app.current_status],
    ].filter(([, v]) => v);

    return `
        <div class="rm-profile-avatar">${__esc((app.applicant_name || '?')[0].toUpperCase())}</div>
        <h3 class="rm-profile-name">${__esc(app.applicant_name || app.applicant_email || '—')}</h3>
        <dl class="rm-profile-dl">
            ${rows.map(([label, value]) => `
                <div class="rm-dl-row">
                    <dt>${__esc(label)}</dt>
                    <dd>${__esc(String(value))}</dd>
                </div>`).join('')}
        </dl>
        ${app.id_card_path ? `
            <div style="margin-top: 1.5rem;">
                ${app.is_id_approved ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: #065f46; display: flex; align-items: flex-start; gap: 0.6rem;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_51.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_51.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block; margin-top: 2px; flex-shrink: 0;"></span>
                        <div>
                            <strong style="display:block; font-size:0.85rem; margin-bottom:2px;">Identity Verified</strong>
                            <span style="opacity: 0.85;">by ${__esc(app.id_card_approved_by_name || 'Supervisor')} (${__esc(app.id_card_approved_by_role || 'Role')})</span><br>
                            <span style="opacity: 0.75; font-size: 0.75rem;">${app.id_card_approved_at ? new Date(app.id_card_approved_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                    </div>
                ` : ''}
                <button class="rm-identity-btn" id="rm-identity-btn" style="width: 100%; background: ${app.is_id_approved ? '#10b981' : 'var(--primary-600)'}; color: white; border: none; box-shadow: var(--shadow-sm); transition: background 0.2s;">
                    <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/credit-card.svg) no-repeat center; mask: url(/assets/icons/credit-card.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block; margin-right:8px;"></span>
                    ${app.is_id_approved ? 'View Verified ID Card' : 'View Identity Card'}
                </button>
            </div>
        ` : ''}
    `;
}
