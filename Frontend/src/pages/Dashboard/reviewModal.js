import { authFetch } from '../../utils/auth.js';
import { API } from '../../config/api.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _modal     = null;
let _onSuccess = null;
let _currentApp = null;

// Cache fetched data so we don't re-fetch on every open
let _servicesCache = null;
let _subsystemLeadsCache = null;
let _systemLeadsCache = null;

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Open the review modal for a given application.
 * @param {object} app       - Application data from /api/auth/review/applications
 * @param {Function} onSuccess - Called after a successful approve/reject
 */
export function openReviewModal(app, onSuccess) {
    _onSuccess  = onSuccess;
    _currentApp = app;
    _ensureModal();
    _modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    _loadModalData(app);
}

// ── Build static modal shell once and cache ───────────────────────────────────
function _ensureModal() {
    if (_modal) return;

    _modal = document.createElement('div');
    _modal.className = 'rm-overlay';
    _modal.id = 'rm-overlay';
    _modal.innerHTML = `
        <div class="rm-dialog" role="dialog" aria-modal="true" aria-labelledby="rm-title">

            <!-- LEFT: Previous Recommendations (Hidden by default) -->
            <div class="rm-prev" id="rm-prev-col" style="display: none;">
                <div class="rm-prev-header">
                    <h2 class="rm-title" style="font-size: 1.1rem; color: #64748b;">
                        <span class="rm-title-icon" style="font-size: 1.1rem;">🕒</span>
                        Past Recommendations
                    </h2>
                </div>
                <div class="rm-form-body" id="rm-prev-body" style="background: #f8fafc; padding-top: 1rem;">
                    <!-- Injected by JS -->
                </div>
            </div>

            <!-- MIDDLE: Review Form -->
            <div class="rm-left">
                <div class="rm-left-header">
                    <h2 id="rm-title" class="rm-title">
                        <span class="rm-title-icon">📋</span>
                        Review Application
                    </h2>
                    <p class="rm-subtitle" id="rm-subtitle">Loading…</p>
                </div>

                <div class="rm-form-body">

                    <!-- LIGO Member toggle -->
                    <div class="rm-field-group">
                        <label class="rm-label">Is the applicant an official LIGO Member?</label>
                        <div class="rm-radio-group">
                            <label class="rm-radio-label">
                                <input type="radio" name="ligo_member" id="ligo-yes" value="yes">
                                <span class="rm-radio-chip">Yes</span>
                            </label>
                            <label class="rm-radio-label">
                                <input type="radio" name="ligo_member" id="ligo-no" value="no" checked>
                                <span class="rm-radio-chip">No</span>
                            </label>
                        </div>
                    </div>

                    <!-- Subsystem Lead assignment -->
                    <div class="rm-field-group">
                        <label class="rm-label" for="rm-subsystem-lead">
                            Assign Subsystem Lead
                            <span class="rm-label-hint">for assessment</span>
                        </label>
                        <select id="rm-subsystem-lead" class="rm-select">
                            <option value="">— Auto-Assign Any Available —</option>
                        </select>
                    </div>

                    <!-- System Lead assignment -->
                    <div class="rm-field-group">
                        <label class="rm-label" for="rm-system-lead">
                            Assign System Lead
                            <span class="rm-label-hint">for final clearance</span>
                        </label>
                        <select id="rm-system-lead" class="rm-select">
                            <option value="">— Auto-Assign Any Available —</option>
                        </select>
                    </div>

                    <!-- Services & Subservices picker -->
                    <div class="rm-field-group">
                        <div class="rm-services-header">
                            <label class="rm-label" style="margin:0;">
                                Assign Local IT Services &amp; Hardware
                            </label>
                            <label class="rm-select-all-label" id="rm-select-all-wrap">
                                <input type="checkbox" id="rm-select-all">
                                <span>Select All</span>
                            </label>
                        </div>
                        <div class="rm-services-list" id="rm-services-list">
                            <div class="rm-loading-inline"><div class="spinner"></div> Loading services…</div>
                        </div>
                    </div>

                    <!-- Remarks -->
                    <div class="rm-field-group">
                        <label class="rm-label" for="rm-remarks">
                            Remarks
                            <span class="rm-label-hint">optional</span>
                        </label>
                        <textarea id="rm-remarks" class="rm-textarea" rows="3"
                            placeholder="Add a note for the applicant or audit log…"></textarea>
                    </div>

                    <!-- Feedback -->
                    <div id="rm-feedback" class="rm-feedback" style="display:none;"></div>

                </div><!-- /rm-form-body -->

                <!-- Footer actions -->
                <div class="rm-footer">
                    <button id="rm-cancel-btn" class="btn rm-btn-cancel">Cancel</button>
                    <button id="rm-reject-btn" class="btn rm-btn-reject">✕ Reject</button>
                    <button id="rm-approve-btn" class="btn rm-btn-approve">✓ Recommend to Next Level</button>
                </div>
            </div>

            <!-- RIGHT: Applicant Profile -->
            <div class="rm-right">
                <div class="rm-right-header">
                    <h3 class="rm-right-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        Applicant Profile
                    </h3>
                    <button id="rm-close-btn" class="rm-close-btn" aria-label="Close">✕</button>
                </div>

                <div id="rm-profile-body" class="rm-profile-body">
                    <div class="rm-loading-inline"><div class="spinner"></div></div>
                </div>
            </div>
            </div>
        </div>
        
        <!-- ID Card Preview Overlay -->
        <div class="rm-id-preview-overlay" id="rm-id-preview">
            <div class="rm-id-preview-card">
                <img src="" alt="ID Document" class="rm-id-preview-img" id="rm-id-preview-img">
                <button class="btn rm-btn-cancel" id="rm-id-preview-close">Close Preview</button>
            </div>
        </div>`;

    document.body.appendChild(_modal);

    // Wire close behaviours
    _modal.querySelector('#rm-close-btn').addEventListener('click', _close);
    _modal.querySelector('#rm-cancel-btn').addEventListener('click', _close);
    _modal.addEventListener('click', (e) => { if (e.target === _modal) _close(); });
    
    const idPreview = _modal.querySelector('#rm-id-preview');
    _modal.querySelector('#rm-id-preview-close').addEventListener('click', () => idPreview.classList.remove('open'));
    idPreview.addEventListener('click', (e) => { if (e.target === idPreview) idPreview.classList.remove('open'); });

    document.addEventListener('keydown', (e) => { 
        if (e.key === 'Escape') {
            if (idPreview.classList.contains('open')) idPreview.classList.remove('open');
            else _close(); 
        }
    });

    // Wire action buttons
    _modal.querySelector('#rm-approve-btn').addEventListener('click', () => _submitDecision('approve'));
    _modal.querySelector('#rm-reject-btn').addEventListener('click',  () => _submitDecision('reject'));

    // Select-All checkbox
    _modal.querySelector('#rm-select-all').addEventListener('change', _handleSelectAll);
}

