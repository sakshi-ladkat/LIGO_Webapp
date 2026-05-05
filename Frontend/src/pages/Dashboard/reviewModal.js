import { authFetch } from '../../utils/auth.js';
import { API } from '../../config/api.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _modal     = null;
let _onSuccess = null;
let _currentApp = null;

// Cache fetched data so we don't re-fetch on every open
let _servicesCache = null;
let _subsystemsCache = null;

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
                    <h2 class="rm-title" style="font-size: 1.1rem; color: #64748b; display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
                    <h2 id="rm-title" class="rm-title" style="display: flex; align-items: center; gap: 8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                        Review Application
                    </h2>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <p class="rm-subtitle" id="rm-subtitle">Loading…</p>
                        <div id="rm-header-actions"></div>
                    </div>
                </div>

                <div class="rm-form-body">

                    <!-- LIGO Member toggle -->
                    <div class="rm-field-group" id="rm-ligo-group">
                        <label class="rm-label">Is the applicant an official LIGO Member?</label>
                        <div style="display:flex; align-items:center; gap:1rem;">
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
                            <button id="rm-ligo-confirm-btn" class="btn" style="background:#6366f1; color:white; border:none; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:700; font-size:0.8rem; cursor:pointer; box-shadow:0 2px 8px rgba(99,102,241,0.2); transition:all 0.2s; white-space:nowrap;">Confirm Status</button>
                        </div>
                    </div>

                    <!-- Duration -->
                    <div class="rm-field-group" id="rm-duration-group">
                        <label class="rm-label" for="rm-duration">
                            Account Duration
                            <span class="rm-label-hint" style="color: var(--error);">*</span>
                        </label>
                        <select id="rm-duration" class="rm-select">
                            <option value="2 weeks">2 weeks</option>
                            <option value="1 month">1 month</option>
                            <option value="3 months">3 months</option>
                            <option value="6 months">6 months</option>
                            <option value="1 year" selected>1 year</option>
                        </select>
                    </div>

                    <!-- Subsystem selection -->
                    <div class="rm-field-group" id="rm-subsystem-group">
                        <label class="rm-label" for="rm-subsystem">
                            Assign Subsystem
                            <span class="rm-label-hint" style="color: var(--error);">*</span>
                        </label>
                        <select id="rm-subsystem" class="rm-select">
                            <option value="">-- Select Subsystem --</option>
                        </select>
                    </div>

                    <!-- System (Auto-fetched) -->
                    <div class="rm-field-group" id="rm-system-group">
                        <label class="rm-label" for="rm-system-name">Assigned System</label>
                        <input type="text" id="rm-system-name" class="rm-select" disabled style="background: #f1f5f9; border: 1.5px solid #e2e8f0; color: #475569; font-weight: 500; cursor: not-allowed;" placeholder="Select a subsystem first...">
                        <input type="hidden" id="rm-system-id">
                    </div>

                    <!-- Services & Subservices picker -->
                    <div class="rm-field-group">
                        <div class="rm-services-header">
                            <label class="rm-label" style="margin:0;">
                                Assign Services
                            </label>
                            <label class="rm-select-all-label" id="rm-select-all-wrap">
                                <input type="checkbox" id="rm-select-all">
                                <span>Select All</span>
                            </label>
                        </div>
                        <div class="rm-services-list" id="rm-services-list">
                            <div style="padding:2rem; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:0.75rem; color:#64748b; font-size:0.9rem;">
                                <i data-feather="lock" style="width:16px; height:16px; display:block; margin:0 auto 0.5rem; opacity:0.5;"></i>
                                Please confirm <strong>LIGO Membership</strong> above to view eligible services.
                            </div>
                        </div>
                    </div>

                    <!-- Remarks -->
                    <div class="rm-field-group">
                        <label class="rm-label" for="rm-remarks">
                            Comments
                            <span class="rm-label-hint">optional</span>
                        </label>
                        <textarea id="rm-remarks" class="rm-textarea" rows="3"
                            placeholder="Add a note for the applicant or audit log…"></textarea>
                    </div>

                    <!-- Pending Reviews Accordion -->
                    <div class="rm-field-group" id="rm-pending-reviews-section" style="display:none; margin-top: 1.5rem;">
                        <details class="rm-pending-accordion" style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 0.75rem; overflow: hidden;">
                            <summary style="padding: 1rem 1.25rem; font-size: 0.9rem; font-weight: 700; color: #78350f; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; background: #fef9e7; border-bottom: 2px solid #f59e0b; list-style: none; user-select: none;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>Pending Reviews for This Applicant</span>
                                <span id="rm-pending-count" style="margin-left: auto; background: #f59e0b; color: white; padding: 2px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 800; min-width: 28px; text-align: center;">0</span>
                            </summary>
                            <div id="rm-pending-body" style="padding: 1.25rem; background: white; display: flex; flex-direction: column; gap: 1rem;">
                                <div class="rm-loading-inline"><div class="spinner"></div> Loading pending reviews…</div>
                            </div>
                        </details>
                    </div>

                    <!-- Feedback -->
                    <div id="rm-feedback" class="rm-feedback" style="display:none;"></div>

                </div><!-- /rm-form-body -->

                <!-- Footer actions -->
                <div class="rm-footer">
                    <button id="rm-cancel-btn" class="btn rm-btn-cancel">Cancel</button>
                    <button id="rm-reject-btn" class="btn rm-btn-reject" style="display: flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Decline
                    </button>
                    <button id="rm-approve-btn" class="btn rm-btn-approve" style="display: flex; align-items: center; gap: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Recommend to Next Level
                    </button>
                </div>
            </div>

            <!-- RIGHT: Applicant Profile -->
            <div class="rm-right" style="display: flex; flex-direction: column; min-width: 400px; width: 400px;">
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
                <div style="display:flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
                    <button class="btn rm-btn-cancel" id="rm-id-preview-close" style="min-width: 120px;">Close Preview</button>
                    <button class="btn rm-btn-approve" id="rm-id-preview-approve" style="display:none; min-width: 150px;">Approve ID Card</button>
                </div>
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

    // Wire Ligo Member status change
    _modal.querySelector('#rm-ligo-confirm-btn').addEventListener('click', (e) => {
        const val = _modal.querySelector('input[name="ligo_member"]:checked')?.value;
        _handleLigoConfirm(val, e.target);
    });
}

