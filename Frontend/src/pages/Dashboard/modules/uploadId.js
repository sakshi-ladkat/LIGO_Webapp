import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc } from '../../../utils/helpers.js';
import { renderCropperModal, initCropper } from '../../../components/ImageCropper.js';

export function buildUploadIdHtml(app) {
    return `
    <div class="db-tracker-card" style="padding: 2.5rem; max-width: 800px; margin: 0 auto;">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #f1f5f9;">
            <div style="background: #fff7ed; width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
                <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/upload.svg) no-repeat center; mask: url(/assets/icons/upload.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 32px; height: 32px; display: inline-block;"></span>
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
    ${renderCropperModal()}
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
            const targetUid = state.meData?.user?.user_id || app.user_id;
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
            if (window.feather) window.feather.replace();
        } catch (e) {
            console.error('[Dashboard] ID fetch error:', e);
            currentIdBox.innerHTML = `<div style="padding:1rem; text-align:center; color:#94a3b8; font-size:0.8rem;">No previous ID uploaded</div>`;
        }
    })();

    dropzone.onclick = () => input.click();

    let finalFile = null;

    input.onchange = () => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    initCropper(e.target.result, {
                        container: container,
                        onCrop: (blob) => {
                            finalFile = new File([blob], file.name, { type: 'image/jpeg' });
                            const url = URL.createObjectURL(blob);
                            dropzone.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit: contain; border-radius:0.5rem;">`;
                            preview.textContent = `Selected & Cropped: ${finalFile.name}`;
                        },
                        onCancel: () => {
                            if (!finalFile) input.value = '';
                        }
                    });
                    if (window.feather) window.feather.replace();
                };
                reader.readAsDataURL(file);
            } else {
                // PDF or other
                finalFile = file;
                preview.textContent = `Selected: ${file.name}`;
                dropzone.innerHTML = `<span class="extracted-svg" style="width:40px;height:40px;color:#6366f1;margin-bottom:1rem; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span><p style="margin:0;font-size:0.85rem;color:#0f172a;font-weight:700;">${file.name}</p>`;
                if (window.feather) window.feather.replace();
            }
        }
    };

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
            feedback.textContent = '✓ Identity Proof successfully re-uploaded. Redirecting to dashboard...';

            // Optimistically update local state for instant feedback
            app.status = 'reuploaded_id_card';
            
            // Instantly redirect to the main dashboard tab and rerender
            localStorage.setItem('db_active_tab', 'dashboard');
            onSuccess();

        } catch (err) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/send.svg); mask-image: url(/assets/icons/send.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Submit';
            if (window.feather) window.feather.replace();
        }
    };

    if (window.feather) window.feather.replace();
}

window.handleQuickIdResubmit = async function (appInternalId) {
    // Redirect to the dedicated page for consistent flow
    localStorage.setItem('db_active_tab', 'upload_id');
    const app = document.getElementById('app');
    if (app && window.renderDashboard) window.renderDashboard(app);
};
