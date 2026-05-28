import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
export function buildSshSetupHtml() {
    return `
        <div class="db-tracker-card" style="padding:2rem;">
            <div style="margin-bottom:2rem;display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <h3 style="margin:0;font-size:1.25rem;font-weight:800;color:#0f172a;"><span class="extracted-svg" style="vertical-align:middle;margin-right:0.5rem;width:20px; display: inline-block; height: 18px; -webkit-mask-image: url(/assets/icons/key.svg); mask-image: url(/assets/icons/key.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> SSH Key Registration</h3>
                    <p style="margin:0.5rem 0 0;color:#64748b;font-size:0.9rem;">Register your public key to enable secure computing access.</p>
                </div>
                <button id="ssh-help-toggle" style="background:#f1f5f9;border:none;color:#475569;padding:0.5rem 1rem;border-radius:0.5rem;font-size:0.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:0.4rem;">
                    <span class="extracted-svg" style="width:14px; display: inline-block; height: 18px; -webkit-mask-image: url(/assets/icons/help-circle.svg); mask-image: url(/assets/icons/help-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> How to generate?
                </button>
            </div>

            <div id="ssh-instructions" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.75rem;padding:1.5rem;margin-bottom:2rem;font-size:0.85rem;color:#334155;">
                <h4 style="margin:0 0 1rem;font-weight:800;color:#0f172a;">Generating your SSH Key</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
                    <div>
                        <strong style="display:block;margin-bottom:0.5rem;color:#6366f1;">Linux / macOS</strong>
                        <p style="margin-bottom:0.5rem;">Open Terminal and run:</p>
                        <code style="display:block;background:#e2e8f0;padding:0.75rem;border-radius:0.5rem;font-family:monospace;margin-bottom:1rem;position:relative;">
                            ssh-keygen -t ed25519
                        </code>
                        <p>Press Enter for all defaults. Your <strong>public key</strong> will be at <code>~/.ssh/id_ed25519.pub</code></p>
                    </div>
                    <div>
                        <strong style="display:block;margin-bottom:0.5rem;color:#6366f1;">Windows (PowerShell)</strong>
                        <p style="margin-bottom:0.5rem;">Open PowerShell and run:</p>
                        <code style="display:block;background:#e2e8f0;padding:0.75rem;border-radius:0.5rem;font-family:monospace;margin-bottom:1rem;">
                            ssh-keygen.exe
                        </code>
                        <p>Your <strong>public key</strong> will be at <code>C:\\Users\\YourName\\.ssh\\id_rsa.pub</code></p>
                    </div>
                </div>
                <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid #e2e8f0;text-align:right;">
                    <button id="ssh-help-close" style="background:none;border:none;color:#6366f1;font-weight:700;cursor:pointer;">Got it, thanks!</button>
                </div>
            </div>

            <div style="background:#f8fafc;border:2px dashed #e2e8f0;border-radius:1rem;padding:2.5rem;text-align:center;" id="ssh-drop-zone">
                <div id="ssh-upload-idle">
                    <div style="color:#94a3b8;margin-bottom:1rem;"><span class="extracted-svg" style="width:40px;height:40px; display: inline-block; -webkit-mask-image: url(/assets/icons/upload-cloud.svg); mask-image: url(/assets/icons/upload-cloud.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></div>
                    <h4 style="margin:0 0 0.5rem;font-weight:700;color:#1e293b;">Upload Public Key</h4>
                    <p style="color:#64748b;font-size:0.85rem;margin-bottom:1.5rem;">id_rsa.pub or similar public key file</p>
                    <button class="sb-btn-save" style="background:#6366f1;color:white;padding:0.6rem 1.5rem;border-radius:0.5rem;font-weight:700;border:none;cursor:pointer;" onclick="document.getElementById('ssh-file-input').click()">Browse Files</button>
                    <input type="file" id="ssh-file-input" style="display:none" accept=".pub,text/plain">
                </div>
                <div id="ssh-upload-selected" style="display:none">
                    <div style="background:white;padding:1rem;border-radius:0.75rem;display:flex;align-items:center;gap:1rem;border:1px solid #e2e8f0;margin-bottom:1.5rem;text-align:left;">
                        <div style="color:#6366f1;"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></div>
                        <div style="flex:1;"><div id="ssh-filename" style="font-weight:700;color:#1e293b;font-size:0.9rem;">filename.pub</div><div id="ssh-filesize" style="font-size:0.75rem;color:#94a3b8;">—</div></div>
                        <button style="background:none;border:none;color:#ef4444;cursor:pointer;" id="ssh-remove-file"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/x.svg); mask-image: url(/assets/icons/x.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></button>
                    </div>
                    <button class="sb-btn-save" id="ssh-submit-btn" style="background:#10b981;color:white;width:100%;padding:0.75rem;border-radius:0.5rem;font-weight:800;border:none;cursor:pointer;">Register Key</button>
                </div>
            </div>

            <div style="margin-top:2rem;padding:1.25rem;background:#fefce8;border:1px solid #fef08a;border-radius:0.75rem;display:flex;gap:0.75rem;">
                <div style="color:#ca8a04;"><span class="extracted-svg" style="width:18px; display: inline-block; height: 18px; -webkit-mask-image: url(/assets/icons/info.svg); mask-image: url(/assets/icons/info.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></div>
                <div style="font-size:0.85rem;color:#854d0e;line-height:1.5;">
                    <strong>Important:</strong> Only upload your <strong>Public Key</strong>. Never share your private key. This key is required for automated provisioning.
                </div>
            </div>
            <div id="ssh-feedback" style="margin-top:1.5rem;padding:1rem;border-radius:0.5rem;display:none;font-size:0.9rem;font-weight:600;"></div>
        </div>`;
}