// ── Load all dynamic data for a given application ─────────────────────────────
async function _loadModalData(app) {
    _currentApp = app;
    
    // Reset form state
    _modal.querySelector('#rm-remarks').value = '';

    // 1. Inject Check Identity button into header if available
    const headerActions = _modal.querySelector('#rm-header-actions');
    headerActions.innerHTML = '';

    
    // Handle LIGO Member flag
    const ligoGroup = _modal.querySelector('#rm-ligo-group');
    const shouldDisableLigo = app.ligo_member && app.role_slug !== 'supervisor';

    if (shouldDisableLigo) {
        // Premium badge display for read-only LIGO status
        const isLigo = app.ligo_member === 'yes';
        ligoGroup.innerHTML = `
            <label class="rm-label">Is the applicant an official LIGO Member?</label>
            <div class="rm-badge-ligo ${isLigo ? 'rm-badge-ligo--yes' : 'rm-badge-ligo--no'}" style="margin-top: 0.25rem;">
                ${isLigo 
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Official LIGO Member`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Non-LIGO Applicant`
                }
            </div>
            <input type="hidden" name="ligo_member" value="${app.ligo_member}">
        `;
    } else {
        // Restore standard radio buttons for supervisor
        ligoGroup.innerHTML = `
            <label class="rm-label">Is the applicant an official LIGO Member?</label>
            <div style="display:flex; align-items:center; gap:1rem; margin-top: 0.5rem;">
                <div class="rm-radio-group">
                    <label class="rm-radio-label">
                        <input type="radio" name="ligo_member" id="ligo-yes" value="yes" ${app.ligo_member === 'yes' ? 'checked' : ''}>
                        <span class="rm-radio-chip">Yes</span>
                    </label>
                    <label class="rm-radio-label">
                        <input type="radio" name="ligo_member" id="ligo-no" value="no" ${app.ligo_member !== 'yes' ? 'checked' : ''}>
                        <span class="rm-radio-chip">No</span>
                    </label>
                </div>
                <button id="rm-ligo-confirm-btn" class="btn" style="background:#6366f1; color:white; border:none; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:700; font-size:0.8rem; cursor:pointer; box-shadow:0 2px 8px rgba(99,102,241,0.2); transition:all 0.2s; white-space:nowrap;">Confirm Status</button>
            </div>
        `;
        
        // RE-WIRE the button because innerHTML destroyed previous listener
        ligoGroup.querySelector('#rm-ligo-confirm-btn').addEventListener('click', (e) => {
            const val = ligoGroup.querySelector('input[name="ligo_member"]:checked')?.value;
            _handleLigoConfirm(val, e.target);
        });
    }

    // Handle Duration (Keep editable for refined review)
    const durationWrap = _modal.querySelector('#rm-duration-group');
    durationWrap.innerHTML = `
        <label class="rm-label" for="rm-duration">
            Account Duration
            <span class="rm-label-hint" style="color: var(--error);">*</span>
        </label>
        <select id="rm-duration" name="duration" class="rm-select">
            <option value="" disabled ${!app.duration ? 'selected' : ''}>-- Select Duration --</option>
            <option value="2 weeks"  ${app.duration === '2 weeks'  ? 'selected' : ''}>2 weeks</option>
            <option value="1 month"  ${app.duration === '1 month'  ? 'selected' : ''}>1 month</option>
            <option value="3 months" ${app.duration === '3 months' ? 'selected' : ''}>3 months</option>
            <option value="6 months" ${app.duration === '6 months' ? 'selected' : ''}>6 months</option>
            <option value="1 year"   ${app.duration === '1 year' || (!app.duration) ? 'selected' : ''}>1 year</option>
        </select>
    `;

    // Handle Assignments visibility based on role
    const subGrp = _modal.querySelector('#rm-subsystem-group');
    const sysGrp = _modal.querySelector('#rm-system-group');
    
    // First authority (supervisor) must assign subsystem
    if (app.role_slug === 'supervisor') {
        subGrp.style.display = 'block';
        sysGrp.style.display = 'block';
    } else {
        // Show as read-only or hidden if not assigned
        subGrp.style.display = 'block';
        sysGrp.style.display = 'block';
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
    } else if (app.status === 'approved' || app.status === 'completed') {
        _setButtonsEnabled(false);
        footer.style.display = 'none';
        const dateStr = app.approved_at ? new Date(app.approved_at).toLocaleString('en-GB', {timeZone: 'Asia/Kolkata'}) : 'Unknown Time';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-success" style="padding:1rem; background:#f0fdf4; color:#166534; font-weight:bold; margin-bottom:1rem; border:1px solid #bbf7d0;">Approved by: ${escHtml(app.approved_by_name || 'System')}<br>Approved at: ${escHtml(dateStr)}</div>`);
    } else if (app.status === 'rejected' || app.status === 'declined') {
        _setButtonsEnabled(false);
        footer.style.display = 'none';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-error" style="padding:1rem; background:#fef2f2; color:#991b1b; font-weight:bold; margin-bottom:1rem; border:1px solid #fecaca;">This application has been declined.</div>`);
    } else {
        footer.style.display = 'flex';
        _setButtonsEnabled(true);
    }

    // Identify if this is a specialized Identity Approval step
    const actionText = (app.step_action || '').toLowerCase();
    const statusText = (app.current_status || '').toLowerCase();
    const isIdentityStep = actionText.includes('identity') || statusText.includes('identity');

    const leftCol = _modal.querySelector('.rm-left');
    const rightCol = _modal.querySelector('.rm-right');

    // Remove any previously injected identity actions to prevent duplicates
    const oldActions = rightCol.querySelector('.rm-identity-actions-wrap');
    if (oldActions) oldActions.remove();

    const dialog = _modal.querySelector('.rm-dialog');

    if (isIdentityStep) {
        // 1. Hide the entire left form part
        leftCol.style.display = 'none';
        
        // 2. Compact the dialog width for a single panel
        dialog.style.maxWidth = '500px';

        // 3. Inject actions into the right (profile) part
        const actionHtml = `
            <div class="rm-identity-actions-wrap" style="padding: 1.5rem; border-top: 1px solid #f1f5f9; background: #f8fafc;">
                <div class="rm-field-group" style="margin-bottom: 1rem;">
                    <label class="rm-label" for="rm-remarks-alt">Comments <span class="rm-label-hint">optional</span></label>
                    <textarea id="rm-remarks-alt" class="rm-textarea" rows="2" style="width:100%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-family: inherit;" placeholder="Notes..."></textarea>
                </div>
                <div style="display:flex; flex-direction: column; gap: 0.75rem;">
                    <button id="rm-approve-btn-alt" class="btn rm-btn-approve" style="width:100%; background: #6366f1; color: white;">✓ Approve Identity</button>
                    <button id="rm-reject-btn-alt" class="btn rm-btn-reject" style="width:100%; border: 1px solid #ef4444; color: #ef4444; background: transparent;">✕ Decline Application</button>
                </div>
            </div>
        `;
        rightCol.insertAdjacentHTML('beforeend', actionHtml);

        // Allow profile column to grow and fill the compact dialog
        rightCol.style.width = '100%';

        // 4. Re-wire buttons to the shared handlers
        rightCol.querySelector('#rm-approve-btn-alt').addEventListener('click', () => _submitDecision('approve'));
        rightCol.querySelector('#rm-reject-btn-alt').addEventListener('click', () => _submitDecision('reject'));
        
        // Sync remarks if user types in either (though rm-left is hidden)
        const altRemarks = rightCol.querySelector('#rm-remarks-alt');
        altRemarks.addEventListener('input', (e) => {
            _modal.querySelector('#rm-remarks').value = e.target.value;
        });

    } else {
        // Restore standard multi-panel width
        leftCol.style.display = 'flex';
        dialog.style.maxWidth = app.past_reviewers?.length > 0 ? '1600px' : '1400px';
        rightCol.style.width = '420px';
        
        _modal.querySelectorAll('.rm-field-group').forEach(group => group.style.display = 'block');
        _modal.querySelector('#rm-approve-btn').textContent = '✓ Recommend to Next Level';
    }

    _modal.querySelector('#rm-subtitle').textContent =
        `${app.applicant_name || app.applicant_email} · ${app.current_status || app.workflow_name}`;

    // Load necessary data
    const loaders = [_loadApplicantProfile(app.applicant_email)];
    
    // Auto-load services if LIGO status and Subsystem are already known (Steps 2+)
    if (!isIdentityStep) {
        loaders.push(_loadAssignmentData(app));
        
        if (app.ligo_member) {
            // Simulate the confirm state for the UI
            const ligoConfirmBtn = _modal.querySelector('#rm-ligo-confirm-btn');
            if (ligoConfirmBtn) {
                ligoConfirmBtn.disabled = true;
                ligoConfirmBtn.style.opacity = '0.5';
                ligoConfirmBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg> Confirmed`;
                
                const group = _modal.querySelector('.rm-radio-group');
                if (group) group.classList.add('rm-radio-group--locked');
                _modal.querySelectorAll('input[name="ligo_member"]').forEach(r => r.disabled = true);
            }
            
            loaders.push(_loadServices());
        }
    }

    await Promise.all(loaders);

    // Always try to render past recommendations if we have the cache
    if (!_servicesCache) {
        try {
            const sRes = await authFetch(API.REVIEW_SERVICES);
            if (sRes.ok) _servicesCache = await sRes.json();
        } catch(e) {}
    }
    if (_servicesCache) {
        _renderPastRecommendations(app, _servicesCache);
    }

    // Load pending reviews for this applicant
    _loadPendingReviews(app);

    // Apply specific behavior for roles that shouldn't edit assignment
    if (!isIdentityStep && app.role_slug !== 'supervisor' && app.assigned_subsystem_id) {
        const sub = _subsystemsCache?.find(s => s.id == app.assigned_subsystem_id);
        const subName = sub ? sub.name : 'Unknown Subsystem';
        const sysName = sub ? sub.system_name : 'Unknown System';
        
        subGrp.innerHTML = `
            <label class="rm-label">Assigned Subsystem</label>
            <input class="rm-input" style="width: 100%; box-sizing: border-box; background:#f8fafc; color:#475569; padding:0.5rem; font-size:0.85rem; border:1px solid #e2e8f0; cursor:not-allowed;" type="text" disabled readonly value="${escHtml(subName)}">
        `;
        sysGrp.innerHTML = `
            <label class="rm-label">Assigned System</label>
            <input class="rm-input" style="width: 100%; box-sizing: border-box; background:#f8fafc; color:#475569; padding:0.5rem; font-size:0.85rem; border:1px solid #e2e8f0; cursor:not-allowed;" type="text" disabled readonly value="${escHtml(sysName)}">
        `;
        subGrp.style.display = 'block';
        sysGrp.style.display = 'block';
    }
}

function _renderPastRecommendations(app, services) {
    const prevCol = _modal.querySelector('#rm-prev-col');
    const prevBody = _modal.querySelector('#rm-prev-body');
    const pastReviewers = [...(app.past_reviewers || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (pastReviewers.length === 0) {
        prevCol.style.display = 'none';
        return;
    }

    prevCol.style.display = 'flex';
    
    const svcMap = {};
    const subMap = {};
    services.forEach(s => {
        svcMap[String(s.id)] = s.name;
        if (s.subservices) {
            s.subservices.forEach(sub => subMap[String(sub.id)] = sub.name);
        }
    });

    let assignedSubsystemName = 'Not Assigned';
    let assignedSystemName = 'Not Assigned';
    if (typeof _subsystemsCache !== 'undefined' && _subsystemsCache && app.assigned_subsystem_id) {
        const sub = _subsystemsCache.find(s => s.id == app.assigned_subsystem_id);
        if (sub) {
            assignedSubsystemName = sub.name;
            assignedSystemName = sub.system_name;
        }
    }

    let html = `<div style="display:flex; flex-direction:column; gap: 1.5rem; padding-bottom: 2rem;">`;

    pastReviewers.forEach((r, index) => {
        const rInitials = escHtml(r.name).substring(0, 2).toUpperCase();
        const formattedDate = r.date ? new Date(r.date).toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata'}) : '';

        let servicesHtml = '';
        const hasServices = r.service_ids && r.service_ids.length > 0;
        const hasSubservices = r.subservice_ids && r.subservice_ids.length > 0;

        if (hasServices || hasSubservices) {
            const grouped = {};
            let standaloneChecked = 0;

            if (hasSubservices) {
                r.subservice_ids.forEach(subId => {
                    const sid = String(subId);
                    let foundSvc = null;
                    let subName = subMap[sid] || 'Unknown';
                    for (const s of services) {
                        if (s.subservices?.find(sub => String(sub.id) === sid)) {
                            foundSvc = s.name;
                            break;
                        }
                    }
                    const groupKey = foundSvc || 'Other Services';
                    if (!grouped[groupKey]) grouped[groupKey] = [];
                    grouped[groupKey].push(subName);
                });
            }

            if (hasServices) {
                r.service_ids.forEach(svcId => {
                    const sid = String(svcId);
                    const svcObj = services.find(s => String(s.id) === sid);
                    const hasSubInConfig = svcObj && svcObj.subservices && svcObj.subservices.length > 0;
                    if (!hasSubInConfig) {
                        standaloneChecked++;
                        const name = svcObj ? svcObj.name : (svcMap[sid] || 'Unknown Service');
                        if (!grouped[name]) grouped[name] = [];
                        grouped[name].push("__SERVICE_ONLY__");
                    }
                });
            }

            const totalItems = (r.subservice_ids?.length || 0) + standaloneChecked;

            servicesHtml += `
                <div class="rm-field-group" style="margin-top: 1.25rem;">
                    <details class="rm-past-accordion" open style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <summary style="padding: 0.85rem 1.25rem; font-size: 0.85rem; font-weight: 700; color: #1e293b; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9; list-style: none; user-select: none;">
                            <div style="background: #e0f2fe; color: #0369a1; padding: 6px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <span>Recommended Access</span>
                            <span style="margin-left: auto; font-size: 0.75rem; font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 4px 10px; border-radius: 20px; border: 1px solid #bae6fd;">${totalItems} Items</span>
                        </summary>
                        <div style="padding: 1.25rem; display:flex; flex-direction:column; gap:1.25rem; background: white;">
            `;

            Object.entries(grouped).forEach(([svcName, items]) => {
                const isStandalone = items.length === 1 && items[0] === "__SERVICE_ONLY__";
                
                let innerHtml = '';
                if (isStandalone) {
                    innerHtml = `
                        <div style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; background:#10b981; color:white; border-radius:50%; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    `;
                } else {
                    innerHtml = items.filter(name => name !== svcName).map(name => `
                        <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; background:#f0fdf4; color:#166534; padding:0.25rem 0.6rem; border-radius:0.4rem; border:1px solid #bbf7d0; font-weight: 700;">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ${escHtml(name)}
                        </div>
                    `).join('');

                    if (items.some(name => name === svcName)) {
                        innerHtml += `
                            <div style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; background:#10b981; color:white; border-radius:50%; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                        `;
                    }
                }

                servicesHtml += `
                    <div style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.025em; min-width: 120px; flex-shrink: 0;">
                            ${escHtml(svcName)}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                            ${innerHtml}
                        </div>
                    </div>
                `;
            });

            servicesHtml += `</div></details></div>`;
        } else {
            servicesHtml = `
                <div class="rm-field-group" style="margin-top: 1.25rem;">
                    <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Recommended Services</label>
                    <p style="font-size: 0.85rem; color: #94a3b8; font-style: italic; margin:0;">No services recommended at this step.</p>
                </div>
            `;
        }

        const displayRemark = r.remarks && r.remarks.trim() !== '' ? `"${escHtml(r.remarks)}"` : '—';
        const isOpen = index === 0 ? 'open' : '';

        html += `
            <details class="rm-past-item" ${isOpen} style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: all 0.3s ease;">
                <summary style="display:flex; align-items:center; gap: 0.75rem; padding: 1.25rem; cursor: pointer; list-style: none; user-select: none; transition: background 0.2s;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; border: 1px solid #e2e8f0;">
                        ${rInitials}
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; line-height: 1.2;">Approved by ${escHtml(r.name)}</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${formattedDate} • ${escHtml(r.role)}</div>
                    </div>
                    <svg style="margin-left: auto; transition: transform 0.3s; color: #94a3b8;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </summary>

                <div style="padding: 0 1.25rem 1.5rem;">
                    <div style="padding-top: 1.25rem; border-top: 1px solid #f1f5f9;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">LIGO Member</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${app.ligo_member === 'yes' ? 'Yes' : 'No'}</div>
                            </div>
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Recommended Duration</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${r.duration ? escHtml(r.duration) : 'Not specified'}</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Assigned System</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${escHtml(assignedSystemName)}</div>
                            </div>
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Assigned Subsystem</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${escHtml(assignedSubsystemName)}</div>
                            </div>
                        </div>

                        ${servicesHtml}

                        <div class="rm-field-group" style="margin-top: 1.25rem;">
                            <label class="rm-label" style="color:#64748b; font-size: 0.8rem; margin-bottom:0.3rem;">Comments</label>
                            <div style="background:#f1f5f9; border-left:3px solid #94a3b8; padding:0.6rem 0.75rem; font-size:0.85rem; color:#475569; font-style:${r.remarks && r.remarks.trim() !== '' ? 'italic' : 'normal'}; border-radius:4px; font-weight: 500;">
                                ${displayRemark}
                            </div>
                        </div>
                    </div>
                </div>
            </details>
        `;
    });

    html += `</div>`;
    prevBody.innerHTML = html;
}


