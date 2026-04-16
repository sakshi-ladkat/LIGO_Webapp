import { User_affilation, initAffiliation } from './views/User_affilation.js';
import { User_profile } from './views/User_profile.js';
import { authFetch } from '../../utils/auth.js';
import { User_education } from './views/User_qualification.js';
import { User_Contact } from './views/User_Contact.js';
import './registration.css';

export function RegistrationView() {
    return `
      <div class="registration-container">
         <div class="progress-bar">
             <div class="progress-step active" data-step="1"><span class="progress-step-label">Affiliation</span></div>
             <div class="progress-step" data-step="2"><span class="progress-step-label">Profile</span></div>
             <div class="progress-step" data-step="3"><span class="progress-step-label">Qualification</span></div>
             <div class="progress-step" data-step="4"><span class="progress-step-label">Contact</span></div>
         </div>
         <div class="form-container">
            ${User_affilation()}
            ${User_profile()}
            ${User_education()}
            ${User_Contact()}
            <div class="button-group">
                <button type="button" class="btn-secondary" id="prevBtn" style="display:none;">Previous</button>
                <div style="flex-grow: 1;"></div>
                <button type="button" class="btn-primary" id="nextBtn">Next</button>
            </div>
         </div>
      </div>
    `;
}

export function initRegistration() {
    let currentStep = 1;
    const totalSteps = 4;
    const formContainer = document.querySelector('.form-container');

    // ── Draft Saving Logic ──
    function saveDraft() {
        if (!formContainer) return;
        const inputs = formContainer.querySelectorAll('input, select, textarea');
        const draft = { currentStep };
        inputs.forEach(input => {
            const key = input.id || input.name;
            if (key) {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    draft[key] = input.checked;
                } else {
                    draft[key] = input.value;
                }
            }
        });
        localStorage.setItem('registration_draft', JSON.stringify(draft));
    }

    function loadDraft() {
        const stored = localStorage.getItem('registration_draft');
        if (!stored) return;
        try {
            const draft = JSON.parse(stored);
            if (draft.currentStep) currentStep = parseInt(draft.currentStep, 10);
            
            const inputs = formContainer.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                const key = input.id || input.name;
                if (draft[key] !== undefined) {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = draft[key];
                    } else {
                        input.value = draft[key];
                    }
                }
            });
        } catch (e) {
            console.error('Error parsing draft', e);
        }
    }

    if (formContainer) {
        formContainer.addEventListener('change', saveDraft);
        formContainer.addEventListener('input', () => {
            saveDraft();
        });
    }

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressSteps = document.querySelectorAll('.progress-step');
    const formViews = document.querySelectorAll('.form-view');

    function updateSteps() {
        formViews.forEach((view) => {
            const stepNum = parseInt(view.getAttribute('data-view'), 10);
            if (stepNum === currentStep) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        progressSteps.forEach((step, index) => {
            const stepNum = parseInt(step.getAttribute('data-step') || (index + 1), 10);
            if (stepNum < currentStep) {
                step.classList.add('completed', 'active');
            } else if (stepNum === currentStep) {
                step.classList.remove('completed');
                step.classList.add('active');
            } else {
                step.classList.remove('completed', 'active');
            }
        });

        if (prevBtn) {
            if (currentStep === 1) {
                prevBtn.style.display = 'none';
            } else {
                prevBtn.style.display = 'block';
            }
        }

        if (nextBtn) {
            if (currentStep === totalSteps) {
                nextBtn.textContent = 'Submit';
            } else {
                nextBtn.textContent = 'Next';
            }
        }
    }

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateSteps();
                saveDraft();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentStep < totalSteps) {
                currentStep++;
                updateSteps();
                saveDraft();
            } else {
                nextBtn.disabled = true;
                nextBtn.textContent = 'Submitting...';
                
                const stored = localStorage.getItem('registration_draft') || '{}';
                let payload = {};
                try { payload = JSON.parse(stored); } catch(e) {}
                
                authFetch('/api/registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(res => res.json()).then(data => {
                    if (data.error) {
                        alert(data.error);
                        nextBtn.disabled = false;
                        nextBtn.textContent = 'Submit';
                    } else {
                        // Registration complete logic
                        localStorage.removeItem('registration_draft');
                        localStorage.setItem('user_status', 'filled');
                        window.location.hash = '#/dashboard';
                    }
                }).catch(err => {
                    console.error('Submission error:', err);
                    alert('Submission failed.');
                    nextBtn.disabled = false;
                    nextBtn.textContent = 'Submit';
                });
            }
        });
    }

    /* API Fetching for Dropdowns */
    async function fetchOptions(url, selectId, defaultText) {
        const select = document.getElementById(selectId);
        if (!select) return;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            
            const resData = await response.json();
            const arr = Array.isArray(resData) ? resData : (resData.data || []);
            
            select.innerHTML = `<option value="" disabled selected>-- ${defaultText} --</option>`;
            
            arr.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id || item.value || '';
                opt.textContent = item.name || item.title || item.institutes_name || `Option ${opt.value}`;
                select.appendChild(opt);
            });

            // Restore draft values for asynchronously loaded dropdowns
            const stored = localStorage.getItem('registration_draft');
            if (stored) {
                try {
                    const draft = JSON.parse(stored);
                    if (draft[selectId]) {
                        select.value = draft[selectId];
                        // If we just restored a continent from draft, trigger country load
                        if (selectId === 'continent') {
                            select.dispatchEvent(new Event('change'));
                        }
                    }
                } catch(e) {}
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Delegate specific module loading
    initAffiliation();

    // Load initial reference data
    fetchOptions('/api/reference/continents', 'continent', 'Select Continent');

    // Handle continent change -> load countries
    const continentSelect = document.getElementById('continent');
    if (continentSelect) {
        continentSelect.addEventListener('change', (e) => {
            const continentId = e.target.value;
            if (continentId) {
                fetchOptions(`/api/reference/countries?continent_id=${continentId}`, 'country', 'Select Country');
            }
        });
    }

    // Load draft before initializing steps
    loadDraft();

    // Initialize step states directly
    updateSteps();
}

