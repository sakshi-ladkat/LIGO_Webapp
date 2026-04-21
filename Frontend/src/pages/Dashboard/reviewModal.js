import { authFetch } from '../../utils/auth.js';
import { API } from '../../config/api.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _modal    = null;
let _onSuccess = null;

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Open the review modal for a given application.
 * @param {object} app     - Application data object from /api/review/applications
 * @param {Function} onSuccess - Called after a successful approve/reject to refresh the table
 */
export function openReviewModal(app, onSuccess) {
    _onSuccess = onSuccess;
    _ensureModal();
    _populate(app);
    _modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// ── Build modal once and cache it ─────────────────────────────────────────────
function _ensureModal() {
    if (_modal) return;
    _modal = document.createElement('div');
    _modal.className = 'rv-modal-overlay';
    _modal.innerHTML = `
        <div class="rv-modal" role="dialog" aria-modal="true" aria-labelledby="rv-modal-title">
            <div class="rv-modal-header">
                <h2 id="rv-modal-title" class="rv-modal-title">Review Application</h2>
                <button class="rv-modal-close" id="rv-close-btn" aria-label="Close">&times;</button>
            </div>

            <div class="rv-modal-body">
                <!-- Info grid -->
                <div class="rv-info-grid" id="rv-info-grid"></div>

                <!-- Remarks -->
                <div class="rv-field-group">
                    <label class="rv-label" for="rv-remarks">Remarks <span style="color:var(--gray-400);font-weight:400;">(optional)</span></label>
                    <textarea id="rv-remarks" class="rv-textarea" rows="3" placeholder="Add a note for the applicant or audit log…"></textarea>
                </div>

                <!-- Feedback message -->
                <div id="rv-feedback" class="rv-feedback" style="display:none;"></div>
            </div>

            <div class="rv-modal-footer">
                <button id="rv-reject-btn" class="btn rv-btn-reject">Reject</button>
                <button id="rv-approve-btn" class="btn rv-btn-approve">Approve</button>
            </div>
        </div>`;

    document.body.appendChild(_modal);

    // Close handlers
    _modal.querySelector('#rv-close-btn').addEventListener('click', _close);
    _modal.addEventListener('click', (e) => { if (e.target === _modal) _close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _close(); });
}

// ── Populate modal content with application data ──────────────────────────────
function _populate(app) {
    const grid = _modal.querySelector('#rv-info-grid');

    const fields = [
        ['Applicant',        app.applicant_name || app.applicant_email || '—'],
        ['Email',            app.applicant_email || '—'],
        ['Request',          app.request_name   || '—'],
        ['Workflow',         app.workflow_name  || '—'],
        ['Current Status',   app.current_status || '—'],
        ['Required Action',  app.step_action    || '—'],
        ['Submitted',        app.submitted_at   ? new Date(app.submitted_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'],
    ];

    grid.innerHTML = fields.map(([label, value]) => `
        <div class="rv-info-item">
            <span class="rv-info-label">${label}</span>
            <span class="rv-info-value">${escHtml(value)}</span>
        </div>`).join('');

    // Clear previous state
    _modal.querySelector('#rv-remarks').value = '';
    _hideFeedback();

    // Bind action buttons (remove old listeners by cloning)
    const approveBtn = _modal.querySelector('#rv-approve-btn');
    const rejectBtn  = _modal.querySelector('#rv-reject-btn');
    const newApprove = approveBtn.cloneNode(true);
    const newReject  = rejectBtn.cloneNode(true);
    approveBtn.replaceWith(newApprove);
    rejectBtn.replaceWith(newReject);

    newApprove.addEventListener('click', () => _submitDecision(app.id, 'approve', newApprove, newReject));
    newReject.addEventListener('click',  () => _submitDecision(app.id, 'reject',  newReject,  newApprove));
}

// ── Submit approve / reject ───────────────────────────────────────────────────
async function _submitDecision(appId, action, activeBtn, otherBtn) {
    const remarks = _modal.querySelector('#rv-remarks').value.trim();
    _hideFeedback();

    activeBtn.disabled = true;
    activeBtn.textContent = action === 'approve' ? 'Approving…' : 'Rejecting…';
    otherBtn.disabled = true;

    try {
        const res = await authFetch(API.DECIDE(appId), {
            method: 'POST',
            body: JSON.stringify({ action, remarks: remarks || undefined }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }

        _showFeedback(data.message || 'Done!', 'success');

        // Close modal after short delay and refresh table
        setTimeout(() => {
            _close();
            if (_onSuccess) _onSuccess();
        }, 1200);

    } catch (err) {
        _showFeedback(err.message || 'Something went wrong.', 'error');
        activeBtn.disabled = false;
        activeBtn.textContent = action === 'approve' ? 'Approve' : 'Reject';
        otherBtn.disabled = false;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _close() {
    if (!_modal) return;
    _modal.classList.remove('open');
    document.body.style.overflow = '';
}

function _showFeedback(msg, type) {
    const el = _modal.querySelector('#rv-feedback');
    el.textContent = msg;
    el.className = `rv-feedback rv-feedback--${type}`;
    el.style.display = 'block';
}

function _hideFeedback() {
    const el = _modal?.querySelector('#rv-feedback');
    if (el) el.style.display = 'none';
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