// ── Load all dynamic data for a given application ─────────────────────────────
async function _loadModalData(app) {
    // Reset form state
    _modal.querySelector('#rm-remarks').value = '';
    
    // Handle LIGO Member flag
    const ligoWrap = _modal.querySelector('#ligo-yes').closest('.rm-field-group');
    if (app.ligo_member) {
        ligoWrap.innerHTML = `
            <label class="rm-label">Is the applicant an official LIGO Member?</label>
            <div class="rm-radio-group">
                <span class="rm-radio-chip" style="border-color: #6366f1; background: #eef2ff; color: #4338ca; cursor: default;">
                    ${app.ligo_member.toUpperCase()}
                </span>
            </div>
            <input type="hidden" name="ligo_member" value="${app.ligo_member}">
        `;
    } else {
        ligoWrap.innerHTML = `
            <label class="rm-label">Is the applicant an official LIGO Member?</label>
            <div class="rm-radio-group">
                <label class="rm-radio-label">
                    <input type="radio" name="ligo_member" id="ligo-yes" value="yes">
                    <span class="rm-radio-chip">Yes</span>
                </label>
                <label class="rm-radio-label">
                    <input type="radio" name="ligo_member" id="ligo-no" value="no" checked>
                    <span class="rm-radio-chip">No</span>
                </label>
            </div>
        `;
    }

    _hideFeedback();
    
    // Status-based Footer Rendering
    const footer = _modal.querySelector('.rm-footer');
    const existingBanner = _modal.querySelector('.rm-status-banner');
    if (existingBanner) existingBanner.remove();

    if (app.status === 'awaiting_response') {
        _setButtonsEnabled(false);
        footer.style.display = 'none';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-warning" style="padding:1rem; background:#fffbeb; color:#92400e; font-weight:bold; margin-bottom:1rem; border:1px solid #fde68a;">Awaiting response from applicant. Action disabled.</div>`);
    } else if (app.status === 'approved') {
        _setButtonsEnabled(false);
        footer.style.display = 'none';
        const dateStr = app.approved_at ? new Date(app.approved_at).toLocaleString('en-GB') : 'Unknown Time';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-success" style="padding:1rem; background:#f0fdf4; color:#166534; font-weight:bold; margin-bottom:1rem; border:1px solid #bbf7d0;">Approved by: ${escHtml(app.approved_by_name || 'System')}<br>Approved at: ${escHtml(dateStr)}</div>`);
    } else if (app.status === 'rejected') {
        _setButtonsEnabled(false);
        footer.style.display = 'none';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-error" style="padding:1rem; background:#fef2f2; color:#991b1b; font-weight:bold; margin-bottom:1rem; border:1px solid #fecaca;">This application has been rejected.</div>`);
    } else {
        footer.style.display = 'flex';
        _setButtonsEnabled(true);
    }

    // Update subtitle with applicant name + step
    _modal.querySelector('#rm-subtitle').textContent =
        `${app.applicant_name || app.applicant_email} · ${app.current_status || app.workflow_name}`;

    // Load three things in parallel
    await Promise.all([
        _loadApplicantProfile(app.applicant_email),
        _loadStaffDropdowns(),
        _loadServices(),
    ]);
}

