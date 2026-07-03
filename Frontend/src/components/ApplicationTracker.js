import { __esc, _formatDate } from '../utils/helpers.js';

/**
 * Builds a visual timeline tracker for an application.
 * @param {Object} appObj - The application object.
 * @param {Array} steps - The workflow steps history.
 * @param {Object} options - Additional data (sshKey, userData, etc).
 * @returns {string} - HTML string for the tracker.
 */
export function renderApplicationTracker(appObj, steps = [], options = {}) {
    const { sshKey, userData, isAdminView = false } = options;
    const isCompleted = ['approved', 'completed', 'approved_by_li_coordinator', 'active'].includes(appObj.status);
    const isRejected = ['rejected', 'declined', 'final_rejected', 'final_rejection'].includes(appObj.status);
    const isStandardCorrection = appObj.status === 'correction_required';
    const isIdCorrection = appObj.status === 'id_proof_pending';
    const isCorrection = isStandardCorrection || isIdCorrection;
    const isUnderReview = appObj.status === 'under_review';

    const detailedItems = [
        { label: 'Application Submitted', state: 'completed', description: 'Application submitted successfully.', date: appObj.submitted_at },
        ...steps.map(s => {
            const isStepRejected = ['rejected', 'declined', 'final_rejected', 'final_rejection'].includes(s.status);
            const isStepApproved = s.status === 'approved' || s.approved_at || (isAdminView && s.status === 'active') || s.status === 'completed';

            let label = s.status_name;
            let description = '';

            if (isStepApproved) {
                if (isAdminView) {
                    label = s.status === 'active' || s.status === 'completed' ? `Approved by ${s.role_name}` : s.status_name;
                }
                description = `Approved by ${s.role_name} (${__esc(s.approved_by_name || 'System')}) on ${_formatDate(s.approved_at)}`;
            } else if (isStepRejected) {
                if (isAdminView) label = `Declined by ${s.role_name}`;
                description = `Declined by ${s.role_name} (${__esc(s.approved_by_name || 'System')}) on ${_formatDate(s.approved_at)}`;
            } else if (s.status === 'correction' || (appObj.status === 'id_proof_pending' && appObj.paused_workflow_step === s.workflow_step_id)) {
                description = `Correction requested by ${s.approved_by_name || appObj.correction_requested_by_name || 'Reviewer'}. Please check the remarks below.`;
            } else if (appObj.current_step_id === s.workflow_step_id && appObj.status !== 'rejected') {
                description = isAdminView ? 'Action required' : 'Pending review';
            }

            let state = 'pending';
            if (isStepRejected) {
                state = 'rejected';
            } else if (isStepApproved) {
                state = 'completed';
            } else if (s.status === 'correction' || (appObj.status === 'id_proof_pending' && appObj.paused_workflow_step === s.workflow_step_id)) {
                state = 'correction';
            } else if (appObj.current_step_id === s.workflow_step_id) {
                state = isRejected ? 'rejected' : 'active';
            }

            return {
                label,
                state,
                description,
                services: s.recommended_services,
                remarks: s.comments,
                approver_email: s.approver_email,
                ligo_member: appObj.ligo_member,
                assigned_system: appObj.assigned_system_name,
                assigned_subsystem: appObj.assigned_subsystem_name
            };
        })
    ];

    // Post-approval steps
    const isPostApproval = isCompleted || appObj.status === 'approved_by_li_coordinator';
    const hasComputing = appObj.computing_services === true || appObj.computing_services === 1 || appObj.computing_services === "1";
    
    if (isPostApproval) {
        if (hasComputing || sshKey) {
            detailedItems.push({
                label: sshKey ? (isAdminView ? 'SSH Key Registered' : 'SSH Key Uploaded') : (isAdminView ? 'SSH Key Required' : 'Upload SSH Key'),
                state: sshKey ? 'completed' : 'active',
                description: sshKey ? 'Public key successfully registered in system.' : 'Please upload your public key to proceed.' + (!isAdminView && !sshKey ? '<br><button class="btn-primary" style="margin-top: 0.75rem; padding: 6px 14px; font-size: 0.75rem; border-radius: 6px; width: auto;" onclick="document.getElementById(\\\'db-nav-ssh\\\')?.click()">Go to SSH Upload</button>' : '')
            });
        }
        
        detailedItems.push({
            label: 'Account Provisioned',
            state: (hasComputing && !sshKey) ? 'pending' : 'completed',
            description: (hasComputing && !sshKey) ? 'Awaiting SSH key upload before provisioning.' : 'System resources successfully provisioned.'
        });
        
        detailedItems.push({
            label: 'Account Created',
            state: (hasComputing && !sshKey) ? 'pending' : 'completed',
            description: (hasComputing && !sshKey) ? 'Account activation pending final setup.' : 'Account is fully active and ready to use.'
        });
    }

    const isFullyActive = isCompleted && userData?.status === 'active';
    const activeStepLabel = detailedItems.find(it => it.state === 'active')?.label || 'In Progress';

    return `
        <div class="db-tracker-card adm-track-wrap" style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 1.5rem; max-width: 800px; margin-left: auto; margin-right: auto;">
            <div class="trk-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2.5rem;padding-bottom:1.5rem;border-bottom:1px solid #f1f5f9;">
                <div style="display:flex;align-items:center;gap:1rem;">
                    <div style="background:#f8fafc;width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#6366f1;"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Application_Tracker.svg); mask-image: url(/assets/icons/Application_Tracker.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 24px; height: 24px; display: inline-block;"></span></div>
                    <div>
                        <h3 style="margin:0;font-size:1.4rem;font-weight:800;color:#0f172a;">${isAdminView ? __esc(appObj.applicant_name || 'Applicant') : (__esc(appObj.request_name || 'Application') + ' Tracker')}</h3>
                        <p style="margin:0.2rem 0 0;color:#64748b;font-size:0.85rem;">
                            ${isAdminView ? 'Tracking ID: ' + __esc(appObj.application_id || String(appObj.id)) : 'Submitted on ' + _formatDate(appObj.submitted_at)}
                        </p>
                    </div>
                </div>
                <div class="trk-overall-badge ${isFullyActive ? 'trk-badge-done' : isRejected ? 'trk-badge-error' : isCorrection ? 'trk-badge-warning' : isUnderReview ? 'trk-badge-review' : 'trk-badge-active'}" style="padding:0.6rem 1.5rem;border-radius:99px;font-weight:800;font-size:0.8rem;letter-spacing:0.02em;box-shadow:0 2px 10px rgba(0,0,0,0.03);display:flex;align-items:center;gap:0.5rem; ${isCorrection ? 'background: #fffbeb; color: #d97706; border: 1px solid #fde68a;' : isUnderReview ? 'background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;' : ''}">
                    ${isFullyActive ? '<span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/check-circle.svg); mask-image: url(/assets/icons/check-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Account Activated' : isRejected ? '<span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/x-circle.svg); mask-image: url(/assets/icons/x-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Declined' : isCorrection ? '<span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/alert-circle.svg); mask-image: url(/assets/icons/alert-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Correction Needed' : isUnderReview ? '<span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/clock.svg); mask-image: url(/assets/icons/clock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Under Review' : `<span class="extracted-svg" style="width:14px;height:14px; display: inline-block; -webkit-mask-image: url(/assets/icons/clock.svg); mask-image: url(/assets/icons/clock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> ${activeStepLabel}`}
                </div>
            </div>
            ${(isRejected && !isAdminView ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1.25rem; flex-direction: column;">
                    <div style="display: flex; align-items: flex-start; gap: 1rem; width: 100%;">
                        <div style="background: #ef4444; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);">
                            <span class="extracted-svg" style="width: 20px; height: 20px; display: inline-block; -webkit-mask-image: url(/assets/icons/x.svg); mask-image: url(/assets/icons/x.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        </div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 800; color: #991b1b; font-size: 1rem; margin-bottom: 0.3rem;">Application Declined</div>
                            <div style="color: #b91c1c; font-size: 0.85rem; line-height: 1.5; font-weight: 500; margin-bottom: 0;">
                                Reason: ${__esc(appObj.rejection_reason || appObj.declined_reason || 'No specific reason provided.')}
                            </div>
                        </div>
                    </div>
                </div>
            ` : '')}
            <div class="trk-timeline-container" style="position:relative;padding-left:10px;">
                <div class="trk-timeline-line"></div>
                <div class="trk-timeline-steps">${detailedItems.map((it, i) => buildTimelineStep(it, i, isAdminView)).join('')}</div>
            </div>
        </div>`;
}

function buildTimelineStep(it, i, isAdminView) {
    const isActive = it.state === 'active';
    const isCompleted = it.state === 'completed';
    const isRejected = it.state === 'rejected';
    const isCorrection = it.state === 'correction';

    const isSubmission = it.label === 'Application Submitted';
    const badgeText = isSubmission ? 'Submitted' : 'Approved';
    const badgeIcon = 'check-circle';

    return `<div class="trk-step trk-step--${it.state} ${isActive || isRejected || isCorrection ? 'open' : ''}" style="animation-delay:${i * 0.1}s">
        <div class="trk-marker">
            ${isCompleted ? '<span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/check.svg); mask-image: url(/assets/icons/check.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>' : ''}
            ${isRejected ? '<span class="extracted-svg" style="color:white; width: 14px; height: 14px; display: inline-block; -webkit-mask-image: url(/assets/icons/x.svg); mask-image: url(/assets/icons/x.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>' : ''}
            ${isCorrection ? '<span class="extracted-svg" style="color:white; width: 14px; height: 14px; display: inline-block; -webkit-mask-image: url(/assets/icons/alert-circle.svg); mask-image: url(/assets/icons/alert-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>' : ''}
            ${isActive ? `<div class="trk-marker-active"><div class="trk-marker-pulse"></div></div>` : ''}
        </div>
        <div class="trk-content-card">
            <button class="trk-step-header-btn" onclick="this.closest('.trk-step').classList.toggle('open')">
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <h4 class="trk-step-header-title">${__esc(it.label)}</h4>
                    ${isActive ? `<span class="trk-badge-active-mini"><span class="extracted-svg" style="width:10px;height:10px;margin-right:4px; display: inline-block; -webkit-mask-image: url(/assets/icons/clock.svg); mask-image: url(/assets/icons/clock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>In Progress</span>` : ''}
                    ${isRejected && !isAdminView ? `<span class="trk-badge-error-mini" style="background:#fee2e2; color:#ef4444; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:800; display:flex; align-items:center;"><span class="extracted-svg" style="width:10px;height:10px;margin-right:4px; display: inline-block; -webkit-mask-image: url(/assets/icons/x-circle.svg); mask-image: url(/assets/icons/x-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>Declined</span>` : ''}
                    ${isCorrection && !isAdminView ? `<span class="trk-badge-warning-mini" style="background:#fffbeb; color:#d97706; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:800; display:flex; align-items:center; border:1px solid #fde68a;"><span class="extracted-svg" style="width:10px;height:10px;margin-right:4px; display: inline-block; -webkit-mask-image: url(/assets/icons/refresh-cw.svg); mask-image: url(/assets/icons/refresh-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>Resubmit with Correction</span>` : ''}
                    ${isCompleted && !isAdminView ? `<span class="trk-badge-success-mini" style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:99px; font-size:0.65rem; font-weight:800; display:flex; align-items:center;"><span class="extracted-svg" style="width:10px;height:10px;margin-right:4px; display: inline-block; -webkit-mask-image: url(/assets/icons/${badgeIcon}.svg); mask-image: url(/assets/icons/${badgeIcon}.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>${badgeText}</span>` : ''}
                </div>
                <span class="extracted-svg trk-step-chevron" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
            </button>
            <div class="trk-step-body">
                <div style="font-size:0.9rem;color:#475569;margin-bottom:1rem;">${__esc(it.description || '')}</div>
                ${it.services && !isAdminView ? `
                    <div style="margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 0.75rem; border: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                            <div>
                                <div style="font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.05em;">Recommended Services</div>
                                <div style="font-size: 0.85rem; color: #1e293b; font-weight: 700;">${__esc(it.services)}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.05em;">LIGO Status</div>
                                <span style="background: ${it.ligo_member === 'yes' ? '#f0f9ff' : '#f8fafc'}; color: ${it.ligo_member === 'yes' ? '#0369a1' : '#475569'}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; border: 1px solid ${it.ligo_member === 'yes' ? '#bae6fd' : '#e2e8f0'};">
                                    ${it.ligo_member === 'yes' ? 'MEMBER' : 'NON-MEMBER'}
                                </span>
                            </div>
                        </div>
                        ${(it.assigned_system || it.assigned_subsystem) ? `
                            <div style="padding-top: 0.75rem; border-top: 1px dashed #e2e8f0; display: flex; gap: 1.5rem;">
                                ${it.assigned_system ? `
                                    <div>
                                        <div style="font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">System</div>
                                        <div style="font-size: 0.75rem; color: #475569; font-weight: 600;">${__esc(it.assigned_system)}</div>
                                    </div>
                                ` : ''}
                                ${it.assigned_subsystem ? `
                                    <div>
                                        <div style="font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Subsystem</div>
                                        <div style="font-size: 0.75rem; color: #475569; font-weight: 600;">${__esc(it.assigned_subsystem)}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                ${it.services && isAdminView ? `<div style="margin-bottom:1rem;padding:0.75rem;background:#f0f4ff;border-radius:8px;border-left:4px solid #6366f1;"><strong style="font-size:0.7rem;color:#6366f1;text-transform:uppercase;">Services:</strong><div style="font-weight:700;">${__esc(it.services)}</div></div>` : ''}
                ${it.remarks ? `<div style="padding:0.75rem;background:${isRejected ? '#fff1f2' : '#f8fafc'};border-radius:8px;font-style:italic;color:${isRejected ? '#991b1b' : '#64748b'};font-size:0.85rem; border-left: ${isRejected ? '3px solid #ef4444' : 'none'};">"${__esc(it.remarks)}"</div>` : ''}
            </div>
        </div>
    </div>`;
}
