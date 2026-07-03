import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { state } from './core.js';
import { __esc } from '../../../utils/helpers.js';

export async function renderModifyInstitute(container) {
    container.innerHTML = `
        <div style="display: flex; justify-content: center; padding: 4rem;">
            <div style="border: 3px solid #f3f3f3; border-top: 3px solid #4f46e5; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        </div>
    `;

    let categories = [];
    let institutes = [];

    try {
        const [catRes, instRes] = await Promise.all([
            fetch('/api/reference/categories'),
            fetch('/api/reference/institutes')
        ]);
        if (catRes.ok) categories = await catRes.json();
        if (instRes.ok) institutes = await instRes.json();
    } catch (e) {
        console.error('Failed to load references', e);
    }

    const activeApp = state.myAppData?.application;
    const isModifyActive = activeApp && activeApp.request_name === 'Modify Affiliation' && 
        ['submitted', 'pending', 'under_review', 'id_proof_pending', 'correction', 'correction_required'].includes(activeApp.status);

    if (isModifyActive) {
        let requestedInstName = activeApp.requested_other_institute || 'Unknown Institute';
        if (!activeApp.requested_other_institute && activeApp.requested_institute_id) {
            const inst = institutes.find(i => i.id == activeApp.requested_institute_id);
            if (inst) requestedInstName = inst.name;
        }

        let requestedCatName = 'Unknown Category';
        if (activeApp.requested_category_id) {
            const cat = categories.find(c => c.id == activeApp.requested_category_id);
            if (cat) requestedCatName = cat.name;
        }

        container.innerHTML = `
            <div class="db-tracker-card" style="max-width: 650px; margin: 0 auto; padding: 2.5rem; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6); border-radius: 1.5rem;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <div style="background: linear-gradient(135deg, #fef9c3 0%, #fde047 100%); width: 72px; height: 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: #a16207; box-shadow: 0 4px 20px -5px rgba(234,179,8,0.3);">
                        <span class="extracted-svg" style="display: inline-block; width: 36px; height: 36px; -webkit-mask-image: url(/assets/icons/clock.svg); mask-image: url(/assets/icons/clock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    </div>
                    <h2 style="margin: 0 0 0.5rem; font-size: 1.6rem; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">Active Request Pending</h2>
                    <p style="margin: 0; color: #64748b; font-size: 1rem; line-height: 1.5;">You have an active application of modify affiliation. You can send a request once that will be resolved.</p>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div style="background: linear-gradient(to right, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.5rem; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #64748b;"></div>
                        <h3 style="margin: 0 0 1rem; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="extracted-svg" style="width: 16px; height: 16px; display: inline-block; -webkit-mask-image: url(/assets/icons/info.svg); mask-image: url(/assets/icons/info.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                            Current Affiliation
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem;">
                                <span style="color: #64748b; font-size: 0.9rem; font-weight: 500;">Institute</span>
                                <span style="font-weight: 800; color: #1e293b; text-align: right;">${__esc(state.meData?.affiliation?.institute_name || 'Not specified')}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #64748b; font-size: 0.9rem; font-weight: 500;">Category</span>
                                <span style="font-weight: 800; color: #1e293b; text-align: right;">${__esc(state.meData?.affiliation?.category_name || 'Not specified')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: center; margin: -0.5rem 0;">
                        <span class="extracted-svg" style="color: #cbd5e1; width: 24px; height: 24px; display: inline-block; -webkit-mask-image: url(/assets/icons/arrow-down.svg); mask-image: url(/assets/icons/arrow-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    </div>

                    <div style="background: linear-gradient(to right, #f0fdf4, #ecfdf5); border: 1px solid #bbf7d0; border-radius: 1rem; padding: 1.5rem; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #10b981;"></div>
                        <h3 style="margin: 0 0 1rem; font-size: 0.85rem; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                            <span class="extracted-svg" style="width: 16px; height: 16px; display: inline-block; -webkit-mask-image: url(/assets/icons/arrow-right-circle.svg); mask-image: url(/assets/icons/arrow-right-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                            Transferred Affiliation
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #bbf7d0; padding-bottom: 0.5rem;">
                                <span style="color: #166534; font-size: 0.9rem; font-weight: 500;">Institute</span>
                                <span style="font-weight: 800; color: #14532d; text-align: right;">${__esc(requestedInstName)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #166534; font-size: 0.9rem; font-weight: 500;">Category</span>
                                <span style="font-weight: 800; color: #14532d; text-align: right;">${__esc(requestedCatName)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="db-tracker-card" style="max-width: 650px; margin: 0 auto; padding: 2.5rem; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6); border-radius: 1.5rem;">
            <div style="text-align: center; margin-bottom: 2.5rem;">
                <div style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); width: 72px; height: 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; color: #4f46e5; box-shadow: 0 4px 20px -5px rgba(79,70,229,0.3);">
                    <span class="extracted-svg" style="display: inline-block; width: 36px; height: 36px; -webkit-mask-image: url(/assets/icons/edit.svg); mask-image: url(/assets/icons/edit.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h2 style="margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">Modify Affiliation</h2>
                <p style="margin: 0; color: #64748b; font-size: 1rem; line-height: 1.5;">Request a change to your primary institute or category.</p>
            </div>

            <div style="background: linear-gradient(to right, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.5rem; margin-bottom: 2rem; position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #4f46e5;"></div>
                <h3 style="margin: 0 0 1rem; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="extracted-svg" style="width: 16px; height: 16px; display: inline-block; -webkit-mask-image: url(/assets/icons/info.svg); mask-image: url(/assets/icons/info.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                    Current Affiliation
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.9rem; font-weight: 500;">Institute</span>
                        <span style="font-weight: 800; color: #1e293b; background: white; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${__esc(state.meData?.affiliation?.institute_name || 'Not specified')}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #64748b; font-size: 0.9rem; font-weight: 500;">Category</span>
                        <span style="font-weight: 800; color: #1e293b; background: white; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${__esc(state.meData?.affiliation?.category_name || 'Not specified')}</span>
                    </div>
                </div>
            </div>

            <form id="modify-institute-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div class="form-group" style="background: white; padding: 1rem; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <label style="display: block; font-weight: 800; color: #1e293b; margin-bottom: 0.75rem; font-size: 0.95rem;">Transferred Institute <span style="color: #ef4444;">*</span></label>
                    <select id="mi-institute" required style="width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; transition: all 0.2s; font-size: 0.95rem; background-color: #f8fafc; color: #0f172a; cursor: pointer;">
                        <option value="">Select Institute...</option>
                    </select>
                </div>

                <div class="form-group" style="background: white; padding: 1rem; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <label style="display: block; font-weight: 800; color: #1e293b; margin-bottom: 0.75rem; font-size: 0.95rem;">Transferred Category <span style="color: #ef4444;">*</span></label>
                    <select id="mi-category" required style="width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; transition: all 0.2s; font-size: 0.95rem; background-color: #f8fafc; color: #0f172a; cursor: pointer;">
                        <option value="">Select Category...</option>
                    </select>
                </div>

                <div class="form-group" id="mi-other-institute-group" style="display: none; background: white; padding: 1rem; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); animation: fadeIn 0.3s ease;">
                    <label style="display: block; font-weight: 800; color: #1e293b; margin-bottom: 0.75rem; font-size: 0.95rem;">Custom Institute Name <span style="color: #ef4444;">*</span></label>
                    <input type="text" id="mi-other-institute" placeholder="Enter your institute name" style="width: 100%; box-sizing: border-box; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; font-size: 0.95rem; background-color: #f8fafc; transition: all 0.2s;">
                </div>
                
                <div class="form-group" style="background: white; padding: 1rem; border-radius: 1rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <label style="display: block; font-weight: 800; color: #1e293b; margin-bottom: 0.75rem; font-size: 0.95rem;">New ID Card (Optional)</label>
                    <input type="file" id="mi-id-card" accept=".pdf,.jpg,.jpeg,.png" style="width: 100%; box-sizing: border-box; padding: 0.75rem; border: 2px dashed #cbd5e1; border-radius: 0.5rem; outline: none; background: #f8fafc; cursor: pointer; transition: all 0.2s;">
                    <p style="font-size: 0.8rem; color: #64748b; margin: 0.5rem 0 0; display: flex; align-items: center; gap: 0.25rem;">
                        <span class="extracted-svg" style="width: 14px; height: 14px; display: inline-block; -webkit-mask-image: url(/assets/icons/upload-cloud.svg); mask-image: url(/assets/icons/upload-cloud.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        Upload a new ID proof if required by your new affiliation.
                    </p>
                </div>

                <div id="mi-feedback" style="display: none; padding: 1rem; border-radius: 0.75rem; font-size: 0.9rem; font-weight: 700; margin-top: 0.5rem;"></div>

                <button type="submit" id="mi-submit-btn" style="width: 100%; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: white; border: none; padding: 1.25rem; border-radius: 0.75rem; font-weight: 900; font-size: 1.05rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1rem;">
                    Submit Modification Request
                </button>
            </form>
        </div>
        <style>
            #modify-institute-form input:focus, #modify-institute-form select:focus {
                border-color: #4f46e5 !important;
                background-color: white !important;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
            }
            #mi-submit-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 20px -5px rgba(79, 70, 229, 0.4) !important;
            }
            #mi-submit-btn:active {
                transform: translateY(0);
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    `;

    const catSelect = container.querySelector('#mi-category');
    const instSelect = container.querySelector('#mi-institute');
    const otherGroup = container.querySelector('#mi-other-institute-group');
    const otherInput = container.querySelector('#mi-other-institute');
    const form = container.querySelector('#modify-institute-form');
    const btn = container.querySelector('#mi-submit-btn');
    const feedback = container.querySelector('#mi-feedback');

    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        catSelect.appendChild(opt);
    });

    const currentInstituteId = state.meData?.affiliation?.institute_id;
    institutes.forEach(i => {
        if (i.id !== currentInstituteId) {
            const opt = document.createElement('option');
            opt.value = i.id;
            opt.textContent = i.name;
            instSelect.appendChild(opt);
        }
    });
    const otherOpt = document.createElement('option');
    otherOpt.value = 'other';
    otherOpt.textContent = 'Other (Please specify)';
    instSelect.appendChild(otherOpt);

    instSelect.onchange = () => {
        if (instSelect.value === 'other') {
            otherGroup.style.display = 'block';
            otherInput.required = true;
        } else {
            otherGroup.style.display = 'none';
            otherInput.required = false;
            otherInput.value = '';
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        btn.disabled = true;
        btn.textContent = 'Submitting...';
        btn.style.opacity = '0.7';
        feedback.style.display = 'none';

        const formData = new FormData();
        formData.append('category_id', catSelect.value);
        if (instSelect.value === 'other') {
            formData.append('other_institute', otherInput.value);
        } else {
            formData.append('institute_id', instSelect.value);
        }
        
        const fileInput = container.querySelector('#mi-id-card');
        if (fileInput.files[0]) {
            formData.append('id_card', fileInput.files[0]);
        }

        try {
            const res = await authFetch('/api/auth/modify-institute', {
                method: 'POST',
                body: formData
            }, true);
            
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to submit request');
            
            feedback.style.display = 'block';
            feedback.style.background = '#dcfce7';
            feedback.style.color = '#166534';
            feedback.style.border = '1px solid #bbf7d0';
            feedback.textContent = data.message || 'Request submitted successfully!';
            
            form.reset();
            otherGroup.style.display = 'none';
            
            // Reload the page logic can be added here if needed to refresh to the active request view
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (err) {
            feedback.style.display = 'block';
            feedback.style.background = '#fef2f2';
            feedback.style.color = '#b91c1c';
            feedback.style.border = '1px solid #fecaca';
            feedback.textContent = err.message;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit Modification Request';
            btn.style.opacity = '1';
        }
    };
}