export function _wireSshUpload(container, onSuccessRedirect) {
    const helpToggle = container.querySelector('#ssh-help-toggle');
    const helpClose = container.querySelector('#ssh-help-close');
    const helpPanel = container.querySelector('#ssh-instructions');

    if (helpToggle) helpToggle.onclick = () => { helpPanel.style.display = 'block'; helpToggle.style.display = 'none'; };
    if (helpClose) helpClose.onclick = () => { helpPanel.style.display = 'none'; helpToggle.style.display = 'flex'; };

    const fileInput = container.querySelector('#ssh-file-input');
    const dropZone = container.querySelector('#ssh-drop-zone');
    const idleView = container.querySelector('#ssh-upload-idle');
    const selectedView = container.querySelector('#ssh-upload-selected');
    const filenameEl = container.querySelector('#ssh-filename');
    const filesizeEl = container.querySelector('#ssh-filesize');
    const removeBtn = container.querySelector('#ssh-remove-file');
    const submitBtn = container.querySelector('#ssh-submit-btn');
    const feedback = container.querySelector('#ssh-feedback');

    let selectedFile = null;

    const handleFile = (file) => {
        if (!file) return;
        selectedFile = file;
        filenameEl.textContent = file.name;
        filesizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
        if (idleView) idleView.style.display = 'none';
        if (selectedView) selectedView.style.display = 'block';
        if (dropZone) { dropZone.style.background = '#f0f9ff'; dropZone.style.borderColor = '#6366f1'; }
    };

    if (fileInput) fileInput.onchange = (e) => handleFile(e.target.files[0]);
    if (removeBtn) removeBtn.onclick = () => {
        selectedFile = null;
        if (idleView) idleView.style.display = 'block';
        if (selectedView) selectedView.style.display = 'none';
        if (dropZone) { dropZone.style.background = '#f8fafc'; dropZone.style.borderColor = '#e2e8f0'; }
        if (fileInput) fileInput.value = '';
    };

    if (submitBtn) submitBtn.onclick = async () => {
        if (!selectedFile) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering…';
        if (feedback) feedback.style.display = 'none';

        const formData = new FormData();
        formData.append('ssh_key', selectedFile);

        try {
            const res = await authFetch(API.SSH_KEY_STORE, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || (data.errors ? Object.values(data.errors).flat().join(' ') : 'Failed to upload key.'));

            if (feedback) {
                feedback.style.display = 'block';
                feedback.style.background = '#f0fdf4';
                feedback.style.color = '#15803d';
                feedback.style.border = '1px solid #bbf7d0';
                feedback.textContent = '✓ SSH Key successfully registered. System provisioning will begin shortly.';
            }

            if (selectedView) selectedView.style.display = 'none';
            if (idleView) {
                idleView.style.display = 'block';
                idleView.innerHTML = `<div style="color:#10b981;margin-bottom:1.5rem;"><span class="extracted-svg" style="width:48px;height:48px; display: inline-block; -webkit-mask-image: url(/assets/icons/check-circle.svg); mask-image: url(/assets/icons/check-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></div><h4 style="color:#065f46;">Key Registered</h4><p style="color:#065f46;font-size:0.85rem;">You have already uploaded your public key.</p>`;
            }
            feather.replace();

            // Refresh user data to update sidebar (hide SSH Setup)
            authFetch(API.ME).then(r => r.json()).then(data => {
                if (data.user) {
                    state.meData = data;
                    _me = data.user;
                    // If option is now disabled, redirect back to dashboard after a short delay
                    if (!data.can_setup_ssh && onSuccessRedirect) {
                        setTimeout(() => onSuccessRedirect(), 2000);
                    }
                }
            }).catch(() => { });
        } catch (err) {
            if (feedback) {
                feedback.style.display = 'block';
                feedback.style.background = '#fef2f2';
                feedback.style.color = '#b91c1c';
                feedback.style.border = '1px solid #fecaca';
                feedback.textContent = err.message;
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register Public Key';
        }
    };

    feather.replace();
}

export function buildUploadIdHtml(app) {
    return `
    <div class="db-tracker-card" style="padding: 2.5rem; max-width: 800px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #f1f5f9;">
            <div style="background: #fff7ed; width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
                <span class="extracted-svg" style="width: 32px; height: 32px; display: inline-block; -webkit-mask-image: url(/assets/icons/upload-cloud.svg); mask-image: url(/assets/icons/upload-cloud.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
            </div>
            <div>
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #0f172a;">Upload Valid ID Card</h3>
                <p style="margin: 0.25rem 0 0; color: #64748b; font-size: 0.9rem;">Your application requires a valid institutional identity card to continue.</p>
            </div>
        </div>

        <!-- Reviewer Remark Section -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 1.5rem; border-radius: 1rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <label style="font-size: 0.7rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="extracted-svg" style="width: 14px; height: 14px; display: inline-block; -webkit-mask-image: url(/assets/icons/message-square.svg); mask-image: url(/assets/icons/message-square.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Reviewer Remarks
                </label>
                <div style="background: #fef2f2; color: #991b1b; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.65rem; font-weight: 800; border: 1px solid #fecaca; display: flex; align-items: center; gap: 0.4rem;">
                    <span class="extracted-svg" style="width: 12px; height: 12px; display: inline-block; -webkit-mask-image: url(/assets/icons/clock.svg); mask-image: url(/assets/icons/clock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> 72H DEADLINE
                </div>
            </div>
            <div style="color: #451a03; font-size: 1rem; line-height: 1.6; font-weight: 500; font-style: italic; margin-bottom: 0.75rem;">
                "${__esc(app.id_card_reupload_remarks || 'Please upload a valid institutional ID card for verification.')}"
            </div>
            <p style="margin: 0; font-size: 0.75rem; color: #92400e; opacity: 0.8; font-weight: 600;">
                <span class="extracted-svg" style="width: 12px; height: 12px; vertical-align: middle; display: inline-block; -webkit-mask-image: url(/assets/icons/alert-circle.svg); mask-image: url(/assets/icons/alert-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> 
                Failure to provide a valid ID card within 72 hours of the request will result in automatic application rejection.
            </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
            <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.75rem; text-transform: uppercase;">Current Identity Card</label>
                <div id="current-id-preview-container" style="border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; background: #f8fafc; height: 200px; display: flex; align-items: center; justify-content: center; position: relative;">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                </div>
                <div style="margin-top: 0.5rem; text-align: center;">
                    <button type="button" id="btn-view-full-id" style="background: none; border: none; color: #6366f1; font-size: 0.75rem; font-weight: 700; cursor: pointer; text-decoration: underline; display: none;">View Full Resolution</button>
                </div>
            </div>

            <!-- New ID Upload -->
            <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.75rem; text-transform: uppercase;">Upload New Valid ID Card</label>
                <div id="id-dropzone" style="border: 2px dashed #cbd5e1; border-radius: 0.75rem; padding: 2rem; text-align: center; height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; transition: all 0.2s; overflow: hidden;">
                    <span class="extracted-svg" style="width: 40px; height: 40px; color: #94a3b8; margin-bottom: 1rem; display: inline-block; -webkit-mask-image: url(/assets/icons/image.svg); mask-image: url(/assets/icons/image.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    <p style="margin: 0; font-size: 0.85rem; color: #64748b; font-weight: 500;">Click to select or drag & drop</p>
                    <p style="margin: 0.25rem 0 0; font-size: 0.7rem; color: #94a3b8;">PDF, JPG, JPEG, or PNG (Max 5MB)</p>
                    <input type="file" id="new-id-input" accept="image/*,application/pdf" style="display: none;">
                </div>
                <div id="file-name-preview" style="margin-top: 0.75rem; font-size: 0.8rem; color: #6366f1; font-weight: 700; text-align: center;"></div>
            </div>
        </div>

        <div id="upload-feedback" style="display: none; padding: 1rem; border-radius: 0.75rem; margin-bottom: 2rem; font-size: 0.9rem; font-weight: 600;"></div>

        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
            <button class="sb-btn-save sb-btn-cancel-edit" style="background: #e2e8f0; border: none; color: #475569; padding: 0.75rem 2.5rem; border-radius: 0.75rem; font-weight: 700; cursor: pointer; min-width: 160px;" onclick="window.location.hash = '#/dashboard'">Cancel</button>
            <button id="btn-submit-reupload" class="btn-primary" style="background: #6366f1; border: none; color: white; padding: 0.75rem 2.5rem; border-radius: 0.75rem; font-weight: 700; box-shadow: 0 4px 12px rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; gap: 0.75rem; cursor: pointer; min-width: 160px;">
                <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/send.svg); mask-image: url(/assets/icons/send.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Submit
            </button>
        </div>
    </div>
    
    <!-- Cropper Modal -->
    <div id="cropper-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:2rem; border-radius:1rem; max-width:90%; width:600px; position:relative;">
            <h3 style="margin-top:0; margin-bottom:1.5rem; font-weight:800; color:#0f172a;">Adjust Your ID Card</h3>
            <div style="max-height:400px; overflow:hidden; background:#f1f5f9; border-radius:0.5rem; margin-bottom:1.5rem;">
                <img id="cropper-image" style="max-width:100%; display:block;">
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:1.5rem;">
                <button id="rotate-left-btn" class="sb-btn-edit" title="Rotate Left"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/rotate-ccw.svg); mask-image: url(/assets/icons/rotate-ccw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></button>
                <button id="rotate-right-btn" class="sb-btn-edit" title="Rotate Right"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/rotate-cw.svg); mask-image: url(/assets/icons/rotate-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></button>
                <div style="width:1px; height:24px; background:#e2e8f0; margin:0 0.5rem;"></div>
                <button id="zoom-in-btn" class="sb-btn-edit" title="Zoom In"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/zoom-in.svg); mask-image: url(/assets/icons/zoom-in.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></button>
                <button id="zoom-out-btn" class="sb-btn-edit" title="Zoom Out"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/zoom-out.svg); mask-image: url(/assets/icons/zoom-out.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></button>
            </div>
            <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                <button id="cancel-crop-btn" style="background:#e2e8f0; border:none; color:#475569; padding:0.6rem 1.25rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Cancel</button>
                <button id="crop-btn" style="background:#6366f1; border:none; color:white; padding:0.6rem 2rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Apply Crop & Save</button>
            </div>
        </div>
    </div>`;
}

export function _wireUploadId(container, app, onSuccess) {
    const dropzone = container.querySelector('#id-dropzone');
    const input = container.querySelector('#new-id-input');
    const preview = container.querySelector('#file-name-preview');
    const submitBtn = container.querySelector('#btn-submit-reupload');
    const feedback = container.querySelector('#upload-feedback');
    const currentIdBox = container.querySelector('#current-id-preview-container');
    const fullViewBtn = container.querySelector('#btn-view-full-id');

    // Load current ID securely
    (async () => {
        try {
            const targetUid = _me.user_id || app.user_id;
            if (!targetUid) throw new Error('User ID missing');

            const res = await authFetch(API.SECURE_FILE(targetUid));
            if (!res.ok) throw new Error('Not found');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const hasPdfPath = app.id_card_path && String(app.id_card_path).toLowerCase().endsWith('.pdf');
            const isPdfBlob = blob.type === 'application/pdf';

            if (hasPdfPath || isPdfBlob) {
                currentIdBox.innerHTML = `<div style="text-align:center;"><span class="extracted-svg" style="width:48px;height:48px;color:#94a3b8;margin-bottom:0.5rem; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span><div style="font-size:0.75rem;color:#64748b;">PDF Document</div></div>`;
            } else {
                currentIdBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit: cover;">`;
            }

            fullViewBtn.style.display = 'inline-block';
            fullViewBtn.onclick = () => window.open(url, '_blank');
            feather.replace();
        } catch (e) {
            console.error('[Dashboard] ID fetch error:', e);
            currentIdBox.innerHTML = `<div style="padding:1rem; text-align:center; color:#94a3b8; font-size:0.8rem;">Preview not available</div>`;
        }
    })();

    dropzone.onclick = () => input.click();

    let cropper = null;
    const cropperModal = container.querySelector('#cropper-modal');
    const cropperImg = container.querySelector('#cropper-image');
    const cropBtn = container.querySelector('#crop-btn');
    const cancelCropBtn = container.querySelector('#cancel-crop-btn');

    const rotateLeftBtn = container.querySelector('#rotate-left-btn');
    const rotateRightBtn = container.querySelector('#rotate-right-btn');
    const zoomInBtn = container.querySelector('#zoom-in-btn');
    const zoomOutBtn = container.querySelector('#zoom-out-btn');

    let finalFile = null;

    input.onchange = () => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    cropperImg.src = e.target.result;
                    cropperModal.style.display = 'flex';
                    if (cropper) cropper.destroy();
                    cropper = new Cropper(cropperImg, {
                        aspectRatio: NaN,
                        viewMode: 1,
                        background: false
                    });
                    feather.replace();
                };
                reader.readAsDataURL(file);
            } else {
                // PDF or other
                finalFile = file;
                preview.textContent = `Selected: ${file.name}`;
                dropzone.innerHTML = `<span class="extracted-svg" style="width:40px;height:40px;color:#6366f1;margin-bottom:1rem; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span><p style="margin:0;font-size:0.85rem;color:#0f172a;font-weight:700;">${file.name}</p>`;
                feather.replace();
            }
        }
    };

    cropBtn.onclick = () => {
        const canvas = cropper.getCroppedCanvas({ maxWidth: 2000, maxHeight: 2000 });
        canvas.toBlob((blob) => {
            finalFile = new File([blob], input.files[0].name, { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            dropzone.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit: contain; border-radius:0.5rem;">`;
            preview.textContent = `Selected & Cropped: ${finalFile.name}`;
            cropperModal.style.display = 'none';
            cropper.destroy();
            cropper = null;
        }, 'image/jpeg', 0.9);
    };

    cancelCropBtn.onclick = () => {
        cropperModal.style.display = 'none';
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        if (!finalFile) input.value = '';
    };

    rotateLeftBtn.onclick = () => cropper && cropper.rotate(-90);
    rotateRightBtn.onclick = () => cropper && cropper.rotate(90);
    zoomInBtn.onclick = () => cropper && cropper.zoom(0.1);
    zoomOutBtn.onclick = () => cropper && cropper.zoom(-0.1);

    submitBtn.onclick = async () => {
        if (!input.files || input.files.length === 0) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.textContent = 'Please select a valid identity card file first.';
            return;
        }

        const formData = new FormData();
        formData.append('id_card', finalFile || input.files[0]);
        formData.append('application_id', app.id);

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-border spinner-border-sm" style="width: 1.2rem; height: 1.2rem; border-width: 0.15em;"></div> Processing...';

            const res = await authFetch(`/api/auth/applications/${app.id}/reupload-id-card`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to re-upload ID card.');

            feedback.style.display = 'block';
            feedback.style.background = '#f0fdf4';
            feedback.style.color = '#15803d';
            feedback.style.border = '1px solid #bbf7d0';
            feedback.textContent = '✓ Identity Proof successfully re-uploaded. Application resumed at previous review stage.';

            setTimeout(() => {
                onSuccess();
            }, 2500);

        } catch (err) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/send.svg); mask-image: url(/assets/icons/send.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Submit';
            feather.replace();
        }
    };

    feather.replace();
}

window.handleQuickIdResubmit = async function (appInternalId) {
    // Redirect to the dedicated page for consistent flow
    localStorage.setItem('db_active_tab', 'upload_id');
    const app = document.getElementById('app');
    if (app) renderDashboard(app);
};

// ── Invite User Section ───────────────────────────────────────────────────────