// ── RIGHT PANEL: Applicant profile ────────────────────────────────────────────
async function _loadApplicantProfile(applicantEmail) {
    const body = _modal.querySelector('#rm-profile-body');
    body.innerHTML = `<div class="rm-loading-inline"><div class="spinner"></div> Loading profile...</div>`;

    // Resolve user_id from the app object
    const app = _currentApp;
    const userId = app.applicant_user_id || app.user_id || app.id;

    if (!userId) {
        console.warn('No user ID found in app:', app);
        console.warn('Available fields:', { applicant_user_id: app.applicant_user_id, user_id: app.user_id, id: app.id });
        body.innerHTML = _buildProfileFallback(app);
        return;
    }

    try {
        const profileUrl = API.APPLICANT_PROFILE(userId);
        console.log('Fetching profile from:', profileUrl, 'for userId:', userId);
        const res = await authFetch(profileUrl);
        console.log('Profile response status:', res.status, res.statusText);
        
        if (!res.ok) {
            console.warn(`Profile fetch failed with status ${res.status} for user ${userId}`);
            console.warn('Response statusText:', res.statusText);
            throw new Error(`HTTP ${res.status}`);
        }
        const p = await res.json();
        console.log('Profile data received:', p);
        body.innerHTML = _buildProfileHtml(p);
    } catch (err) {
        console.error('Profile fetch error:', err, 'for userId:', userId);
        console.error('Error stack:', err.stack);
        body.innerHTML = _buildProfileFallback(app);
    }

    // Wire up ID card preview if button exists
    const idBtn = body.querySelector('#rm-identity-btn');
    if (idBtn) idBtn.addEventListener('click', () => _triggerIdPreview(userId));
}