function _renderPastRecommendations(app, services) {
    const prevCol = _modal.querySelector('#rm-prev-col');
    const prevBody = _modal.querySelector('#rm-prev-body');
    const pastSvc = app.recommended_service_ids || [];
    const pastSub = app.recommended_subservice_ids || [];
    
    // If no past recommendations at all, hide the column
    if (pastSvc.length === 0 && pastSub.length === 0) {
        prevCol.style.display = 'none';
        return;
    }

    prevCol.style.display = 'flex';
    let html = '';

    const svcMap = {};
    const subMap = {};
    services.forEach(s => {
        svcMap[String(s.id)] = s.name;
        if (s.subservices) {
            s.subservices.forEach(sub => subMap[String(sub.id)] = sub.name);
        }
    });

    if (pastSvc.length > 0) {
        html += `<h4 style="font-size: 0.85rem; color: #475569; margin-bottom: 0.5rem;">Services</h4>`;
        html += `<ul style="list-style: none; padding: 0; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;">`;
        pastSvc.forEach(id => {
            html += `<li style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span style="color: #6366f1;">✔</span> ${escHtml(svcMap[String(id)] || 'Unknown Service')}
                     </li>`;
        });
        html += `</ul>`;
    }

    if (pastSub.length > 0) {
        html += `<h4 style="font-size: 0.85rem; color: #475569; margin-bottom: 0.5rem;">Sub-services</h4>`;
        html += `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.4rem;">`;
        pastSub.forEach(id => {
            html += `<li style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span style="color: #6366f1;">✔</span> ${escHtml(subMap[String(id)] || 'Unknown Sub-service')}
                     </li>`;
        });
        html += `</ul>`;
    }

    prevBody.innerHTML = html;
}

