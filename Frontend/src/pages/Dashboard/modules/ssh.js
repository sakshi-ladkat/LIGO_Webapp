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