async function _triggerIdPreview(userId) {
    const preview = _modal.querySelector('#rm-id-preview');
    const img = preview.querySelector('#rm-id-preview-img');
    const approveBtn = preview.querySelector('#rm-id-preview-approve');
    
    // Show a quick loading state
    img.src = '';
    img.alt = 'Loading...';
    approveBtn.style.display = 'none';
    preview.classList.add('open');

    try {
        const fileRes = await authFetch(API.SECURE_FILE(userId));
        if (!fileRes.ok) throw new Error('Could not fetch ID card');
        const blob = await fileRes.blob();
        img.src = URL.createObjectURL(blob);
        img.alt = 'ID Document';

        // Show approve button only if not already approved
        if (!_currentApp.id_card_approved_by) {
            approveBtn.style.display = 'block';
            approveBtn.onclick = () => {
                preview.classList.remove('open');
                _approveIdCard(_currentApp.id);
            };
        }
    } catch (err) {
        img.alt = 'Failed to load ID Card.';
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
            <div style="margin-top: 1.5rem;">
                ${_currentApp.id_card_approved_by ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: #065f46; display: flex; align-items: flex-start; gap: 0.6rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0;"><polyline points="20 6 9 17 4 12"/></svg>
                        <div>
                            <strong style="display:block; font-size:0.85rem; margin-bottom:2px;">Identity Verified</strong>
                            <span style="opacity: 0.85;">by ${escHtml(_currentApp.id_card_approved_by_name || 'Supervisor')} (${escHtml(_currentApp.id_card_approved_by_role || 'Role')})</span><br>
                            <span style="opacity: 0.75; font-size: 0.75rem;">${_currentApp.id_card_approved_at ? new Date(_currentApp.id_card_approved_at).toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata'}) : ''}</span>
                        </div>
                    </div>
                ` : ''}
                <button class="rm-identity-btn" id="rm-identity-btn" style="width: 100%; background: ${_currentApp.id_card_approved_by ? '#10b981' : 'var(--primary-600)'}; color: white; border: none; box-shadow: var(--shadow-sm); transition: background 0.2s;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><circle cx="8.5" cy="11.5" r="2.5"/><path d="M12 16c0-1.7-1.3-3-3-3s-3 1.3-3 3"/><path d="M15 10h5M15 14h5"/></svg>
                    ${_currentApp.id_card_approved_by ? 'View Verified ID Card' : 'View Identity Card'}
                </button>
            </div>
        ` : ''}
    `;
}

// ── Pending Reviews Accordion ────────────────────────────────────────────────
async function _loadPendingReviews(app) {
    const section = _modal.querySelector('#rm-pending-reviews-section');
    const body = _modal.querySelector('#rm-pending-body');
    const countBadge = _modal.querySelector('#rm-pending-count');
    
    try {
        // Get pending reviews for this same applicant (excluding current review)
        const res = await authFetch(API.APPLICATIONS);
        if (!res.ok) throw new Error('Failed to load pending reviews');
        
        const allPendingReviews = await res.json();
        // Filter to this applicant
        const applicantReviews = (allPendingReviews || []).filter(r => 
            r.applicant_email === app.applicant_email && r.id !== app.id
        );
        
        if (applicantReviews.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        countBadge.textContent = applicantReviews.length;
        
        // Build pending reviews list
        let html = '';
        applicantReviews.forEach(review => {
            const roleLabel = review.role_name || review.workflow_name || 'Pending Review';
            const statusBadgeColor = review.status === 'pending' ? '#f59e0b' : '#94a3b8';
            const statusText = review.status === 'pending' ? 'Awaiting Review' : review.status;
            
            html += `
                <div style="background: white; border: 1px solid #fcd34d; border-radius: 0.5rem; padding: 1rem; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s;">
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem; margin-bottom: 0.25rem;">${escHtml(roleLabel)}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">${escHtml(review.workflow_step_name || 'Step review')}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                        <span style="background: ${statusBadgeColor}22; color: ${statusBadgeColor}; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 700; border: 1px solid ${statusBadgeColor}44;">
                            ${escHtml(statusText)}
                        </span>
                    </div>
                </div>
            `;
        });
        
        body.innerHTML = html;
    } catch (err) {
        section.style.display = 'none';
    }
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
        </dl>
        ${app.id_card_path ? `
            <div style="margin-top: 1.5rem;">
                ${app.id_card_approved_by ? `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem; color: #065f46; display: flex; align-items: flex-start; gap: 0.6rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 2px; flex-shrink: 0;"><polyline points="20 6 9 17 4 12"/></svg>
                        <div>
                            <strong style="display:block; font-size:0.85rem; margin-bottom:2px;">Identity Verified</strong>
                            <span style="opacity: 0.85;">by ${escHtml(app.id_card_approved_by_name || 'Supervisor')} (${escHtml(app.id_card_approved_by_role || 'Role')})</span><br>
                            <span style="opacity: 0.75; font-size: 0.75rem;">${app.id_card_approved_at ? new Date(app.id_card_approved_at).toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: 'Asia/Kolkata'}) : ''}</span>
                        </div>
                    </div>
                ` : ''}
                <button class="rm-identity-btn" id="rm-identity-btn" style="width: 100%; background: ${app.id_card_approved_by ? '#10b981' : 'var(--primary-600)'}; color: white; border: none; box-shadow: var(--shadow-sm); transition: background 0.2s;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><circle cx="8.5" cy="11.5" r="2.5"/><path d="M12 16c0-1.7-1.3-3-3-3s-3 1.3-3 3"/><path d="M15 10h5M15 14h5"/></svg>
                    ${app.id_card_approved_by ? 'View Verified ID Card' : 'View Identity Card'}
                </button>
            </div>
        ` : ''}
    `;
}

// ── Subsystem + System assignment ─────────────────────────────────────────────
async function _loadAssignmentData(app) {
    try {
        if (!_subsystemsCache) {
            const res = await authFetch(API.REFERENCE_SUBSYSTEMS);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            _subsystemsCache = await res.json();
        }

        const subSelect = _modal.querySelector('#rm-subsystem');
        const sysInput  = _modal.querySelector('#rm-system-name');
        const sysHidden = _modal.querySelector('#rm-system-id');

        if (!subSelect) return;

        // Populate Subsystems
        subSelect.innerHTML = '<option value="">-- Select Subsystem --</option>';
        _subsystemsCache.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            opt.dataset.systemId = s.system_id;
            opt.dataset.systemName = s.system_name;
            subSelect.appendChild(opt);
        });

        // Wire change event
        subSelect.onchange = () => {
            const opt = subSelect.options[subSelect.selectedIndex];
            if (opt && opt.value) {
                sysInput.value = opt.dataset.systemName;
                sysHidden.value = opt.dataset.systemId;

                // IF Ligo is already confirmed, trigger service fetch
                const isLigoLocked = _modal.querySelector('.rm-radio-group--locked');
                if (isLigoLocked) {
                    const ligoStatus = _modal.querySelector('input[name="ligo_member"]:checked')?.value;
                    _triggerServiceFetch(ligoStatus);
                }
            } else {
                sysInput.value = '';
                sysHidden.value = '';
            }
            _applyServiceFilters();
        };

        // Pre-select if already assigned
        if (app.assigned_subsystem_id) {
            subSelect.value = app.assigned_subsystem_id;
            _applyServiceFilters();
        }

        // Disable if not supervisor and already assigned
        if (app.role_slug !== 'supervisor' && app.assigned_subsystem_id) {
            subSelect.disabled = true;
        }
    } catch (err) {
        console.error('Failed to load assignment data:', err);
    }
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
        _applyServiceFilters();
        _syncSelectAll();
    } catch (err) {
        list.innerHTML = `<p class="rm-error-inline">Could not load services: ${escHtml(err.message)}</p>`;
    }
}