// ── RIGHT PANEL: Applicant profile ────────────────────────────────────────────
async function _loadApplicantProfile(applicantEmail) {
    const body = _modal.querySelector('#rm-profile-body');
    body.innerHTML = `<div class="rm-loading-inline"><div class="spinner"></div></div>`;

    // Resolve user_id from the app object (we stored it in app.user_id via the backend)
    // We look up the applicant by email as a fallback if user_id isn't available
    const app = _currentApp;
    const userId = app.applicant_user_id || app.user_id;

    if (!userId) {
        body.innerHTML = _buildProfileFallback(app);
        return;
    }

    try {
        const res = await authFetch(API.APPLICANT_PROFILE(userId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const p = await res.json();
        body.innerHTML = _buildProfileHtml(p);
        
        // Wire up ID card preview if path exists
        if (p.id_card_path) {
            const btn = body.querySelector('#rm-identity-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    const preview = _modal.querySelector('#rm-id-preview');
                    const img = preview.querySelector('#rm-id-preview-img');
                    // Ensure the backend serves from storage. Replace with actual storage route prefix.
                    img.src = `${API.url('/storage/' + p.id_card_path)}`;
                    preview.classList.add('open');
                });
            }
        }
    } catch (_) {
        body.innerHTML = _buildProfileFallback(app);
    }
}

function _buildProfileHtml(p) {
    const fullName = [p.title, p.first_name, p.last_name].filter(Boolean).join(' ') || p.email;
    const initials = [p.first_name, p.last_name].filter(Boolean).map(w => w[0]).join('').toUpperCase() || '?';

    const rows = [
        ['Email',            p.email],
        ['Status',           p.status],
        ['Gender',           p.gender],
        ['Date of Birth',    p.date_of_birth],
        ['Institute',        p.institute_name],
        ['Designation',      p.designation],
        ['Qualification',    p.highest_qualification],
        ['Field of Study',   p.field_of_study],
        ['University',       p.university],
        ['Graduation Year',  p.graduation_year],
        ['Country',          p.country_name],
        ['City',             p.city],
        ['Phone',            p.phone_number],
    ].filter(([, v]) => v);

    return `
        <div class="rm-profile-avatar">${escHtml(initials)}</div>
        <h3 class="rm-profile-name">${escHtml(fullName)}</h3>
        <dl class="rm-profile-dl">
            ${rows.map(([label, value]) => `
                <div class="rm-dl-row">
                    <dt>${escHtml(label)}</dt>
                    <dd>${escHtml(String(value))}</dd>
                </div>`).join('')}
        </dl>
        ${p.id_card_path ? `
            <button class="rm-identity-btn" id="rm-identity-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><circle cx="8.5" cy="11.5" r="2.5"/><path d="M12 16c0-1.7-1.3-3-3-3s-3 1.3-3 3"/><path d="M15 10h5M15 14h5"/></svg>
                Check Identity
            </button>
        ` : ''}`;
}

function _buildProfileFallback(app) {
    const rows = [
        ['Name',    app.applicant_name],
        ['Email',   app.applicant_email],
        ['Request', app.request_name],
        ['Status',  app.current_status],
    ].filter(([, v]) => v);

    return `
        <div class="rm-profile-avatar">${escHtml((app.applicant_name || '?')[0].toUpperCase())}</div>
        <h3 class="rm-profile-name">${escHtml(app.applicant_name || app.applicant_email || '—')}</h3>
        <dl class="rm-profile-dl">
            ${rows.map(([label, value]) => `
                <div class="rm-dl-row">
                    <dt>${escHtml(label)}</dt>
                    <dd>${escHtml(String(value))}</dd>
                </div>`).join('')}
        </dl>`;
}

