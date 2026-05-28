import { authFetch, getAccessToken } from '../../utils/auth.js';
import { API, BASE_URL } from '../../config/api.js';

import { __esc, _formatDate } from '../../utils/helpers.js';
import { _buildProfileHtml, _buildProfileFallback } from '../../components/ApplicantProfile.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _modal = null;
let _onSuccess = null;
let _currentApp = null;

// Cache fetched data so we don't re-fetch on every open
let _servicesCache = null;
let _subsystemsCache = null;
let _durationsCache = null;

// Isolated state per application to prevent data leakage
let _reviewState = {};

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Open the review modal for a given application.
 * @param {object} app       - Application data from /api/auth/review/applications
 * @param {Function} onSuccess - Called after a successful approve/reject
 */
export function openReviewModal(app, onSuccess) {
    _onSuccess = onSuccess;
    _currentApp = app;
    console.log('[ReviewModal] Opening modal for App:', app.id, 'Recommended:', app.recommended_service_ids);

    // ALWAYS initialize local state for this application to prevent stale data leakage
    const recSvcs = Array.isArray(app.recommended_service_ids) ? app.recommended_service_ids : [];
    const recSubs = Array.isArray(app.recommended_subservice_ids) ? app.recommended_subservice_ids : [];

    _reviewState[app.id] = {
        ligo_member: app.ligo_member || '',
        duration: app.recommended_duration || app.duration || '1 Year',
        subsystem_id: app.assigned_subsystem_id || '',
        service_ids: [...recSvcs],
        subservice_ids: [...recSubs],
        inherited_service_ids: [...recSvcs],
        inherited_subservice_ids: [...recSubs],
        remarks: ''
    };
    console.log('[ReviewModal] Initialized State:', _reviewState[app.id]);

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
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
                        Past Recommendations
                    </h2>
                </div>
                <div class="rm-form-body" id="rm-prev-body" style="background: #f8fafc; padding-top: 1rem;">
                    <!-- Injected by JS -->
                </div>
            </div>

            <style>
                .rm-btn-secondary {
                    background: #f1f5f9;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    padding: 0.6rem 1.25rem;
                    border-radius: 0.6rem;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .rm-btn-secondary:hover.rm-btn-decline {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.2);
                }
                .rm-btn-secondary:hover.rm-btn-correction {
                    background: rgba(245, 158, 11, 0.1);
                    color: #d97706;
                    border-color: rgba(245, 158, 11, 0.2);
                }
                .rm-btn-secondary svg {
                    opacity: 0.7;
                    transition: all 0.2s;
                }
                .rm-btn-secondary:hover.rm-btn-decline svg {
                    opacity: 1;
                    color: #ef4444;
                }
                .rm-btn-secondary:hover.rm-btn-correction svg {
                    opacity: 1;
                    color: #d97706;
                }
            </style>

            <!-- MIDDLE: Review Form -->
            <div class="rm-left">
                <div class="rm-left-header">
                    <h2 id="rm-title" class="rm-title" style="display: flex; align-items: center; gap: 8px;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_1.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_1.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                        Review Application
                    </h2>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <p class="rm-subtitle" id="rm-subtitle">Loading…</p>
                        <div id="rm-header-actions"></div>
                    </div>
                </div>

                <div class="rm-form-body">
                    <!-- Reapplication Diff Banner -->
                    <div id="rm-reapply-banner" style="display:none; margin-bottom: 1.5rem;"></div>

                    <!-- LIGO Member toggle -->
                    <div class="rm-field-group" id="rm-ligo-group">
                        <div style="display:flex; flex-direction:column; gap:0.75rem;">
                            <div>
                                <label class="rm-label">Is the applicant an official LIGO-US Member?</label>
                                <div class="rm-radio-group" style="margin-top: 0.25rem;">
                                    <label class="rm-radio-label">
                                        <input type="radio" name="ligo_us_member" value="yes">
                                        <span class="rm-radio-chip">Yes</span>
                                    </label>
                                    <label class="rm-radio-label">
                                        <input type="radio" name="ligo_us_member" value="no" checked>
                                        <span class="rm-radio-chip">No</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label class="rm-label">Is the applicant an official LIGO-India Member?</label>
                                <div class="rm-radio-group" style="margin-top: 0.25rem;">
                                    <label class="rm-radio-label">
                                        <input type="radio" name="ligo_india_member" value="yes">
                                        <span class="rm-radio-chip">Yes</span>
                                    </label>
                                    <label class="rm-radio-label">
                                        <input type="radio" name="ligo_india_member" value="no" checked>
                                        <span class="rm-radio-chip">No</span>
                                    </label>
                                </div>
                            </div>
                            <div style="margin-top: 0.75rem; display: flex; justify-content: flex-end;">
                                <button id="rm-ligo-confirm-btn" class="btn" style="background:#6366f1; color:white; border:none; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:700; font-size:0.8rem; cursor:pointer; box-shadow:0 2px 8px rgba(99,102,241,0.2); transition:all 0.2s; white-space:nowrap;">Confirm Membership</button>
                            </div>
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
                        <select id="rm-subsystem" class="rm-select" disabled style="opacity: 0.6; cursor: not-allowed;">
                            <option value="">-- Select Subsystem --</option>
                        </select>
                    </div>

                    <!-- System (Auto-fetched) -->
                    <div class="rm-field-group" id="rm-system-group">
                        <label class="rm-label" for="rm-system-name">Assigned System</label>
                        <input type="text" id="rm-system-name" class="rm-select" disabled style="background: #f1f5f9; border: 1.5px solid #e2e8f0; color: #475569; font-weight: 500; cursor: not-allowed;" placeholder="Select a subsystem first...">
                        <div id="rm-system-lead-hint" style="font-size: 0.75rem; color: #64748b; margin-top: 4px; display:none;">
                            <span class="extracted-svg" style="width:12px; height:12px; vertical-align: middle; display: inline-block; -webkit-mask-image: url(/assets/icons/user.svg); mask-image: url(/assets/icons/user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                            Next Reviewer: <span id="rm-system-lead-name" style="font-weight: 700; color: #6366f1;"></span>
                        </div>
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
                            <!-- Injected by JS -->
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

                    <!-- NEW: Decision Options Panel -->
                    <div id="rm-decision-panel" style="display:none; margin-top: 1rem; padding: 1.25rem; border-radius: 0.75rem; border: 1.5px solid #e2e8f0; background: #f8fafc;">
                        <h4 id="rm-decision-title" style="margin-top: 0; margin-bottom: 1rem; font-size: 0.95rem; font-weight: 700;">Decision Details</h4>
                        
                        <div id="rm-correction-options" style="margin-bottom: 1rem;">
                            <label class="rm-label" id="rm-options-label" style="display:block; margin-bottom: 0.5rem; font-weight: 500;"></label>
                            <div id="rm-decision-checkboxes" style="display:flex; flex-direction:column; gap: 0.5rem;">
                                <!-- Checkboxes injected dynamically by JS -->
                            </div>
                        </div>

                        <div style="display:flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem;">
                            <button id="rm-decision-cancel" class="rm-btn-secondary" style="background:white;">Cancel</button>
                            <button id="rm-decision-confirm" class="btn" style="padding: 0.5rem 1.5rem; font-weight:700;">Confirm Action</button>
                        </div>
                    </div>

                    <!-- Feedback -->
                    <div id="rm-feedback" class="rm-feedback" style="display:none;"></div>

                </div><!-- /rm-form-body -->

                <div class="rm-footer">
                    <button id="rm-correction-btn" class="rm-btn-secondary rm-btn-correction" style="color: #d97706; border-color: #fde68a; background: #fffbeb;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/corner-up-left.svg) no-repeat center; mask: url(/assets/icons/corner-up-left.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
                        Send Back for Valid ID Card
                    </button>

                    <button id="rm-reject-btn" class="rm-btn-secondary rm-btn-decline">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/x-circle.svg) no-repeat center; mask: url(/assets/icons/x-circle.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
                        Decline
                    </button>
                    
                    <button id="rm-approve-btn" class="btn rm-btn-approve" style="display: flex; align-items: center; gap: 6px;">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_4.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_4.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
                        Recommend to Next Level
                    </button>
                </div>
            </div>

            <!-- RIGHT: Applicant Profile -->
            <div class="rm-right">
                <div class="rm-right-header">
                    <h3 class="rm-right-title">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_5.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_5.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
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
        </div>

        <!-- Identity Comparison Overlay -->
        <div id="rm-compare-overlay" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.7); backdrop-filter:blur(4px); overflow-y:auto;">
            <div style="max-width:1400px; margin:2rem auto; padding:1rem;">
                <div style="background:white; border-radius:1rem; box-shadow:0 25px 60px rgba(0,0,0,0.25); overflow:hidden;">
                    <!-- Header -->
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; background:linear-gradient(135deg,#7c3aed,#6366f1); color:white;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_6.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_6.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                            <span style="font-weight:800; font-size:1rem;">Identity Comparison — Duplicate Risk Review</span>
                        </div>
                        <button id="rm-compare-close" style="background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:50%; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                    </div>
                    <!-- Carousel nav (shown when > 1 match) -->
                    <div id="rm-compare-nav" style="display:none; align-items:center; justify-content:space-between; padding:0.6rem 1.5rem; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                        <button id="rm-compare-prev" style="background:white; border:1px solid #e2e8f0; color:#374151; padding:0.35rem 0.9rem; border-radius:0.4rem; font-weight:700; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">
                            &#8592; Prev
                        </button>
                        <span id="rm-compare-counter" style="font-size:0.82rem; font-weight:700; color:#6366f1;">Match 1 of 1</span>
                        <button id="rm-compare-next" style="background:white; border:1px solid #e2e8f0; color:#374151; padding:0.35rem 0.9rem; border-radius:0.4rem; font-weight:700; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; gap:4px;">
                            Next &#8594;
                        </button>
                    </div>
                    <!-- Body -->
                    <div id="rm-compare-body" style="display:grid; grid-template-columns:1fr 1fr; gap:0;">
                        <div id="rm-compare-applicant" style="padding:1.5rem; border-right:1px solid #e2e8f0;">
                            <div style="text-align:center; margin-bottom:1rem;">
                                <span style="background:#eef2ff; color:#6366f1; font-weight:800; font-size:0.75rem; padding:3px 12px; border-radius:99px; text-transform:uppercase; letter-spacing:0.05em;">Current Applicant</span>
                            </div>
                            <div class="rm-compare-loading" style="text-align:center; padding:2rem; color:#94a3b8;">Loading…</div>
                        </div>
                        <div id="rm-compare-duplicate" style="padding:1.5rem; background:#fafafa;">
                            <div style="text-align:center; margin-bottom:1rem;">
                                <span style="background:#fef2f2; color:#ef4444; font-weight:800; font-size:0.75rem; padding:3px 12px; border-radius:99px; text-transform:uppercase; letter-spacing:0.05em;">Potential Duplicate</span>
                            </div>
                            <div class="rm-compare-loading" style="text-align:center; padding:2rem; color:#94a3b8;">Loading…</div>
                        </div>
                    </div>
                    <!-- Footer actions -->
                    <div style="display:flex; justify-content:flex-end; gap:0.75rem; padding:1rem 1.5rem; border-top:1px solid #f1f5f9; background:#f8fafc;">
                        <button id="rm-compare-close-bottom" style="background:white; border:1px solid #e2e8f0; color:#64748b; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:600; cursor:pointer;">Close</button>
                        <button id="rm-compare-sendback" style="background:#fffbeb; border:1px solid #fde68a; color:#d97706; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_7.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_7.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>
                            Send Back for ID Card
                        </button>
                        <button id="rm-compare-decline" style="background:#fef2f2; border:1px solid #fecaca; color:#ef4444; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/x-circle.svg) no-repeat center; mask: url(/assets/icons/x-circle.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>
                            Decline Application
                        </button>
                        <button id="rm-compare-approve" style="background:#6366f1; border:none; color:white; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_9.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_9.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>
                            Approve & Proceed
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Reapplication Comparison Overlay -->
        <div id="rm-reapply-diff-overlay" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.7); backdrop-filter:blur(4px); overflow-y:auto;">
            <div style="max-width:1100px; margin:2rem auto; padding:1rem;">
                <div style="background:white; border-radius:1rem; box-shadow:0 25px 60px rgba(0,0,0,0.25); overflow:hidden;">
                    <!-- Header -->
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; background:linear-gradient(135deg,#059669,#10b981); color:white;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_10.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_10.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                            <span style="font-weight:800; font-size:1rem;">Application Comparison — Reapplication History</span>
                        </div>
                        <button id="rm-reapply-diff-close" style="background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:50%; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                    </div>
                    <!-- Body -->
                    <div style="padding:1.5rem; overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="border-bottom:2px solid #e2e8f0;">
                                    <th style="padding:0.75rem; text-align:left; color:#64748b; font-weight:700; width:30%;">Field</th>
                                    <th style="padding:0.75rem; text-align:left; color:#0f172a; font-weight:800; width:35%;">Current Application (<span id="rm-diff-curr-id"></span>)</th>
                                    <th style="padding:0.75rem; text-align:left; color:#64748b; font-weight:800; width:35%;">Previous Application (<span id="rm-diff-prev-id"></span>)</th>
                                </tr>
                            </thead>
                            <tbody id="rm-reapply-diff-tbody">
                                <!-- Dynamic side-by-side rows go here -->
                            </tbody>
                        </table>
                    </div>
                    <!-- Footer actions -->
                    <div style="display:flex; justify-content:flex-end; gap:0.75rem; padding:1rem 1.5rem; border-top:1px solid #f1f5f9; background:#f8fafc;">
                        <button id="rm-reapply-diff-close-bottom" style="background:white; border:1px solid #e2e8f0; color:#64748b; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:600; cursor:pointer;">Close Comparison</button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(_modal);

    // Wire close behaviours
    _modal.querySelector('#rm-close-btn').addEventListener('click', _close);
    _modal.addEventListener('click', (e) => { if (e.target === _modal) _close(); });

    const idPreview = _modal.querySelector('#rm-id-preview');
    _modal.querySelector('#rm-id-preview-close').addEventListener('click', () => idPreview.classList.remove('open'));
    idPreview.addEventListener('click', (e) => { if (e.target === idPreview) idPreview.classList.remove('open'); });

    // Wire compare overlay close buttons
    const compareOverlay = _modal.querySelector('#rm-compare-overlay');
    _modal.querySelector('#rm-compare-close').addEventListener('click', () => compareOverlay.style.display = 'none');
    _modal.querySelector('#rm-compare-close-bottom').addEventListener('click', () => compareOverlay.style.display = 'none');

    // Wire reapply diff overlay close buttons
    const reapplyDiffOverlay = _modal.querySelector('#rm-reapply-diff-overlay');
    _modal.querySelector('#rm-reapply-diff-close').addEventListener('click', () => reapplyDiffOverlay.style.display = 'none');
    _modal.querySelector('#rm-reapply-diff-close-bottom').addEventListener('click', () => reapplyDiffOverlay.style.display = 'none');

    _modal.querySelector('#rm-compare-sendback').addEventListener('click', () => {
        compareOverlay.style.display = 'none';
        _showDecisionPanel('correction');
    });
    _modal.querySelector('#rm-compare-decline').addEventListener('click', () => {
        compareOverlay.style.display = 'none';
        _showDecisionPanel('decline');
    });
    _modal.querySelector('#rm-compare-approve').addEventListener('click', () => {
        compareOverlay.style.display = 'none';
        _submitDecision('approve');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (compareOverlay.style.display !== 'none') { compareOverlay.style.display = 'none'; return; }
            if (reapplyDiffOverlay.style.display !== 'none') { reapplyDiffOverlay.style.display = 'none'; return; }
            if (idPreview.classList.contains('open')) idPreview.classList.remove('open');
            else _close();
        }
    });

    // Wire action buttons
    _modal.querySelector('#rm-approve-btn').addEventListener('click', () => _submitDecision('approve'));

    _modal.querySelector('#rm-correction-btn').addEventListener('click', () => _showDecisionPanel('correction'));
    _modal.querySelector('#rm-reject-btn').addEventListener('click', () => _showDecisionPanel('decline'));

    _modal.querySelector('#rm-decision-cancel').addEventListener('click', () => _hideDecisionPanel());
    _modal.querySelector('#rm-decision-confirm').addEventListener('click', () => _handleDecisionConfirm());

    // Select-All checkbox
    _modal.querySelector('#rm-select-all').addEventListener('change', _handleSelectAll);

    // Wire Ligo Member status change
    _modal.querySelector('#rm-ligo-confirm-btn').addEventListener('click', (e) => {
        const usVal = _modal.querySelector('input[name="ligo_us_member"]:checked')?.value;
        const indiaVal = _modal.querySelector('input[name="ligo_india_member"]:checked')?.value;
        const finalLigo = (usVal === 'yes' || indiaVal === 'yes') ? 'yes' : 'no';
        _reviewState[_currentApp.id].ligo_member = finalLigo;
        _handleLigoConfirm(finalLigo, e.target);
    });
}