function _buildServicesHtml(services) {
    if (!services || services.length === 0) {
        return `<p class="rm-empty-services">No services configured yet.</p>`;
    }

    const recSvcs = (_currentApp.recommended_service_ids || []).map(String);
    const recSubs = (_currentApp.recommended_subservice_ids || []).map(String);

    return services.map(svc => {
        const hasSubservices = svc.subservices && svc.subservices.length > 0;
        const isSvcChecked = recSvcs.includes(String(svc.id)) ? 'checked' : '';
        const subHtml = hasSubservices
            ? `<div class="rm-subservices">` + 
              svc.subservices.map(sub => {
                const isSubChecked = recSubs.includes(String(sub.id)) ? 'checked' : '';
                return `
                <label class="rm-subservice-label">
                    <input type="checkbox" class="rm-sub-cb"
                           data-service-id="${svc.id}"
                           data-subservice-id="${sub.id}"
                           name="subservice[]"
                           value="${sub.id}"
                           ${isSubChecked}>
                    <span class="rm-cb-custom"></span>
                    <span class="rm-sub-name">${escHtml(sub.name)}</span>
                </label>`;
            }).join('') + `</div>`
            : `<div class="rm-subservices"><p class="rm-no-subs">No sub-services available.</p></div>`;

        return `
            <div class="rm-service-block" id="svc-block-${svc.id}" 
                 data-subsystem-id="${svc.subsystem_id}" 
                 data-is-ligo="${svc.is_ligo ? '1' : '0'}"
                 style="display: none;">
                <div class="rm-service-header-row" style="display:flex; align-items:center;">
                    <label class="rm-service-label" style="flex-grow: 1; border-bottom: none; background: transparent;">
                        <input type="checkbox" class="rm-svc-cb"
                               data-service-id="${svc.id}"
                               name="service[]"
                               value="${svc.id}"
                               ${isSvcChecked}>
                        <span class="rm-cb-custom rm-cb-service"></span>
                        <div class="rm-svc-info">
                            <span class="rm-svc-name">${escHtml(svc.name)}</span>
                            <span class="rm-svc-code">${escHtml(svc.code)}</span>
                        </div>
                    </label>
                    <div class="rm-svc-toggle" data-service-id="${svc.id}" style="padding: 0.8rem 1rem; cursor: pointer; color: #94a3b8; transition: transform 0.2s; display: ${hasSubservices ? 'block' : 'none'};">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </div>
                <div class="rm-subservices" id="svc-subs-${svc.id}" style="display: none;">
                    ${subHtml}
                </div>
            </div>`;
    }).join('');
}