// ── Staff dropdowns ───────────────────────────────────────────────────────────
async function _loadStaffDropdowns() {
    // Load both in parallel; use cache on repeated opens
    const [subsystemLeads, systemLeads] = await Promise.all([
        _subsystemLeadsCache
            ? Promise.resolve(_subsystemLeadsCache)
            : authFetch(API.REVIEW_STAFF('subsystem_lead')).then(r => r.json()).then(d => (_subsystemLeadsCache = d)),
        _systemLeadsCache
            ? Promise.resolve(_systemLeadsCache)
            : authFetch(API.REVIEW_STAFF('system_lead')).then(r => r.json()).then(d => (_systemLeadsCache = d)),
    ]);

    _populateSelect('rm-subsystem-lead', subsystemLeads);
    _populateSelect('rm-system-lead',    systemLeads);
}

function _populateSelect(id, staff) {
    const sel = _modal.querySelector(`#${id}`);
    if (!sel) return;

    // Keep the default "auto-assign" option, replace the rest
    sel.innerHTML = `<option value="">— Auto-Assign Any Available —</option>`;
    (staff || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.email})`;
        sel.appendChild(opt);
    });
}

// ── Services + Subservices picker ─────────────────────────────────────────────
async function _loadServices() {
    const list = _modal.querySelector('#rm-services-list');
    list.innerHTML = `<div class="rm-loading-inline"><div class="spinner"></div> Loading services…</div>`;

    try {
        if (!_servicesCache) {
            const res = await authFetch(API.REVIEW_SERVICES);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _servicesCache = await res.json();
        }
        list.innerHTML = _buildServicesHtml(_servicesCache);
        _wireServiceCheckboxes();
        _renderPastRecommendations(_currentApp, _servicesCache);
    } catch (err) {
        list.innerHTML = `<p class="rm-error-inline">Could not load services: ${escHtml(err.message)}</p>`;
    }
}

function _buildServicesHtml(services) {
    if (!services || services.length === 0) {
        return `<p class="rm-empty-services">No services configured yet.</p>`;
    }

    return services.map(svc => {
        const hasSubservices = svc.subservices && svc.subservices.length > 0;
        const subHtml = hasSubservices
            ? svc.subservices.map(sub => `
                <label class="rm-subservice-label">
                    <input type="checkbox" class="rm-sub-cb"
                           data-service-id="${svc.id}"
                           data-subservice-id="${sub.id}"
                           name="subservice[]"
                           value="${sub.id}">
                    <span class="rm-cb-custom"></span>
                    <span class="rm-sub-name">${escHtml(sub.name)}</span>
                </label>`).join('')
            : `<p class="rm-no-subs">No sub-services available.</p>`;

        return `
            <div class="rm-service-block" id="svc-block-${svc.id}">
                <label class="rm-service-label">
                    <input type="checkbox" class="rm-svc-cb"
                           data-service-id="${svc.id}"
                           name="service[]"
                           value="${svc.id}"
                           ${hasSubservices ? '' : 'disabled'}>
                    <span class="rm-cb-custom rm-cb-service"></span>
                    <div class="rm-svc-info">
                        <span class="rm-svc-name">${escHtml(svc.name)}</span>
                        <span class="rm-svc-code">${escHtml(svc.code)}</span>
                    </div>
                </label>
                <div class="rm-subservices" id="svc-subs-${svc.id}">
                    ${subHtml}
                </div>
            </div>`;
    }).join('');
}

/** Clicking a service checkbox → checks/unchecks all its subservices */
function _wireServiceCheckboxes() {
    const list = _modal.querySelector('#rm-services-list');

    list.querySelectorAll('.rm-svc-cb').forEach(svcCb => {
        svcCb.addEventListener('change', () => {
            const svcId = svcCb.dataset.serviceId;
            list.querySelectorAll(`.rm-sub-cb[data-service-id="${svcId}"]`)
                .forEach(sub => { sub.checked = svcCb.checked; });
            _syncSelectAll();
        });
    });

    list.querySelectorAll('.rm-sub-cb').forEach(subCb => {
        subCb.addEventListener('change', () => {
            const svcId  = subCb.dataset.serviceId;
            const svcCb  = list.querySelector(`.rm-svc-cb[data-service-id="${svcId}"]`);
            const allSubs = [...list.querySelectorAll(`.rm-sub-cb[data-service-id="${svcId}"]`)];
            if (svcCb) svcCb.checked = allSubs.every(s => s.checked);
            _syncSelectAll();
        });
    });
}

function _handleSelectAll(e) {
    const checked = e.target.checked;
    _modal.querySelectorAll('.rm-svc-cb:not(:disabled), .rm-sub-cb')
        .forEach(cb => { cb.checked = checked; });
}

function _syncSelectAll() {
    const all     = [..._modal.querySelectorAll('.rm-sub-cb')];
    const checked = all.filter(cb => cb.checked);
    const selAll  = _modal.querySelector('#rm-select-all');
    if (selAll) selAll.checked = all.length > 0 && checked.length === all.length;
}

// ── Submit decision ───────────────────────────────────────────────────────────
async function _submitDecision(action) {
    _hideFeedback();
    _setButtonsEnabled(false);

    const approveBtn = _modal.querySelector('#rm-approve-btn');
    const rejectBtn  = _modal.querySelector('#rm-reject-btn');
    approveBtn.textContent = action === 'approve' ? '…Recommending' : '✓ Recommend to Next Level';
    rejectBtn.textContent  = action === 'reject'  ? '…Rejecting'    : '✕ Reject';

    // Collect selected services & subservices
    const selectedSubservices = [..._modal.querySelectorAll('.rm-sub-cb:checked')].map(cb => cb.value);
    const selectedServices    = [..._modal.querySelectorAll('.rm-svc-cb:checked')].map(cb => cb.value);
    const ligoMember = _modal.querySelector('input[name="ligo_member"]:checked')?.value ?? 'no';
    const subsystemLead = _modal.querySelector('#rm-subsystem-lead')?.value || null;
    const systemLead    = _modal.querySelector('#rm-system-lead')?.value    || null;
    const remarks       = _modal.querySelector('#rm-remarks').value.trim();

    try {
        const res = await authFetch(API.DECIDE(_currentApp.id), {
            method: 'POST',
            body: JSON.stringify({
                action,
                remarks:            remarks || undefined,
                ligo_member:        ligoMember,
                subsystem_lead_id:  subsystemLead || undefined,
                system_lead_id:     systemLead    || undefined,
                service_ids:        selectedServices,
                subservice_ids:     selectedSubservices,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        _showFeedback(data.message || 'Done!', 'success');
        setTimeout(() => {
            _close();
            if (_onSuccess) _onSuccess();
        }, 1400);

    } catch (err) {
        _showFeedback(err.message || 'Something went wrong.', 'error');
        _setButtonsEnabled(true);
        approveBtn.textContent = '✓ Recommend to Next Level';
        rejectBtn.textContent  = '✕ Reject';
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _close() {
    if (!_modal) return;
    _modal.classList.remove('open');
    document.body.style.overflow = '';
    _hideFeedback();
}

function _setButtonsEnabled(enabled) {
    ['#rm-approve-btn', '#rm-reject-btn'].forEach(sel => {
        const btn = _modal?.querySelector(sel);
        if (btn) btn.disabled = !enabled;
    });
}

function _showFeedback(msg, type) {
    const el = _modal.querySelector('#rm-feedback');
    el.textContent = msg;
    el.className = `rm-feedback rm-feedback--${type}`;
    el.style.display = 'block';
}

function _hideFeedback() {
    const el = _modal?.querySelector('#rm-feedback');
    if (el) el.style.display = 'none';
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