// ── Load all dynamic data for a given application ─────────────────────────────
async function _loadModalData(app) {
    _currentApp = app;
    const state = _reviewState[app.id];

    // 1. Reset feedback and panels
    _hideFeedback();
    _hideDecisionPanel();

    // 2. Clear stale services DOM immediately to prevent state bleeding
    // When _loadAssignmentData runs, it might call _applyServiceFilters, which calls _updateServicesState.
    // If we don't clear this, it will read the previous application's checkboxes!
    const svcList = _modal.querySelector('#rm-services-list');
    if (svcList) svcList.innerHTML = '';

    // Handle LIGO Member flag
    const ligoGroup = _modal.querySelector('#rm-ligo-group');

    // If ligo_member is already set (e.g. from a previous review or correction), we lock it programmatically
    const isLigoPreassigned = app.ligo_member && app.ligo_member !== 'pending' && app.ligo_member !== 'unknown';

    // Always render standard radio buttons so they can be unlocked via Reset
    ligoGroup.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <div>
                <label class="rm-label">Is the applicant an official LIGO-US Member?</label>
                <div class="rm-radio-group" style="margin-top: 0.25rem;">
                    <label class="rm-radio-label">
                        <input type="radio" name="ligo_us_member" value="yes" ${state.ligo_us === 'yes' ? 'checked' : ''}>
                        <span class="rm-radio-chip">Yes</span>
                    </label>
                    <label class="rm-radio-label">
                        <input type="radio" name="ligo_us_member" value="no" ${state.ligo_us !== 'yes' ? 'checked' : ''}>
                        <span class="rm-radio-chip">No</span>
                    </label>
                </div>
            </div>
            <div>
                <label class="rm-label">Is the applicant an official LIGO-India Member?</label>
                <div class="rm-radio-group" style="margin-top: 0.25rem;">
                    <label class="rm-radio-label">
                        <input type="radio" name="ligo_india_member" value="yes" ${state.ligo_india === 'yes' ? 'checked' : ''}>
                        <span class="rm-radio-chip">Yes</span>
                    </label>
                    <label class="rm-radio-label">
                        <input type="radio" name="ligo_india_member" value="no" ${state.ligo_india !== 'yes' ? 'checked' : ''}>
                        <span class="rm-radio-chip">No</span>
                    </label>
                </div>
            </div>
            <div style="margin-top: 0.75rem; display: flex; justify-content: flex-end; gap: 0.5rem; align-items: center;">
                <button id="rm-ligo-reset-btn" class="btn" style="display:none; background:#fef2f2; color:#ef4444; border:1px solid #fecaca; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:600; font-size:0.8rem; cursor:pointer; transition:all 0.2s; white-space:nowrap;">Reset</button>
                <button id="rm-ligo-confirm-btn" class="btn" style="background:#6366f1; color:white; border:none; padding:0.5rem 1.25rem; border-radius:0.5rem; font-weight:700; font-size:0.8rem; cursor:pointer; box-shadow:0 2px 8px rgba(99,102,241,0.2); transition:all 0.2s; white-space:nowrap;">Confirm Membership</button>
            </div>
        </div>
    `;

    // RE-WIRE the button and add state update on change
    ligoGroup.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.name === 'ligo_us_member') _reviewState[app.id].ligo_us = e.target.value;
            if (e.target.name === 'ligo_india_member') _reviewState[app.id].ligo_india = e.target.value;
        });
    });

    ligoGroup.querySelector('#rm-ligo-confirm-btn').addEventListener('click', (e) => {
        const usVal = ligoGroup.querySelector('input[name="ligo_us_member"]:checked')?.value;
        const indiaVal = ligoGroup.querySelector('input[name="ligo_india_member"]:checked')?.value;
        const finalLigo = (usVal === 'yes' || indiaVal === 'yes') ? 'yes' : 'no';
        _handleLigoConfirm(finalLigo, e.target);
    });

    ligoGroup.querySelector('#rm-ligo-reset-btn').addEventListener('click', (e) => {
        _handleLigoConfirm('pending', ligoGroup.querySelector('#rm-ligo-confirm-btn'));
    });

    if (isLigoPreassigned) {
        // Automatically lock it on load without triggering an API call immediately if it matches the DB
        const lockBtn = ligoGroup.querySelector('#rm-ligo-confirm-btn');
        const resetBtn = ligoGroup.querySelector('#rm-ligo-reset-btn');
        const radios = ligoGroup.querySelectorAll('input[type="radio"]');
        const groups = ligoGroup.querySelectorAll('.rm-radio-group');
        
        groups.forEach(g => g.classList.add('rm-radio-group--locked'));
        radios.forEach(r => r.disabled = true);
        
        lockBtn.disabled = true;
        lockBtn.style.opacity = '0.5';
        lockBtn.innerHTML = `<span class="extracted-svg" style="width:12px;height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/check.svg); mask-image: url(/assets/icons/check.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Confirmed`;
        
        if (resetBtn) {
            resetBtn.style.display = 'block';
            resetBtn.disabled = false;
        }
    }

    // Handle Duration (Keep editable for refined review)
    const durationWrap = _modal.querySelector('#rm-duration-group');
    const durations = await _loadDurations();
    const durationOptions = durations.map(d =>
        `<option value="${d.name}" ${state.duration === d.name ? 'selected' : ''}>${d.name}</option>`
    ).join('');

    durationWrap.innerHTML = `
        <label class="rm-label" for="rm-duration">
            Account Duration
            <span class="rm-label-hint" style="color: var(--error);">*</span>
        </label>
        <select id="rm-duration" name="duration" class="rm-select">
            <option value="" disabled ${!state.duration ? 'selected' : ''}>-- Select Duration --</option>
            ${durationOptions}
        </select>
    `;

    durationWrap.querySelector('#rm-duration').addEventListener('change', (e) => {
        _reviewState[app.id].duration = e.target.value;
    });

    // Handle Assignments visibility based on role
    const subGrp = _modal.querySelector('#rm-subsystem-group');
    const sysGrp = _modal.querySelector('#rm-system-group');

    // First authority (supervisor) must assign subsystem
    if (app.role_slug === 'supervisor' && !app.assigned_subsystem_id) {
        subGrp.style.display = 'block';
        sysGrp.style.display = 'block';

        const subSelect = _modal.querySelector('#rm-subsystem');
        if (subSelect) {
            subSelect.disabled = false;
            subSelect.style.opacity = '1';
            subSelect.style.cursor = 'pointer';
        }
    } else {
        // Show as read-only or hidden if already assigned
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
        const dateStr = app.approved_at ? new Date(app.approved_at).toLocaleString('en-GB') : 'Unknown Time';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-success" style="padding:1rem; background:#f0fdf4; color:#166534; font-weight:bold; margin-bottom:1rem; border:1px solid #bbf7d0;">Approved by: ${__esc(app.approved_by_name || 'System')}<br>Approved at: ${__esc(dateStr)}</div>`);
    } else if (app.status === 'rejected' || app.status === 'declined') {
        _setButtonsEnabled(false);
        footer.style.display = 'none';
        footer.insertAdjacentHTML('beforebegin', `<div class="rm-status-banner rm-banner-error" style="padding:1rem; background:#fef2f2; color:#991b1b; font-weight:bold; margin-bottom:1rem; border:1px solid #fecaca;">This application has been declined.</div>`);
    } else {
        footer.style.display = 'flex';
        _setButtonsEnabled(true);

        // Dynamic visibility for "Send Back for Valid ID Card" button
        const correctionBtn = _modal.querySelector('#rm-correction-btn');
        if (correctionBtn) {
            const isIdApproved = app.is_id_approved;
            correctionBtn.style.display = isIdApproved ? 'none' : 'flex';
        }
    }

    // Handle Remarks from state
    const remarksField = _modal.querySelector('#rm-remarks');
    if (remarksField) {
        remarksField.value = state.remarks || '';
        remarksField.addEventListener('input', (e) => {
            _reviewState[app.id].remarks = e.target.value;
        });
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

    const isLiCoordinator = app.role_slug === 'li_coordinator';

    if (isIdentityStep && !isLiCoordinator) {
        // 1. Hide the entire left form part for non-LI-coordinators
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

        // Reset all field group visibilities first
        _modal.querySelectorAll('.rm-field-group').forEach(group => group.style.display = 'block');

        if (isIdentityStep && isLiCoordinator) {
            // ── LI-Coordinator: Identity step ──────────────────────────────
            // They ONLY select a subsystem to route the application to the
            // correct subsystem lead. LIGO confirmation, duration, and
            // service selection are done by the subsystem lead in a later step.

            // Show only subsystem + system groups; hide everything else
            _modal.querySelector('#rm-ligo-group').style.display = 'none';
            _modal.querySelector('#rm-duration-group').style.display = 'none';

            const servicesFieldGroup = _modal.querySelector('#rm-services-list')?.closest('.rm-field-group');
            if (servicesFieldGroup) servicesFieldGroup.style.display = 'none';

            _modal.querySelector('#rm-approve-btn').textContent = '✓ Approve Identity & Assign Subsystem';

        } else {
            _modal.querySelector('#rm-approve-btn').textContent = '✓ Recommend to Next Level';
        }
    }

    let titleHtml = `<span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_1.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_1.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span> Review Application`;
    if (app.reapplied_from) {
        titleHtml += ` <span style="margin-left:8px; background:#fffbeb; color:#d97706; padding:2px 8px; border-radius:12px; font-size:0.8rem; border:1px solid #fde68a; font-weight:700;" title="Reapplied from original application ${app.reapplied_from}"><span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_13.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_13.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block; vertical-align:middle; margin-right:4px;"></span>Reapplication (${app.reapplied_from})</span>`;
    }
    _modal.querySelector('#rm-title').innerHTML = titleHtml;

    _modal.querySelector('#rm-subtitle').innerHTML = `${app.applicant_name || app.applicant_email} &middot; ${app.current_status || app.workflow_name}`;

    // Load necessary data
    const loaders = [_loadApplicantProfile(app.applicant_email)];

    if (isIdentityStep && isLiCoordinator) {
        // ── LI-Coordinator Identity Step ───────────────────────────────────
        // Only load subsystem list so they can pick who to route to next.
        // Do NOT load services — that is the subsystem lead's job.
        await _loadAssignmentData(app);

        // Ensure subsystem dropdown is editable
        setTimeout(() => {
            const subSelect = _modal.querySelector('#rm-subsystem');
            if (subSelect) {
                subSelect.disabled = false;
                subSelect.style.opacity = '1';
                subSelect.style.cursor = 'pointer';
            }
        }, 50);

    } else if (!isIdentityStep) {
        // ── Technical Review Step (Supervisor / Subsystem Lead / etc.) ────
        // Load assignment data FIRST so subsystem is ready before filtering
        await _loadAssignmentData(app);

        if (app.ligo_member) {
            // Lock the LIGO radio if already confirmed in DB
            const ligoConfirmBtn = _modal.querySelector('#rm-ligo-confirm-btn');
            if (ligoConfirmBtn) {
                ligoConfirmBtn.disabled = true;
                ligoConfirmBtn.style.opacity = '0.5';
                ligoConfirmBtn.innerHTML = `<span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_14.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_14.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block; margin-right:4px;"></span> Confirmed`;

                const group = _modal.querySelector('.rm-radio-group');
                if (group) group.classList.add('rm-radio-group--locked');
                _modal.querySelectorAll('input[name="ligo_member"]').forEach(r => r.disabled = true);
            }
        }

        // ALWAYS load services so blocks exist in DOM.
        // _applyServiceFilters() will handle show/hide based on LIGO + subsystem state.
        await _loadServices();
    }
    // Note: isIdentityStep && !isLiCoordinator → left col is hidden entirely, no data loading needed

    await Promise.all(loaders);

    // Always try to render past recommendations if we have the cache
    if (!_servicesCache) {
        try {
            const sRes = await authFetch(API.REVIEW_SERVICES);
            if (sRes.ok) _servicesCache = await sRes.json();
        } catch (e) { }
    }
    if (_servicesCache) {
        _renderPastRecommendations(app, _servicesCache);
    }

    // Apply specific behavior for roles that shouldn't edit assignment
    // OR if it's already assigned in the database (locked)
    if (!isIdentityStep && (app.role_slug !== 'supervisor' || app.assigned_subsystem_id) && app.assigned_subsystem_id) {
        const sub = _subsystemsCache?.find(s => s.id == app.assigned_subsystem_id);
        const subName = sub ? sub.name : 'Unknown Subsystem';
        const sysName = sub ? sub.system_name : 'Unknown System';

        // ⚠️ IMPORTANT: Include a hidden #rm-subsystem so _applyServiceFilters
        // can still read the subsystem ID when the dropdown is replaced with text.
        subGrp.innerHTML = `
            <label class="rm-label">Assigned Subsystem</label>
            <input class="rm-input" style="width: 100%; box-sizing: border-box; background:#f8fafc; color:#475569; padding:0.5rem; font-size:0.85rem; border:1px solid #e2e8f0; cursor:not-allowed;" type="text" disabled readonly value="${__esc(subName)}">
            <input type="hidden" id="rm-subsystem" value="${__esc(String(app.assigned_subsystem_id))}">
        `;
        sysGrp.innerHTML = `
            <label class="rm-label">Assigned System</label>
            <input class="rm-input" style="width: 100%; box-sizing: border-box; background:#f8fafc; color:#475569; padding:0.5rem; font-size:0.85rem; border:1px solid #e2e8f0; cursor:not-allowed;" type="text" disabled readonly value="${__esc(sysName)}">
        `;
        subGrp.style.display = 'block';
        sysGrp.style.display = 'block';
    }

    // Reapplication Diff Banner Setup
    const reapplyBanner = _modal.querySelector('#rm-reapply-banner');
    if (app.reapplied_from) {
        reapplyBanner.innerHTML = `
            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 1rem; border-radius: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_15.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_15.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 16px; height: 16px; display: inline-block;"></span>
                    </div>
                    <div>
                        <div style="font-weight: 800; color: #166534; font-size: 0.85rem;">Reapplied Application</div>
                        <div style="color: #15803d; font-size: 0.78rem; font-weight: 500;">Compare differences with the previous submission.</div>
                    </div>
                </div>
                <button id="rm-view-diff-btn" class="btn" style="background: #10b981; color: white; border: none; font-size: 0.78rem; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(16,185,129,0.2); display: flex; align-items: center; gap: 4px;">
                    🔍 Compare Apps
                </button>
            </div>
        `;
        reapplyBanner.style.display = 'block';

        const viewDiffBtn = reapplyBanner.querySelector('#rm-view-diff-btn');
        viewDiffBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const originalText = viewDiffBtn.innerHTML;
            viewDiffBtn.disabled = true;
            viewDiffBtn.innerHTML = `Loading...`;
            
            try {
                const res = await authFetch(API.APPLICATION_DIFF(app.id));
                if (!res.ok) throw new Error('Failed to load comparison data');
                const data = await res.json();
                if (data.has_comparison) {
                    _showReapplyDiffOverlay(data.current, data.previous);
                } else {
                    alert('No previous application data found to compare.');
                }
            } catch (err) {
                console.error(err);
                alert('Error loading comparison data: ' + err.message);
            } finally {
                viewDiffBtn.disabled = false;
                viewDiffBtn.innerHTML = originalText;
            }
        });
    } else {
        reapplyBanner.style.display = 'none';
        reapplyBanner.innerHTML = '';
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
        const rInitials = __esc(r.name).substring(0, 2).toUpperCase();
        const formattedDate = r.date ? new Date(r.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

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
                                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/clock.svg) no-repeat center; mask: url(/assets/icons/clock.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
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
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/check.svg) no-repeat center; mask: url(/assets/icons/check.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>
                        </div>
                    `;
                } else {
                    innerHtml = items.filter(name => name !== svcName).map(name => `
                        <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; background:#f0fdf4; color:#166534; padding:0.25rem 0.6rem; border-radius:0.4rem; border:1px solid #bbf7d0; font-weight: 700;">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/chevron-down.svg) no-repeat center; mask: url(/assets/icons/chevron-down.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 10px; height: 10px; display: inline-block;"></span>
                            ${__esc(name)}
                        </div>
                    `).join('');

                    if (items.some(name => name === svcName)) {
                        innerHtml += `
                            <div style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; background:#10b981; color:white; border-radius:50%; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/check.svg) no-repeat center; mask: url(/assets/icons/check.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>
                            </div>
                        `;
                    }
                }

                servicesHtml += `
                    <div style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.025em; min-width: 120px; flex-shrink: 0;">
                            ${__esc(svcName)}
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

        const displayRemark = r.remarks && r.remarks.trim() !== '' ? `"${__esc(r.remarks)}"` : '—';
        const isOpen = index === 0 ? 'open' : '';

        let headerText = 'Approved';
        if (r.action === 'Returned for Correction') headerText = 'Correction needed';
        else if (r.action === 'Final Rejection' || r.action === 'Rejected' || r.action === 'Declined' || r.action === 'decline' || r.action === 'final_rejection') headerText = 'Declined';
        else if (r.action?.includes('identity')) headerText = 'Identity Verified';

        const isIdentityVerified = headerText === 'Identity Verified';

        if (isIdentityVerified) {
            html += `
                <div class="rm-past-item" style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); padding: 1.25rem;">
                    <div style="display:flex; align-items:center; gap: 0.75rem;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; border: 1px solid #e2e8f0;">
                            ${rInitials}
                        </div>
                        <div style="flex-grow: 1;">
                            <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; line-height: 1.2;">
                                Identity Verified by ${__esc(r.name)}
                            </div>
                            <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                                ${__esc(r.role)} • ${formattedDate}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; background:#10b981; color:white; border-radius:50%; box-shadow: 0 2px 4px rgba(16,185,129,0.2);">
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_19.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_19.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
                        </div>
                    </div>
                    ${r.remarks && r.remarks.trim() !== '' ? `
                        <div style="margin-top: 1rem; background:#f1f5f9; border-left:3px solid #94a3b8; padding:0.6rem 0.75rem; font-size:0.85rem; color:#475569; font-style:italic; border-radius:4px; font-weight: 500;">
                            "${__esc(r.remarks)}"
                        </div>
                    ` : ''}
                </div>
            `;
            return; // Skip rendering the complex expandable card for identity approvals
        }

        const isSimpleLog = r.action === 'Returned for Correction' || r.action === 'Final Rejection' || r.action === 'Rejected' || r.action === 'Declined' || r.action === 'decline' || r.action === 'final_rejection';

        html += `
            <details class="rm-past-item" ${isOpen} style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); transition: all 0.3s ease;">
                <summary style="display:flex; align-items:center; gap: 0.75rem; padding: 1.25rem; cursor: pointer; list-style: none; user-select: none; transition: background 0.2s;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: ${headerText === 'Declined' ? '#fee2e2' : (headerText === 'Correction needed' ? '#fef3c7' : '#eef2ff')}; color: ${headerText === 'Declined' ? '#ef4444' : (headerText === 'Correction needed' ? '#d97706' : '#4f46e5')}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; border: 1px solid ${headerText === 'Declined' ? '#fca5a5' : (headerText === 'Correction needed' ? '#fde68a' : '#e2e8f0')};">
                        ${rInitials}
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; line-height: 1.2;">
                            ${headerText} by ${__esc(r.name)}
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                            ${__esc(r.role)} • ${formattedDate}
                        </div>
                    </div>
                    <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/chevron-down.svg) no-repeat center; mask: url(/assets/icons/chevron-down.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 18px; height: 18px; display: inline-block; margin-left: auto; transition: transform 0.3s; color: #94a3b8;"></span>
                </summary>

                <div style="padding: 0 1.25rem 1.5rem;">
                    <div style="padding-top: 1.25rem; border-top: 1px solid #f1f5f9;">
                        ${isSimpleLog ? '' : `
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">LIGO Member</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${app.ligo_member === 'yes' ? 'Yes' : 'No'}</div>
                            </div>
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Recommended Duration</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${r.duration ? __esc(r.duration) : 'Not specified'}</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Assigned System</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${__esc(assignedSystemName)}</div>
                            </div>
                            <div class="rm-field-group">
                                <label class="rm-label" style="color:#64748b; font-size: 0.8rem;">Assigned Subsystem</label>
                                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${__esc(assignedSubsystemName)}</div>
                            </div>
                        </div>

                        ${servicesHtml}
                        `}

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
        body.innerHTML = _buildProfileHtml(p, _currentApp);
        
        // Blocked User Logic Overlay
        if (p.status === 'deactivated' || p.is_blocked) {
            _showBlockedApplicantWarning();
        }
    } catch (err) {
        console.error('Profile fetch error:', err, 'for userId:', userId);
        console.error('Error stack:', err.stack);
        body.innerHTML = _buildProfileFallback(app);
    }

    // Wire up ID card preview if button exists
    const idBtn = body.querySelector('#rm-identity-btn');
    if (idBtn) idBtn.addEventListener('click', () => _triggerIdPreview(userId));

    // Wire up Compare Identity button if duplicate warning exists
    const compareBtn = body.querySelector('#rm-compare-identity-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', () => {
            let matches = [];
            try { matches = JSON.parse(compareBtn.dataset.matches || '[]'); } catch (e) { }
            _openCompareOverlay(userId, matches);
        });
    }
}

function _showBlockedApplicantWarning() {
    const leftCol = _modal.querySelector('.rm-left');
    const formBody = leftCol.querySelector('.rm-form-body');
    const footer = leftCol.querySelector('.rm-footer');
    
    // Hide standard form elements and show warning
    formBody.innerHTML = `
        <div style="padding: 1.5rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; margin-bottom: 1.5rem;">
            <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 1rem;">
                <div style="width:40px; height:40px; border-radius:50%; background:#fee2e2; color:#ef4444; display:flex; align-items:center; justify-content:center;">
                    <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/shield-off.svg) no-repeat center; mask: url(/assets/icons/shield-off.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                </div>
                <div>
                    <h3 style="margin:0; font-size:1.1rem; color:#991b1b; font-weight:800;">Applicant is Blocked</h3>
                    <p style="margin:0; font-size:0.8rem; color:#b91c1c;">This user has been administratively deactivated.</p>
                </div>
            </div>
            <p style="color:#7f1d1d; font-size:0.9rem; line-height:1.5; font-weight:500;">
                You cannot recommend this application to the next level because the applicant's account is currently blocked. You must either decline the application manually, or remove it from your queue (which will automatically decline it).
            </p>
        </div>
        
        <div class="rm-field-group">
            <label class="rm-label" for="rm-remarks">
                Comments (Optional)
            </label>
            <textarea id="rm-remarks" class="rm-textarea" rows="3" placeholder="Add a note..."></textarea>
        </div>
        
        <div id="rm-decision-panel" style="display:none; margin-top: 1rem; padding: 1.25rem; border-radius: 0.75rem; border: 1.5px solid #e2e8f0; background: #f8fafc;">
            <h4 id="rm-decision-title" style="margin-top: 0; margin-bottom: 1rem; font-size: 0.95rem; font-weight: 700;">Decision Details</h4>
            <div id="rm-correction-options" style="margin-bottom: 1rem;">
                <label class="rm-label" id="rm-options-label" style="display:block; margin-bottom: 0.5rem; font-weight: 500;"></label>
                <div id="rm-decision-checkboxes" style="display:flex; flex-direction:column; gap: 0.5rem;"></div>
            </div>
            <div style="display:flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem;">
                <button id="rm-decision-cancel" class="rm-btn-secondary" style="background:white;">Cancel</button>
                <button id="rm-decision-confirm" class="btn" style="padding: 0.5rem 1.5rem; font-weight:700;">Confirm Action</button>
            </div>
        </div>
    `;
    
    // Replace footer buttons
    footer.innerHTML = `
        <button id="rm-reject-btn" class="rm-btn-secondary rm-btn-decline" style="flex:1;">
            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/x-circle.svg) no-repeat center; mask: url(/assets/icons/x-circle.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
            Decline Application
        </button>
        <button id="rm-remove-app-btn" class="btn" style="flex:1; background:#ef4444; border:1px solid #ef4444; color:white; display:flex; align-items:center; justify-content:center; gap:8px;">
            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/trash-2.svg) no-repeat center; mask: url(/assets/icons/trash-2.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>
            Remove Application
        </button>
    `;
    
    // Rewire remarks
    const remarksField = _modal.querySelector('#rm-remarks');
    if (remarksField) {
        remarksField.value = _reviewState[_currentApp.id].remarks || '';
        remarksField.addEventListener('input', (e) => {
            _reviewState[_currentApp.id].remarks = e.target.value;
        });
    }
    
    // Rewire decision panel toggles
    _modal.querySelector('#rm-reject-btn').addEventListener('click', () => _showDecisionPanel('decline'));
    _modal.querySelector('#rm-decision-cancel').addEventListener('click', () => _hideDecisionPanel());
    _modal.querySelector('#rm-decision-confirm').addEventListener('click', () => _handleDecisionConfirm());
    
    // Wire remove button to auto-decline
    _modal.querySelector('#rm-remove-app-btn').addEventListener('click', () => {
        const payload = {
            action: 'decline',
            rejection_reason: 'Other', // Required by backend for final rejections
            remarks: 'User is blocked, hence removed application by declining'
        };
        const btn = _modal.querySelector('#rm-remove-app-btn');
        btn.textContent = 'Removing...';
        btn.disabled = true;
        _executeDecision(payload, null, btn, false, null);
    });
}

async function _openCompareOverlay(currentUserId, matches) {
    const overlay = _modal.querySelector('#rm-compare-overlay');
    const leftPane = overlay.querySelector('#rm-compare-applicant');
    const rightPane = overlay.querySelector('#rm-compare-duplicate');
    const navBar = overlay.querySelector('#rm-compare-nav');
    const counter = overlay.querySelector('#rm-compare-counter');
    const prevBtn = overlay.querySelector('#rm-compare-prev');
    const nextBtn = overlay.querySelector('#rm-compare-next');

    const labelLeft = `<div style="text-align:center; margin-bottom:1rem;"><span style="background:#eef2ff; color:#6366f1; font-weight:800; font-size:0.75rem; padding:3px 12px; border-radius:99px; text-transform:uppercase; letter-spacing:0.05em;">Current Applicant</span></div>`;
    const labelRight = (idx, total) => `<div style="text-align:center; margin-bottom:1rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;"><span style="background:#fef2f2; color:#ef4444; font-weight:800; font-size:0.75rem; padding:3px 12px; border-radius:99px; text-transform:uppercase; letter-spacing:0.05em;">Potential Duplicate ${total > 1 ? idx + 1 + ' / ' + total : ''}</span></div>`;

    // Show overlay with loading state
    leftPane.innerHTML = labelLeft + `<div style="text-align:center; padding:2rem; color:#94a3b8;">Loading…</div>`;
    rightPane.innerHTML = labelRight(0, matches.length) + `<div style="text-align:center; padding:2rem; color:#94a3b8;">Loading…</div>`;
    navBar.style.display = matches.length > 1 ? 'flex' : 'none';
    overlay.style.display = 'block';

    // Fetch current applicant profile once
    let leftProfile = null;
    try {
        const res = await authFetch(API.APPLICANT_PROFILE(currentUserId));
        if (res.ok) leftProfile = await res.json();
    } catch (e) { }

    // Fetch ALL duplicate profiles in parallel
    const dupProfiles = await Promise.all(
        matches.map(async (m) => {
            try {
                const res = await authFetch(API.APPLICANT_PROFILE(m.matched_user_id));
                return res.ok ? await res.json() : null;
            } catch (e) { return null; }
        })
    );

    // ── helpers ────────────────────────────────────────────────────────────
    const _cmp = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    const _row = (label, valA, valB) => {
        const same = _cmp(valA, valB);
        return `
        <tr style="${same ? '' : 'background:#fef9c3;'} border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.5rem 0.75rem; font-size:0.8rem; color:#64748b; font-weight:600; white-space:nowrap; width:38%;">${__esc(label)}</td>
            <td style="padding:0.5rem 0.75rem; font-size:0.85rem; color:#0f172a; font-weight:${same ? '400' : '700'}; word-break:break-word;">${__esc(String(valA || '—'))}</td>
        </tr>`;
    };

    const _buildCard = (profile, riskInfo, ref) => {
        if (!profile) return `<div style="padding:2rem; text-align:center; color:#94a3b8;">Profile not available</div>`;
        const fullName = [profile.title, profile.first_name, profile.last_name].filter(Boolean).join(' ');
        const initials = [(profile.first_name || '').charAt(0), (profile.last_name || '').charAt(0)].join('').toUpperCase() || '?';
        let riskBadge = '';
        if (riskInfo) {
            const rc = riskInfo.risk_level === 'high' ? '#ef4444' : riskInfo.risk_level === 'medium' ? '#f59e0b' : '#6366f1';
            riskBadge = `<div style="margin-bottom:1rem; text-align:center;"><span style="background:${rc}1a; color:${rc}; font-weight:800; font-size:0.7rem; padding:2px 10px; border-radius:99px; border:1px solid ${rc}40;">${(riskInfo.risk_level || '').toUpperCase()} RISK — ${__esc((riskInfo.reasons || []).join(', ') || 'Similarity detected')}</span></div>`;
        }
        return `
            <div style="text-align:center; margin-bottom:1.25rem;">
                <div style="background:#6366f1; color:white; width:52px; height:52px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem; margin-bottom:0.5rem;">${__esc(initials)}</div>
                <div style="font-weight:800; font-size:1rem; color:#0f172a;">${__esc(fullName)}</div>
                <div style="font-size:0.8rem; color:#64748b;">${__esc(profile.email || '')}</div>
            </div>
            ${riskBadge}
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                ${_row('Email', profile.email, ref?.email)}
                ${_row('Gender', profile.gender, ref?.gender)}
                ${_row('Date of Birth', profile.date_of_birth, ref?.date_of_birth)}
                ${_row('Institute', profile.institute_name, ref?.institute_name)}
                ${_row('Category', profile.designation, ref?.designation)}
                ${_row('Country', profile.country_name, ref?.country_name)}
                ${_row('Phone', profile.phone_number, ref?.phone_number)}
                ${_row('Qualification', profile.highest_qualification, ref?.highest_qualification)}
                ${_row('Field of Study', profile.field_of_study, ref?.field_of_study)}
                ${_row('University', profile.university, ref?.university)}
            </table>`;
    };

    // ── render at a given index ─────────────────────────────────────────────
    let currentIdx = 0;
    const _render = (idx) => {
        currentIdx = idx;
        counter.textContent = `Match ${idx + 1} of ${matches.length}`;
        prevBtn.disabled = idx === 0;
        prevBtn.style.opacity = idx === 0 ? '0.4' : '1';
        nextBtn.disabled = idx === matches.length - 1;
        nextBtn.style.opacity = idx === matches.length - 1 ? '0.4' : '1';

        leftPane.innerHTML = labelLeft + _buildCard(leftProfile, null, leftProfile);
        rightPane.innerHTML = labelRight(idx, matches.length) + _buildCard(dupProfiles[idx], matches[idx], leftProfile);
    };

    _render(0);

    // Remove old listeners by cloning nav buttons
    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    prevBtn.replaceWith(newPrev);
    nextBtn.replaceWith(newNext);
    overlay.querySelector('#rm-compare-prev').addEventListener('click', () => { if (currentIdx > 0) _render(currentIdx - 1); });
    overlay.querySelector('#rm-compare-next').addEventListener('click', () => { if (currentIdx < matches.length - 1) _render(currentIdx + 1); });

    if (window.feather) feather.replace();
}

function _showReapplyDiffOverlay(current, previous) {
    const overlay = _modal.querySelector('#rm-reapply-diff-overlay');
    const tbody = overlay.querySelector('#rm-reapply-diff-tbody');

    overlay.querySelector('#rm-diff-curr-id').textContent = current.application_id;
    overlay.querySelector('#rm-diff-prev-id').textContent = previous.application_id;

    const _cmp = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    const _row = (label, valA, valB) => {
        const same = _cmp(valA, valB);
        return `
        <tr style="${same ? '' : 'background:#fffbeb;'} border-bottom:1px solid #f1f5f9; transition: background 0.15s;">
            <td style="padding:0.75rem; font-size:0.85rem; color:#64748b; font-weight:700; vertical-align:top;">${__esc(label)}</td>
            <td style="padding:0.75rem; font-size:0.9rem; color:#0f172a; font-weight:${same ? '400' : '800'}; word-break:break-word; vertical-align:top;">${__esc(String(valA || '—'))}</td>
            <td style="padding:0.75rem; font-size:0.9rem; color:#475569; font-weight:400; word-break:break-word; vertical-align:top;">${__esc(String(valB || '—'))}</td>
        </tr>`;
    };

    const _rowIdCard = (label, valA, valB, pathA, pathB) => {
        const same = _cmp(valA, valB);
        const token = getAccessToken();
        const linkA = pathA ? `<a href="${BASE_URL}/api/auth/files/view?path=${encodeURIComponent(pathA)}&token=${encodeURIComponent(token)}" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:700;">${__esc(valA)}</a>` : '—';
        const linkB = pathB ? `<a href="${BASE_URL}/api/auth/files/view?path=${encodeURIComponent(pathB)}&token=${encodeURIComponent(token)}" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:700;">${__esc(valB)}</a>` : '—';
        return `
        <tr style="${same ? '' : 'background:#fffbeb;'} border-bottom:1px solid #f1f5f9; transition: background 0.15s;">
            <td style="padding:0.75rem; font-size:0.85rem; color:#64748b; font-weight:700; vertical-align:top;">${__esc(label)}</td>
            <td style="padding:0.75rem; font-size:0.9rem; color:#0f172a; vertical-align:top;">${linkA}</td>
            <td style="padding:0.75rem; font-size:0.9rem; color:#475569; vertical-align:top;">${linkB}</td>
        </tr>`;
    };

    let html = '';
    // Personal Details
    html += _row('Applicant Name', current.name, previous.name);
    html += _row('Designation / Category', current.designation, previous.designation);
    html += _row('Institute', current.institute, previous.institute);
    html += _row('Highest Qualification', current.qualification, previous.qualification);
    html += _row('Country', current.country, previous.country);
    html += _row('Phone Number', current.phone, previous.phone);

    // Application Details
    html += _row('Supervisor', current.supervisor, previous.supervisor);
    html += _row('LIGO Member', current.ligo_member, previous.ligo_member);
    html += _row('Requested Duration', current.duration, previous.duration);
    html += _row('Assigned System', current.system, previous.system);
    html += _row('Assigned Subsystem', current.subsystem, previous.subsystem);
    html += _row('Recommended Services', current.services, previous.services);
    html += _row('Recommended Subservices', current.subservices, previous.subservices);

    // Documents
    html += _rowIdCard('Identity Card / Proof', current.id_card_filename, previous.id_card_filename, current.id_card_path, previous.id_card_path);

    tbody.innerHTML = html;
    overlay.style.display = 'block';
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
        if (!_currentApp.is_id_approved) {
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

function _buildServicesHtml(services) {
    if (!services || services.length === 0) {
        return `<p class="rm-empty-services">No services configured yet.</p>`;
    }

    const state = _reviewState[_currentApp.id];
    const recSvcs = (state.service_ids || []).map(String);
    const recSubs = (state.subservice_ids || []).map(String);
    console.log('[ReviewModal] Building Services HTML. IDs to check:', recSvcs);

    const hintHtml = (recSvcs.length > 0 || recSubs.length > 0)
        ? `<div style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 0.6rem; color: #0369a1; font-size: 0.8rem; display: flex; align-items: center; gap: 8px;">
            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_21.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_21.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 16px; height: 16px; display: inline-block;"></span>
            <span>Services pre-selected based on previous approval. You may modify them.</span>
           </div>`
        : '';

    return hintHtml + services.map(svc => {
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
                    <span class="rm-sub-name">${__esc(sub.name)}</span>
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
                               data-is-computing="${svc.is_computing ? '1' : '0'}"
                               name="service[]"
                               value="${svc.id}"
                               ${isSvcChecked}>
                        <span class="rm-cb-custom rm-cb-service"></span>
                        <div class="rm-svc-info">
                            <span class="rm-svc-name">${__esc(svc.name)}</span>
                            <span class="rm-svc-code">${__esc(svc.code)}</span>
                        </div>
                    </label>
                    <div class="rm-svc-toggle" data-service-id="${svc.id}" style="padding: 0.8rem 1rem; cursor: pointer; color: #94a3b8; transition: transform 0.2s; display: ${hasSubservices ? 'block' : 'none'};">
                        <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_22.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_22.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                    </div>
                </div>
                <div class="rm-subservices" id="svc-subs-${svc.id}" style="display: none;">
                    ${subHtml}
                </div>
            </div>`;
    }).join('');
}

function _updateServicesState() {
    if (!_currentApp || !_reviewState[_currentApp.id]) return;
    const list = _modal.querySelector('#rm-services-list');
    if (!list) return;

    // We collect from ALL blocks in the list, not just visible ones.
    const allBlocks = [...list.querySelectorAll('.rm-service-block')];
    if (allBlocks.length === 0) return;

    const selectedServiceObjects = allBlocks.flatMap(b => [...b.querySelectorAll('.rm-svc-cb:checked')]).map(cb => ({
        id: cb.value,
        name: cb.closest('.rm-service-block').querySelector('.rm-svc-name').textContent,
        is_computing: cb.dataset.isComputing === '1'
    }));

    const selectedSubservices = allBlocks.flatMap(b => [...b.querySelectorAll('.rm-sub-cb:checked')]).map(cb => cb.value);

    _reviewState[_currentApp.id].service_ids = selectedServiceObjects.map(s => s.id);
    _reviewState[_currentApp.id].selected_services = selectedServiceObjects;
    _reviewState[_currentApp.id].subservice_ids = selectedSubservices;

    const hasComputing = selectedServiceObjects.some(s => s.is_computing);
    console.log('[ReviewModal] Selection updated. Has Computing:', hasComputing);
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
            _updateServicesState();
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
            const svcId = subCb.dataset.serviceId;
            const svcCb = list.querySelector(`.rm-svc-cb[data-service-id="${svcId}"]`);
            const allSubs = [...list.querySelectorAll(`.rm-sub-cb[data-service-id="${svcId}"]`)];
            if (svcCb) svcCb.checked = allSubs.every(s => s.checked);
            _updateServicesState();
            _syncSelectAll();
        });
    });

    _syncSelectAll();
}


function _handleSelectAll(e) {
    const checked = e.target.checked;
    const list = _modal.querySelector('#rm-services-list');
    if (!list) return;

    // ONLY affect visible blocks
    const visibleBlocks = [...list.querySelectorAll('.rm-service-block')].filter(b => b.style.display !== 'none');

    visibleBlocks.forEach(block => {
        block.querySelectorAll('.rm-svc-cb, .rm-sub-cb').forEach(cb => {
            if (!cb.disabled) cb.checked = checked;
        });
    });

    _updateServicesState();
}

function _syncSelectAll() {
    const blocks = [..._modal.querySelectorAll('.rm-service-block')].filter(b => b.style.display !== 'none');

    const all = blocks.flatMap(b => {
        const subs = [...b.querySelectorAll('.rm-sub-cb')];
        // If has subservices, the subservices are the source of truth for "all"
        if (subs.length > 0) return subs;
        // Otherwise, the service itself is the source of truth
        return [...b.querySelectorAll('.rm-svc-cb')];
    });

    const checked = all.filter(cb => cb.checked);
    const selAll = _modal.querySelector('#rm-select-all');
    if (selAll) {
        selAll.checked = all.length > 0 && checked.length === all.length;
        console.log('[ReviewModal] SyncSelectAll:', checked.length, '/', all.length, 'checked');
    }
}

// ── Submit decision ───────────────────────────────────────────────────────────
async function _submitDecision(action, extraPayload = {}) {
    _hideFeedback();
    const state = _reviewState[_currentApp.id];
    const remarks = state.remarks.trim();

    // Final rejection requires a reason
    if (action === 'final_rejection' && !remarks) {
        _showFeedback('A reason/comment is required for this action.', 'error');
        return;
    }

    _setButtonsEnabled(false);

    const approveBtn = _modal.querySelector('#rm-approve-btn');
    const rejectBtn = _modal.querySelector('#rm-reject-btn');
    const actionText = (_currentApp.step_action || '').toLowerCase();
    const statusText = (_currentApp.current_status || '').toLowerCase();
    const isIdentityStep = actionText.includes('identity') || statusText.includes('identity');

    // Collect selected services & subservices from state
    const selectedSubservices = state.subservice_ids;
    const selectedServices = state.service_ids;
    const ligoMember = state.ligo_member;
    const duration = state.duration;
    const subsystemId = state.subsystem_id;
    const systemId = _modal.querySelector('#rm-system-id')?.value || _currentApp.assigned_system_id || null;

    // ── Pre-submission validation ─────────────────────────────────────────────
    const isLiCoordinator = _currentApp.role_slug === 'li_coordinator';

    if (action === 'approve') {

        if (isIdentityStep && isLiCoordinator) {
            // ── LI-Coordinator: only subsystem needed to route application ──
            if (!subsystemId) {
                _showFeedback('Assignment Required: Please select a Subsystem to route this application.', 'error');
                _setButtonsEnabled(true);
                const subSel = _modal.querySelector('#rm-subsystem');
                if (subSel) subSel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

        } else if (isIdentityStep && !isLiCoordinator) {
            // ── Other reviewers at identity step ────────────────────────────
            if (_currentApp.id_card_path && !_currentApp.is_id_approved) {
                _showFeedback("Identity Verification Required: Please approve the applicant's identity card first.", 'error');
                _setButtonsEnabled(true);
                return;
            }

        } else {
            // ── Technical Review Step (Supervisor / Subsystem Lead) ─────────
            // Step 1: LIGO membership must be confirmed
            if (!ligoMember) {
                _showFeedback('Step 1 Required: Please confirm LIGO Membership status before approving.', 'error');
                _setButtonsEnabled(true);
                const ligoGrp = _modal.querySelector('#rm-ligo-group');
                if (ligoGrp) ligoGrp.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            // Step 2: Subsystem must be selected
            if (!subsystemId) {
                _showFeedback('Step 2 Required: Please select a Subsystem before approving.', 'error');
                _setButtonsEnabled(true);
                const subSel = _modal.querySelector('#rm-subsystem');
                if (subSel) subSel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            // Step 3: At least one service must be selected
            if (!selectedServices || selectedServices.length === 0) {
                _showFeedback('Step 3 Required: Please select at least one Service before approving.', 'error');
                _setButtonsEnabled(true);
                const svcList = _modal.querySelector('#rm-services-list');
                if (svcList) svcList.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }
    }

    const payload = {
        action: action,
        remarks: remarks || undefined,
        rejection_reason: remarks || undefined,
        ligo_member: ligoMember,
        duration: duration,
        subsystem_id: subsystemId || undefined,
        system_id: systemId || undefined,
        service_ids: selectedServices,
        subservice_ids: selectedSubservices,
        ...extraPayload
    };

    // Show confirmation preview for non-identity approve steps only
    if (action === 'approve' && !isIdentityStep) {
        _showConfirmationPreview(payload, approveBtn, rejectBtn, isIdentityStep);
    } else {
        _executeDecision(payload, approveBtn, rejectBtn, isIdentityStep);
    }
}

function _showRejectionModal(payload, approveBtn, rejectBtn, isIdentityStep, actionType) {
    _setButtonsEnabled(false);
    const dialog = _modal.querySelector('.rm-dialog');
    const overlay = document.createElement('div');
    overlay.className = 'rm-confirm-overlay';
    overlay.style = "position:absolute; inset:0; background:rgba(255,255,255,0.98); z-index:100; display:flex; align-items:center; justify-content:center; padding:2rem; animation: fadeIn 0.2s ease-out; border-radius: 1.25rem;";

    const isCorrection = actionType === 'return_for_correction';
    const themeColor = isCorrection ? '#f59e0b' : '#ef4444';
    const themeBg = isCorrection ? '#fffbeb' : '#fee2e2';
    const actionLabel = isCorrection ? 'Return for Correction' : 'Permanently Reject';

    const reasons = isCorrection
        ? ["Missing Identity Proof", "Incomplete Educational Details", "Invalid Institute Category", "Other"]
        : ["Invalid ID Card", "Invalid User", "User not known to supervisor", "Other"];

    overlay.innerHTML = `
        <div style="max-width: 440px; width: 100%; text-align: center;">
            <div style="background: ${themeBg}; color: ${themeColor}; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                ${isCorrection
            ? '<span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_23.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_23.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 32px; height: 32px; display: inline-block;"></span>'
            : '<span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_24.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_24.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 32px; height: 32px; display: inline-block;"></span>'
        }
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-bottom: 0.5rem;">${actionLabel}?</h3>
            <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 2rem;">${isCorrection ? 'Specify what the applicant needs to fix. They will be able to resubmit this same application.' : 'Permanently decline this application. The applicant will have to create a new application (if retry limits allow).'}</p>
            
            <div style="text-align: left; margin-bottom: 2rem;">
                <label style="display:block; font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:0.75rem;">Reason</label>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${reasons.map(r => `
                        <label style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border: 1.5px solid #e2e8f0; border-radius: 1rem; cursor: pointer; transition: all 0.2s;" class="rm-rejection-option">
                            <input type="radio" name="rejection_reason" value="${r}" style="width: 18px; height: 18px; accent-color: ${themeColor};">
                            <span style="font-size: 0.95rem; font-weight: 600; color: #475569;">${r}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem;">
                <button id="rm-rejection-cancel" style="flex: 1; padding: 0.85rem; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 0.75rem; font-weight: 700; font-size: 0.9rem; cursor: pointer;">Cancel</button>
                <button id="rm-rejection-confirm" disabled style="flex: 2; padding: 0.85rem; border: none; background: ${themeColor}; color: white; border-radius: 0.75rem; font-weight: 700; font-size: 0.9rem; cursor: not-allowed; transition: all 0.2s; opacity: 0.6;">Confirm ${isCorrection ? 'Correction' : 'Rejection'}</button>
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
            opt.style.borderColor = themeColor;
            opt.style.background = isCorrection ? '#fffbeb' : '#fff1f2';
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
                ${__esc(svc)}
                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_25.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_25.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 12px; height: 12px; display: inline-block;"></span>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 1.25rem; padding: 2.5rem; max-width: 550px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); text-align: left;">
            <div style="background: #eff6ff; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #2563eb;">
                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/check-circle.svg) no-repeat center; mask: url(/assets/icons/check-circle.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 24px; height: 24px; display: inline-block;"></span>
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
                        <div style="font-weight:700; color:#1e293b; font-size:1rem;">${__esc(payload.duration)}</div>
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
                        ${payload.remarks ? `"${__esc(payload.remarks)}"` : 'No additional remarks provided.'}
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
    _setButtonsEnabled(false);

    if (!overlay) {
        if (approveBtn) {
            approveBtn.textContent = payload.action === 'approve'
                ? (isIdentityStep ? '…Approving' : '…Recommending')
                : (isIdentityStep ? '✓ Approve Identity' : '✓ Recommend to Next Level');
        }
        if (rejectBtn) {
            rejectBtn.textContent = payload.action === 'reject' ? '…Declining' : '✕ Decline';
        }
    }

    try {
        if (isIdentityStep && payload.action === 'approve' && _currentApp.id_card_path) {
            await authFetch(API.APPROVE_ID_CARD(_currentApp.id), { method: 'POST' });
        }

        const res = await authFetch(API.DECIDE(_currentApp.id), {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        if (overlay) overlay.remove();
        _showFeedback(data.message || 'Done!', 'success');

        setTimeout(() => {
            const finishedId = _currentApp.id;
            _close();
            if (_onSuccess) _onSuccess();
            // Clear local state for this application now that it's finalized
            delete _reviewState[finishedId];
        }, 1400);

    } catch (err) {
        if (overlay) overlay.remove();

        let msg = err.message || 'Something went wrong.';
        let hint = 'Please check your connection or refresh the page.';

        // Attempt to parse structured error from backend
        try {
            if (err.data && err.data.error) msg = err.data.error;
            if (err.data && err.data.hint) hint = err.data.hint;
        } catch (e) { }

        _showFeedback(msg, 'error', hint);
        _setButtonsEnabled(true);
        _resetButtonLabels(approveBtn, rejectBtn, isIdentityStep);
    }
}

function _resetButtonLabels(approveBtn, rejectBtn, isIdentityStep) {
    approveBtn.innerHTML = isIdentityStep
        ? `✓ Approve Identity`
        : `<span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_4.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_4.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span> Recommend to Next Level`;

    rejectBtn.innerHTML = `✕ Decline`;
}

async function _approveIdCard(appId) {
    _setButtonsEnabled(false);
    try {
        const res = await authFetch(API.APPROVE_ID_CARD(appId), { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to approve ID card');

        _showFeedback('ID Card Approved Successfully!', 'success');
        _currentApp.is_id_approved = true;
        _currentApp.id_card_approved_by_name = 'You (Just Now)';
        _currentApp.id_card_approved_by_role = 'Current User';
        _currentApp.id_card_approved_at = new Date().toISOString();

        // Refresh dashboard in background (REMOVED to prevent wiping modal form state)
        // if (_onSuccess) _onSuccess();
        _loadModalData(_currentApp);
    } catch (err) {
        _showFeedback(err.message, 'error');
        _setButtonsEnabled(true);
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
    if (window.showToast) {
        const fullMsg = hint ? `${msg} (${hint})` : msg;
        window.showToast(fullMsg, type);
    } else {
        console.warn('[ReviewModal] showToast not found, falling back to alert:', msg);
        alert(msg);
    }
}

function _hideFeedback() {
    const el = _modal?.querySelector('#rm-feedback');
    if (el) el.style.display = 'none';
}

async function _handleLigoConfirm(val, btn) {
    // Guard: require a radio selection before confirming
    if (!val && val !== 'pending') {
        _showFeedback('Please select Yes or No for LIGO Membership before confirming.', 'error');
        return;
    }

    const radios = _modal.querySelectorAll('input[name="ligo_member"], input[name="ligo_us_member"], input[name="ligo_india_member"]');
    const subSelect = _modal.querySelector('#rm-subsystem');
    const resetBtn = _modal.querySelector('#rm-ligo-reset-btn');

    try {
        btn.disabled = true;
        if (resetBtn) resetBtn.disabled = true;
        const oldHtml = btn.innerHTML;
        btn.innerHTML = 'Saving...';
        
        const res = await authFetch(API.UPDATE_LIGO_MEMBER(_currentApp.id), {
            method: 'POST',
            body: JSON.stringify({ ligo_member: val || 'pending' })
        });
        
        if (!res.ok) throw new Error('Failed to save membership status');
        
        // Save to state so _submitDecision validation passes
        if (_currentApp && _reviewState[_currentApp.id]) {
            _reviewState[_currentApp.id].ligo_member = val === 'pending' ? '' : val;
        }
        
        // Update DB mirror
        _currentApp.ligo_member = val === 'pending' ? 'pending' : val;

        const groups = _modal.querySelectorAll('.rm-radio-group');
        
        if (val === 'pending') {
            // Unlocking (Reset)
            if (groups) groups.forEach(g => g.classList.remove('rm-radio-group--locked'));
            radios.forEach(r => r.disabled = false);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = `Confirm Membership`;
            if (resetBtn) {
                resetBtn.style.display = 'none';
                resetBtn.disabled = false;
            }
        } else {
            // Locking (Confirm)
            if (groups) groups.forEach(g => g.classList.add('rm-radio-group--locked'));
            radios.forEach(r => r.disabled = true);
            btn.style.opacity = '0.5';
            btn.innerHTML = `<span class="extracted-svg" style="width:12px;height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/check.svg); mask-image: url(/assets/icons/check.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Confirmed`;
            if (window.feather) feather.replace();
            if (resetBtn) {
                resetBtn.style.display = 'block';
                resetBtn.disabled = false;
            }
        }

        // 2. Enable subsystem dropdown now that LIGO is confirmed
        if (subSelect && !(_currentApp.role_slug !== 'supervisor' && _currentApp.role_slug !== 'li_coordinator' && _currentApp.assigned_subsystem_id)) {
            subSelect.disabled = false;
            subSelect.style.opacity = '1';
            subSelect.style.cursor = 'pointer';
        }

        // 3. Trigger service load if subsystem is already known
        const subValue = subSelect?.value || _currentApp.assigned_subsystem_id;
        if (subValue) {
            _triggerServiceFetch(val);
        } else {
            _applyServiceFilters();
        }
        
    } catch (err) {
        _showFeedback(err.message, 'error');
        btn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
        btn.innerHTML = val === 'pending' ? 'Reset' : 'Confirm Membership';
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



function _applyServiceFilters() {
    const state = _currentApp ? _reviewState[_currentApp.id] : null;

    // 1. Determine LIGO Status (Priority: State > DB Status)
    const stateLigo = state?.ligo_member;
    const dbLigo = _currentApp?.ligo_member;
    const hasDbLigo = dbLigo && dbLigo !== 'pending' && dbLigo !== 'unknown' && dbLigo !== '';

    // Consider LIGO confirmed if we have a valid state value OR it's from DB
    const isLigoConfirmed = !!(stateLigo || hasDbLigo);
    const isLigo = stateLigo ? (stateLigo === 'yes') : (dbLigo === 'yes');

    // 2. Determine Subsystem (Priority: Dropdown > State > DB)
    const subSelect = _modal.querySelector('#rm-subsystem');
    const subSelectValue = subSelect?.value;
    const dbSubsystem = _currentApp?.assigned_subsystem_id;
    const subsystemId = subSelectValue || state?.subsystem_id || dbSubsystem || null;

    const serviceList = _modal.querySelector('#rm-services-list');
    if (!serviceList) return;

    let visibleCount = 0;

    console.log('[ReviewModal] Applying Filters:', {
        subsystemId,
        isLigo,
        isLigoConfirmed,
        totalBlocks: serviceList.querySelectorAll('.rm-service-block').length
    });

    serviceList.querySelectorAll('.rm-service-block').forEach(block => {
        const blockSubsystemId = block.dataset.subsystemId;
        const blockIsLigo = block.dataset.isLigo === '1';

        const matchesSubsystem = subsystemId && String(blockSubsystemId) === String(subsystemId);
        const allowedByLigo = !blockIsLigo || isLigo;

        if (matchesSubsystem && allowedByLigo && isLigoConfirmed) {
            block.style.display = 'block';
            visibleCount++;
            // Re-apply pre-selected state from reviewState when a block becomes visible
            if (state) {
                const recSvcs = (state.service_ids || []).map(String);
                const recSubs = (state.subservice_ids || []).map(String);
                block.querySelectorAll('.rm-svc-cb').forEach(cb => { cb.checked = recSvcs.includes(String(cb.value)); });
                block.querySelectorAll('.rm-sub-cb').forEach(cb => { cb.checked = recSubs.includes(String(cb.value)); });
            }
        } else {
            block.style.display = 'none';
        }
    });

    let placeholder = serviceList.querySelector('.rm-services-placeholder');

    if (!isLigoConfirmed) {
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'rm-services-placeholder';
            serviceList.appendChild(placeholder);
        }
        placeholder.innerHTML = '<p style="color: #64748b; font-style: italic; font-size: 0.9rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; text-align: center;">Please confirm LIGO Membership above (Step 1) to view eligible services.</p>';
        placeholder.style.display = 'block';
    } else if (!subsystemId) {
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'rm-services-placeholder';
            serviceList.appendChild(placeholder);
        }
        placeholder.innerHTML = `
            <div style="padding:1.5rem; text-align:center; background:#f0f9ff; border:1px solid #bae6fd; border-radius:0.75rem; color:#0369a1; font-size:0.85rem;">
                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/ic_ui_element_27.svg) no-repeat center; mask: url(/assets/icons/ic_ui_element_27.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block; display:block; margin:0 auto 0.5rem;"></span>
                LIGO Status Confirmed. <br>Please select a <strong>Subsystem</strong> above to load services.
            </div>
        `;
        placeholder.style.display = 'block';
    } else {
        if (placeholder) placeholder.style.display = 'none';

        if (visibleCount === 0) {
            let emptyMsg = serviceList.querySelector('.rm-services-empty');
            if (!emptyMsg) {
                emptyMsg = document.createElement('div');
                emptyMsg.className = 'rm-services-empty';
                emptyMsg.innerHTML = '<p style="color: #64748b; font-style: italic; font-size: 0.9rem; padding: 1rem; background: #f8fafc; border-radius: 0.5rem; text-align: center;">No services available for this subsystem.</p>';
                serviceList.appendChild(emptyMsg);
            }
            emptyMsg.style.display = 'block';
        } else {
            const emptyMsg = serviceList.querySelector('.rm-services-empty');
            if (emptyMsg) emptyMsg.style.display = 'none';
        }
    }

    _syncSelectAll();
    _updateServicesState();
}

/** ── Decision Panel Logic ────────────────────────────────────────────────── */

let _pendingAction = null;

function _showDecisionPanel(action) {
    _pendingAction = action;
    _setButtonsEnabled(false);
    const panel = _modal.querySelector('#rm-decision-panel');
    const title = _modal.querySelector('#rm-decision-title');
    const optionsLabel = _modal.querySelector('#rm-options-label');
    const checkboxesContainer = _modal.querySelector('#rm-decision-checkboxes');
    const confirmBtn = _modal.querySelector('#rm-decision-confirm');
    const remarks = _modal.querySelector('#rm-remarks');

    panel.style.display = 'block';
    panel.style.animation = 'rmFadeIn 0.3s ease';

    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';

    const declineReasons = ["Invalid Institutional Affiliation", "Duplicate Application", "Incomplete/Invalid Documents", "Other"];

    if (action === 'correction') {
        checkboxesContainer.innerHTML = `
            <div style="padding: 0.75rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.5rem; color: #b45309; font-size: 0.85rem; font-weight: 600;">
                The applicant will be notified to upload a new valid identity card. The application workflow will pause and resume from this exact step once uploaded.
            </div>
        `;
    } else {
        checkboxesContainer.innerHTML = declineReasons.map(r => `
            <label style="display:flex; align-items:center; gap: 8px; font-size: 0.85rem; cursor:pointer;">
                <input type="radio" name="rejection_reason" value="${r}"> ${r}
            </label>
        `).join('');

        // Wire dynamic feedback placeholder and style updates
        setTimeout(() => {
            checkboxesContainer.querySelectorAll('input[name="rejection_reason"]').forEach(input => {
                input.addEventListener('change', () => {
                    if (input.value === 'Other') {
                        remarks.placeholder = 'Please specify the exact reason here... (Required)';
                        remarks.focus();
                    } else {
                        remarks.placeholder = 'Add any optional comments or additional details here...';
                    }
                });
            });
        }, 0);
    }

    // Clear previous data when switching
    remarks.value = '';
    remarks.placeholder = action === 'correction' 
        ? 'Please specify what the applicant needs to correct...'
        : 'Add any optional comments or additional details here...';

    if (action === 'correction') {
        title.textContent = 'Send Back for Valid ID Card?';
        optionsLabel.textContent = 'Please provide any specific remarks regarding why the current ID card was declined.';
        title.style.color = '#d97706';
        panel.style.borderColor = '#fbbf24';
        panel.style.background = '#fffbeb';
        confirmBtn.textContent = 'Confirm Send Back';
        confirmBtn.style.background = '#f59e0b';
        confirmBtn.style.color = 'white';
        confirmBtn.style.border = 'none';
        confirmBtn.style.outline = 'none';
    } else {
        title.textContent = 'Decline Application?';
        optionsLabel.textContent = 'Specify the reason for declining. The applicant will have to create a new application.';
        title.style.color = '#ef4444';
        panel.style.borderColor = '#f87171';
        panel.style.background = '#fef2f2';
        confirmBtn.textContent = 'Confirm Decline';
        confirmBtn.style.background = '#ef4444';
        confirmBtn.style.color = 'white';
        confirmBtn.style.border = 'none';
        confirmBtn.style.outline = 'none';
    }

    remarks.focus();
    remarks.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function _hideDecisionPanel() {
    _pendingAction = null;
    const panel = _modal.querySelector('#rm-decision-panel');
    panel.style.display = 'none';
    _setButtonsEnabled(true);
}

async function _handleDecisionConfirm() {
    const remarks = _modal.querySelector('#rm-remarks').value.trim();
    const confirmBtn = _modal.querySelector('#rm-decision-confirm');

    if (_pendingAction === 'correction') {
        const finalRemarks = remarks || "please upload a valid ID card else your application will be declined";
        _reviewState[_currentApp.id].remarks = finalRemarks;
        _modal.querySelector('#rm-remarks').value = finalRemarks;

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Submitting...';

        await _submitDecision('send_back_for_id');
    } else {
        const selectedReason = _modal.querySelector('input[name="rejection_reason"]:checked')?.value;
        if (!selectedReason) {
            _showFeedback('Please select a reason for declining the application.', 'error');
            return;
        }

        if (selectedReason === 'Other' && !remarks) {
            _showFeedback('Please specify the reason in the remarks/comment box.', 'error');
            _modal.querySelector('#rm-remarks').focus();
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Submitting...';

        // Sync formatted remarks to state so _submitDecision picks them up
        const finalRemarks = selectedReason === 'Other' ? remarks : selectedReason + (remarks ? ' - ' + remarks : '');
        _reviewState[_currentApp.id].remarks = finalRemarks.trim();
        _modal.querySelector('#rm-remarks').value = finalRemarks.trim();

        await _submitDecision('final_rejection', {
            rejection_reason: selectedReason,
            remarks: remarks.trim() || selectedReason // Use the actual remarks if provided, else the reason
        });
    }
}

async function _loadDurations() {
    if (_durationsCache) return _durationsCache;
    try {
        const res = await authFetch(API.REFERENCE_DURATIONS);
        if (res.ok) {
            _durationsCache = await res.json();
            return _durationsCache;
        }
    } catch (err) {
        console.error('Failed to load durations:', err);
    }
    return [];
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
        const sysInput = _modal.querySelector('#rm-system-name');
        const sysHidden = _modal.querySelector('#rm-system-id');
        const sysLeadHint = _modal.querySelector('#rm-system-lead-hint');
        const sysLeadName = _modal.querySelector('#rm-system-lead-name');

        if (!subSelect) return;

        // Populate Subsystems
        subSelect.innerHTML = '<option value="">-- Select Subsystem --</option>';
        _subsystemsCache.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            opt.dataset.systemId = s.system_id;
            opt.dataset.systemName = s.system_name;
            opt.dataset.systemLead = s.system_lead_name || 'System Lead';
            opt.dataset.subsystemLead = s.subsystem_lead_name || 'Subsystem Lead';
            subSelect.appendChild(opt);
        });

        const state = _reviewState[app.id];

        // Wire change event
        subSelect.onchange = () => {
            const opt = subSelect.options[subSelect.selectedIndex];
            const val = opt?.value || '';
            const oldVal = state.subsystem_id;
            state.subsystem_id = val;

            if (val) {
                sysInput.value = opt.dataset.systemName;
                sysHidden.value = opt.dataset.systemId;

                if (sysLeadHint && sysLeadName) {
                    sysLeadHint.style.display = 'block';
                    let nextRoleName = 'Next Reviewer';
                    let nextPersonName = opt.dataset.systemLead;

                    if (app.role_slug === 'supervisor') {
                        nextRoleName = 'Subsystem Lead';
                        nextPersonName = opt.dataset.subsystemLead;
                    }
                    sysLeadName.textContent = nextPersonName;
                }
            } else {
                sysInput.value = '';
                sysHidden.value = '';
                if (sysLeadHint) sysLeadHint.style.display = 'none';
            }
            _applyServiceFilters();
        };

        // Initial pre-select from state or app
        const targetSubId = state.subsystem_id || app.assigned_subsystem_id;
        if (targetSubId) {
            subSelect.value = targetSubId;
            if (subSelect.value == targetSubId) {
                const opt = subSelect.options[subSelect.selectedIndex];
                if (opt && opt.value) {
                    sysInput.value = opt.dataset.systemName;
                    sysHidden.value = opt.dataset.systemId;
                    if (sysLeadHint) {
                        sysLeadHint.style.display = 'block';
                        sysLeadName.textContent = opt.dataset.systemLead;
                    }
                }
            }
        }

        // Sync LIGO radios
        const ligoVal = state.ligo_member || app.ligo_member;
        if (ligoVal) {
            const radio = _modal.querySelector(`input[name="ligo_member"][value="${ligoVal}"]`);
            if (radio) radio.checked = true;
        }

        _applyServiceFilters();

        // UI states
        if (app.role_slug !== 'supervisor' && app.role_slug !== 'li_coordinator' && app.assigned_subsystem_id) {
            subSelect.disabled = true;
        }

        const isLigoLocked = _modal.querySelector('.rm-radio-group--locked') || app.ligo_member;
        if (!isLigoLocked && (app.role_slug === 'supervisor' || app.role_slug === 'li_coordinator')) {
            subSelect.disabled = true;
            subSelect.style.opacity = '0.6';
            subSelect.style.cursor = 'not-allowed';
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
        _updateServicesState(); // NEW: initialize state after render
        _applyServiceFilters();
        _syncSelectAll();
    } catch (err) {
        list.innerHTML = `<p class="rm-error-inline">Could not load services: ${__esc(err.message)}</p>`;
    }
}