/** Clicking a service checkbox → checks/unchecks all its subservices */
function _wireServiceCheckboxes() {
    const list = _modal.querySelector('#rm-services-list');

    list.querySelectorAll('.rm-svc-cb').forEach(svcCb => {
        svcCb.addEventListener('change', (e) => {
            e.stopPropagation(); 
            const svcId = svcCb.dataset.serviceId;
            list.querySelectorAll(`.rm-sub-cb[data-service-id="${svcId}"]`)
                .forEach(sub => { sub.checked = svcCb.checked; });
            _syncSelectAll();
        });
    });

    // Accordion Toggle Logic
    list.querySelectorAll('.rm-service-header-row').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.rm-svc-cb') || e.target.closest('.rm-cb-custom')) return;

            const block = header.closest('.rm-service-block');
            const toggle = header.querySelector('.rm-svc-toggle');
            const subs = block.querySelector('.rm-subservices');
            
            const isOpen = subs.style.display === 'flex';
            subs.style.display = isOpen ? 'none' : 'flex';
            toggle.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
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

    _syncSelectAll();
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
    const isIdentityStep = (_currentApp.step_action || '').toLowerCase() === 'approve identity';

    // Collect selected services & subservices
    const selectedSubservices = [..._modal.querySelectorAll('.rm-sub-cb:checked')].map(cb => cb.value);
    const selectedServices    = [..._modal.querySelectorAll('.rm-svc-cb:checked')].map(cb => cb.value);
    const ligoMember = _modal.querySelector('input[name="ligo_member"]:checked')?.value ?? _modal.querySelector('input[name="ligo_member"]')?.value ?? 'no';
    const duration = _modal.querySelector('select[name="duration"]')?.value ?? _modal.querySelector('input[name="duration"]')?.value ?? '1 year';
    const subsystemId = _modal.querySelector('#rm-subsystem')?.value || _currentApp.assigned_subsystem_id || null;
    const systemId    = _modal.querySelector('#rm-system-id')?.value || _currentApp.assigned_system_id || null;
    const remarks       = _modal.querySelector('#rm-remarks').value.trim();

    // ── Pre-submission validation ─────────────────────────────────────────────
    if (action === 'approve' && !isIdentityStep) {
        if (_currentApp.id_card_path && !_currentApp.id_card_approved_by) {
            _showFeedback("Identity Verification Required: Please approve the applicant's identity card first.", "error");
            _setButtonsEnabled(true);
            return;
        }
        if (!subsystemId) {
            _showFeedback("Assignment Required: Please select a subsystem for this application.", "error");
            _setButtonsEnabled(true);
            return;
        }
        if (selectedServices.length === 0) {
            _showFeedback("Service Selection Required: Please select at least one service.", "error");
            _setButtonsEnabled(true);
            return;
        }
    }

    const payload = {
        action,
        remarks:            remarks || undefined,
        ligo_member:        ligoMember,
        duration:           duration,
        subsystem_id:       subsystemId || undefined,
        system_id:          systemId    || undefined,
        service_ids:        selectedServices,
        subservice_ids:     selectedSubservices,
    };

    if (action === 'approve' && !isIdentityStep) {
        _showConfirmationPreview(payload, approveBtn, rejectBtn, isIdentityStep);
    } else if (action === 'reject') {
        _showRejectionModal(payload, approveBtn, rejectBtn, isIdentityStep);
    } else {
        _executeDecision(payload, approveBtn, rejectBtn, isIdentityStep);
    }
}

function _showRejectionModal(payload, approveBtn, rejectBtn, isIdentityStep) {
    _setButtonsEnabled(false);
    const dialog = _modal.querySelector('.rm-dialog');
    const overlay = document.createElement('div');
    overlay.className = 'rm-confirm-overlay';
    overlay.style = "position:absolute; inset:0; background:rgba(255,255,255,0.98); z-index:100; display:flex; align-items:center; justify-content:center; padding:2rem; animation: fadeIn 0.2s ease-out; border-radius: 1.25rem;";
    
    const reasons = [
        "Invalid ID Card",
        "Invalid User",
        "User not known to supervisor",
        "Other"
    ];

    overlay.innerHTML = `
        <div style="max-width: 440px; width: 100%; text-align: center;">
            <div style="background: #fee2e2; color: #dc2626; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem;">Decline Application?</h3>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 2rem;">Please select a reason for declining. This will determine the next steps for the applicant.</p>
            
            <div style="text-align: left; margin-bottom: 2rem;">
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:0.75rem;">Decline Reason</label>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${reasons.map(r => `
                        <label style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border: 1.5px solid #e2e8f0; border-radius: 1rem; cursor: pointer; transition: all 0.2s;" class="rm-rejection-option">
                            <input type="radio" name="rejection_reason" value="${r}" style="width: 18px; height: 18px; accent-color: #ef4444;">
                            <span style="font-size: 0.95rem; font-weight: 600; color: #475569;">${r}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem;">
                <button id="rm-rejection-cancel" style="flex: 1; padding: 0.85rem; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 0.75rem; font-weight: 700; font-size: 0.9rem; cursor: pointer;">Cancel</button>
                <button id="rm-rejection-confirm" disabled style="flex: 2; padding: 0.85rem; border: none; background: #ef4444; color: white; border-radius: 0.75rem; font-weight: 700; font-size: 0.9rem; cursor: not-allowed; transition: all 0.2s; opacity: 0.6;">Confirm Decline</button>
            </div>
        </div>
    `;

    dialog.appendChild(overlay);

    const options = overlay.querySelectorAll('.rm-rejection-option');
    const confirmBtn = overlay.querySelector('#rm-rejection-confirm');
    
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => {
                o.style.borderColor = '#e2e8f0';
                o.style.background = 'white';
            });
            opt.style.borderColor = '#ef4444';
            opt.style.background = '#fff1f2';
            confirmBtn.disabled = false;
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.style.opacity = '1';
        });
    });

    overlay.querySelector('#rm-rejection-cancel').addEventListener('click', () => {
        overlay.remove();
        _setButtonsEnabled(true);
    });

    confirmBtn.addEventListener('click', () => {
        const selectedReason = overlay.querySelector('input[name="rejection_reason"]:checked').value;
        payload.rejection_reason = selectedReason;
        confirmBtn.textContent = 'Processing...';
        confirmBtn.disabled = true;
        _executeDecision(payload, approveBtn, rejectBtn, isIdentityStep, overlay);
    });
}

function _showConfirmationPreview(payload, approveBtn, rejectBtn, isIdentityStep) {
    const dialog = _modal.querySelector('.rm-dialog');
    
    // Gather human-readable names for preview
    const subName = _modal.querySelector('#rm-subsystem')?.value || _currentApp.assigned_subsystem_id_name || 'Assigned Subsystem';
    
    // Group subservices by parent service for the preview
    const grouped = {};
    if (payload.subservice_ids?.length > 0) {
        payload.subservice_ids.forEach(subId => {
            const sid = String(subId);
            let parentSvc = null;
            let subNameText = 'Unknown';
            
            for (const s of (_servicesCache || [])) {
                const sub = s.subservices?.find(b => String(b.id) === sid);
                if (sub) {
                    parentSvc = s.name;
                    subNameText = sub.name;
                    break;
                }
            }
            
            const key = parentSvc || 'Other Services';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(subNameText);
        });
    }

    if (payload.service_ids?.length > 0) {
        payload.service_ids.forEach(svcId => {
            const sid = String(svcId);
            const svcObj = (_servicesCache || []).find(s => String(s.id) === sid);
            const hasSubs = svcObj && svcObj.subservices && svcObj.subservices.length > 0;
            if (!hasSubs) {
                const name = svcObj ? svcObj.name : 'Unknown Service';
                if (!grouped[name]) grouped[name] = ["__SERVICE_ONLY__"];
            }
        });
    }

    const overlay = document.createElement('div');
    overlay.className = 'rm-confirm-overlay';
    overlay.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(8px);
        z-index: 100; border-radius: 1.25rem; display: flex; flex-direction: column;
        align-items: center; justify-content: center; padding: 2rem;
        animation: rmFadeIn 0.2s ease;
    `;
    
    let servicesListHtml = '';
    Object.entries(grouped).forEach(([svc, items]) => {
        const isStandalone = items.length === 1 && items[0] === "__SERVICE_ONLY__";
        servicesListHtml += `
            <div style="display:inline-flex; align-items:center; gap:0.5rem; background:#f0fdf4; color:#166534; padding:0.4rem 0.8rem; border-radius:0.75rem; border:1px solid #bbf7d0; font-size:0.8rem; font-weight:700; margin:0 0.4rem 0.4rem 0;">
                ${escHtml(svc)}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 1.25rem; padding: 2.5rem; max-width: 550px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); text-align: left;">
            <div style="background: #eff6ff; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #2563eb;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; letter-spacing: -0.02em;">Confirm Recommendation</h2>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">You are about to submit this application to the next authority. Please verify the assignments below.</p>
            
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 1.25rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); margin-bottom: 2rem;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.5rem; background: #f8fafc; border-bottom: 1px solid #f1f5f9;">
                    <div>
                        <label style="display:block; font-size:0.7rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.4rem;">LIGO Member</label>
                        <div style="font-weight:700; color:#1e293b; font-size:1rem; display:flex; align-items:center; gap:6px;">
                            <span style="width:8px; height:8px; border-radius:50%; background:${payload.ligo_member === 'yes' ? '#10b981' : '#94a3b8'};"></span>
                            ${payload.ligo_member === 'yes' ? 'Yes' : 'No'}
                        </div>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.7rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.4rem;">Duration</label>
                        <div style="font-weight:700; color:#1e293b; font-size:1rem;">${escHtml(payload.duration)}</div>
                    </div>
                </div>

                <div style="padding: 1.5rem; border-bottom: 1px solid #f1f5f9;">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:1rem;">Recommended Access</label>
                    <div style="display:flex; flex-wrap:wrap; gap:0.25rem;">
                        ${servicesListHtml || '<div style="color:#94a3b8; font-style:italic; font-size:0.85rem;">No services selected</div>'}
                    </div>
                </div>

                <div style="padding: 1.5rem;">
                    <label style="display:block; font-size:0.7rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">Reviewer Remarks</label>
                    <div style="color:#475569; font-size:0.9rem; font-style:${payload.remarks ? 'italic' : 'normal'}; line-height:1.5; background:#f8fafc; padding:0.75rem 1rem; border-radius:0.75rem; border:1px solid #f1f5f9;">
                        ${payload.remarks ? `"${escHtml(payload.remarks)}"` : 'No additional remarks provided.'}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button id="rm-confirm-edit-btn" style="flex: 1; padding: 0.85rem; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; border-radius: 0.85rem; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">Cancel</button>
                <button id="rm-confirm-submit-btn" style="flex: 1.5; padding: 0.85rem; border: none; background: #2563eb; color: white; border-radius: 0.85rem; font-weight: 700; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); transition: all 0.2s;">Confirm</button>
            </div>
        </div>
    `;
    
    dialog.appendChild(overlay);
    
    overlay.querySelector('#rm-confirm-edit-btn').addEventListener('click', () => {
        overlay.remove();
        _setButtonsEnabled(true);
    });
    
    overlay.querySelector('#rm-confirm-submit-btn').addEventListener('click', () => {
        const confirmBtn = overlay.querySelector('#rm-confirm-submit-btn');
        confirmBtn.textContent = 'Submitting...';
        confirmBtn.disabled = true;
        _executeDecision(payload, approveBtn, rejectBtn, isIdentityStep, overlay);
    });
}

async function _executeDecision(payload, approveBtn, rejectBtn, isIdentityStep, overlay = null) {
    if (!overlay) {
        approveBtn.textContent = payload.action === 'approve' 
            ? (isIdentityStep ? '…Approving' : '…Recommending') 
            : (isIdentityStep ? '✓ Approve Identity' : '✓ Recommend to Next Level');
        rejectBtn.textContent  = payload.action === 'reject'  ? '…Declining'    : '✕ Decline';
    }

    try {
        const res = await authFetch(API.DECIDE(_currentApp.id), {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        if (overlay) overlay.remove();
        _showFeedback(data.message || 'Done!', 'success');
        
        setTimeout(() => {
            _close();
            if (_onSuccess) _onSuccess();
        }, 1400);

    } catch (err) {
        if (overlay) overlay.remove();
        
        let msg = err.message || 'Something went wrong.';
        let hint = 'Please check your connection or refresh the page.';

        // Attempt to parse structured error from backend
        try {
            if (err.data && err.data.error) msg = err.data.error;
            if (err.data && err.data.hint)  hint = err.data.hint;
        } catch(e) {}

        _showFeedback(msg, 'error', hint);
        _setButtonsEnabled(true);
        _resetButtonLabels(approveBtn, rejectBtn, isIdentityStep);
    }
}

function _resetButtonLabels(approveBtn, rejectBtn, isIdentityStep) {
    approveBtn.innerHTML = isIdentityStep 
        ? `✓ Approve Identity` 
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Recommend to Next Level`;
    
    rejectBtn.innerHTML = `✕ Decline`;
}

async function _approveIdCard(appId) {
    try {
        const res = await authFetch(API.APPROVE_ID_CARD(appId), { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to approve ID card');
        
        _showFeedback('ID Card Approved Successfully!', 'success');
        _currentApp.id_card_approved_by = 'verified';
        
        // Refresh dashboard in background
        if (_onSuccess) _onSuccess();
        
        _loadModalData(_currentApp);
    } catch (err) {
        _showFeedback(err.message, 'error');
    }
}

function _close() {
    if (!_modal) return;
    _modal.classList.remove('open');
    document.body.style.overflow = '';
    _hideFeedback();
}

function _setButtonsEnabled(enabled) {
    ['#rm-approve-btn', '#rm-reject-btn', '#rm-approve-btn-alt', '#rm-reject-btn-alt'].forEach(sel => {
        const btn = _modal?.querySelector(sel);
        if (btn) btn.disabled = !enabled;
    });
}

function _showFeedback(msg, type = 'info', hint = '') {
    const el = _modal.querySelector('#rm-feedback');
    if (!el) return;

    let html = `<span>${escHtml(msg)}</span>`;
    if (hint) {
        html += `<div class="rm-feedback-hint" style="font-size:0.75rem; opacity:0.85; margin-top:4px; font-weight:400;">${escHtml(hint)}</div>`;
    }

    el.innerHTML = html;
    el.className = `rm-feedback rm-feedback--${type}`;
    el.style.display = 'block';
}

function _hideFeedback() {
    const el = _modal?.querySelector('#rm-feedback');
    if (el) el.style.display = 'none';
}

function _handleLigoConfirm(val, btn) {
    const radios = _modal.querySelectorAll('input[name="ligo_member"]');
    const serviceList = _modal.querySelector('#rm-services-list');
    const subSelect = _modal.querySelector('#rm-subsystem');
    
    // 1. Hard Lock the UI group and button
    const group = _modal.querySelector('.rm-radio-group');
    if (group) group.classList.add('rm-radio-group--locked');
    radios.forEach(r => r.disabled = true);
    
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.innerHTML = `<i data-feather="check" style="width:12px;height:12px;"></i> Confirmed`;
    if (window.feather) feather.replace();

    // 2. Check if subsystem is already selected
    if (subSelect && subSelect.value) {
        _triggerServiceFetch(val);
    } else {
        // Show guidance message
        serviceList.innerHTML = `
            <div style="padding:2.5rem; text-align:center; background:#f0f9ff; border:1px solid #bae6fd; border-radius:0.75rem; color:#0369a1; font-size:0.9rem; animation: rmFadeIn 0.3s;">
                <i data-feather="arrow-up" style="width:20px; height:20px; display:block; margin:0 auto 0.75rem;"></i>
                LIGO Status Confirmed. <br>Now please select an <strong>Assigned Subsystem</strong> above to view services.
            </div>
        `;
        if (window.feather) feather.replace();
    }
}

async function _triggerServiceFetch(ligoStatus) {
    const serviceList = _modal.querySelector('#rm-services-list');
    serviceList.style.position = 'relative';
    serviceList.innerHTML = `
        <div class="rm-service-lock-overlay" style="position:static; padding:2.5rem; background:white; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; border-radius:0.75rem; animation: rmFadeIn 0.2s;">
            <div class="spinner"></div>
            <div style="text-align:center;">
                <div style="font-size:0.9rem; font-weight:800; color:#1e293b;">Fetching Eligible Services...</div>
                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">Based on ${ligoStatus === 'yes' ? 'LIGO Member' : 'Non-Member'} status</div>
            </div>
        </div>
    `;

    setTimeout(async () => {
        await _loadServices();
        if (window.feather) feather.replace();
    }, 600);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _applyServiceFilters() {
    const subsystemId = _modal.querySelector('#rm-subsystem')?.value || _currentApp.assigned_subsystem_id || null;
    const isLigo      = _modal.querySelector('input[name="ligo_member"]:checked')?.value === 'yes' || _currentApp.ligo_member === 'yes';
    const serviceList = _modal.querySelector('#rm-services-list');

    if (!serviceList) return;

    serviceList.querySelectorAll('.rm-service-block').forEach(block => {
        const blockSubsystemId = block.dataset.subsystemId;
        const blockIsLigo      = block.dataset.isLigo === '1';

        const matchesSubsystem = !subsystemId || blockSubsystemId == subsystemId;
        const allowedByLigo    = !blockIsLigo || isLigo;

        if (matchesSubsystem && allowedByLigo) {
            block.style.display = 'block';
        } else {
            block.style.display = 'none';
            block.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
    });
}
