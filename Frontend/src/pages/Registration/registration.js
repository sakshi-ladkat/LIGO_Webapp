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
            <div class="button-group" style="display:flex; justify-content:space-between; margin-top:20px;">
                <button type="button" class="btn-secondary" id="prevBtn" style="display:none; width:auto; padding:10px 30px;">Previous</button>
                <div style="flex-grow: 1;"></div>
                <button type="button" class="btn-primary" id="nextBtn" style="width:auto; padding:10px 30px;">Next</button>
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
                    } else if (input.type !== 'file') {
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

        // Lock Step 1 fields if user has moved forward
        const step1Fields = document.querySelectorAll('.form-view[data-view="1"] input, .form-view[data-view="1"] select');
        step1Fields.forEach(f => {
            if (currentStep > 1) {
                f.disabled = true;
                f.classList.add('locked-field');
            } else {
                // Restore only if it's not a read-only field (like supervisor email)
                if (f.id !== 'supervisorEmail') {
                    f.disabled = false;
                    f.classList.remove('locked-field');
                }
            }
        });
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
             // Algorithmic validation check
             const currentView = document.querySelector(`.form-view[data-view="${currentStep}"]`);
             if (currentView) {
                 const requiredLabels = currentView.querySelectorAll('label .required');
                 let isValid = true;
                 requiredLabels.forEach(span => {
                     const label = span.closest('label');
                     const inputId = label.getAttribute('for');
                     if (inputId) {
                         const input = document.getElementById(inputId);
                         // If empty and not conditionally hidden (using offsetParent check for reliability)
                         const isVisible = input && (input.offsetParent !== null || input.getClientRects().length > 0);
                         if (input && !input.value && isVisible) {
                             input.setCustomValidity("Please fill out this required field.");
                             input.reportValidity();
                             isValid = false;
                         } else if (input) {
                             input.setCustomValidity("");
                         }
                     }
                 });
                 if (!isValid) return; // Prevent navigation
             }

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
                
                // Use FormData to support binary file uploads (ID Card)
                const formData = new FormData();
                Object.keys(payload).forEach(key => {
                    // Skip internal draft state if any
                    if (key !== 'currentStep') {
                        formData.append(key, payload[key]);
                    }
                });

                // Specifically append the ID Card file from the DOM
                const fileInput = document.getElementById('idCard');
                if (fileInput && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    if (file.size > 2 * 1024 * 1024) { // 2MB
                        alert('The ID Card file is too large (max 2MB). Please resize or choose a smaller image.');
                        nextBtn.disabled = false;
                        nextBtn.textContent = 'Submit';
                        return;
                    }
                    console.log('Attaching id_card file:', file.name);
                    formData.append('id_card', file);
                } else {
                    alert('Please select an Identity Card file.');
                    nextBtn.disabled = false;
                    nextBtn.textContent = 'Submit';
                    return;
                }
                
                console.log('Submitting Registration with keys:', Array.from(formData.keys()));
                
                authFetch('/api/auth/registration', {
                    method: 'POST',
                    body: formData
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
                
                if (item.country_code) {
                    opt.dataset.phonecode = item.country_code;
                }
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
    fetchOptions('/api/reference/titles', 'title', 'Select Title');

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

    // Auto-fill country phone code inside Contact View
    const countrySelect = document.getElementById('country');
    if (countrySelect) {
        countrySelect.addEventListener('change', (e) => {
            const selectedOpt = countrySelect.options[countrySelect.selectedIndex];
            const phoneCodeInput = document.getElementById('phoneCode');
            if (phoneCodeInput && selectedOpt && selectedOpt.dataset.phonecode) {
                const code = selectedOpt.dataset.phonecode;
                // Prepend '+' sign natively if the database misses it
                phoneCodeInput.value = code.startsWith('+') ? code : `+${code}`;
                
                // Fire logical change event for draft tracking
                phoneCodeInput.dispatchEvent(new Event('change'));
            }
        });
    }

    // Load draft before initializing steps
    loadDraft();

    const dobInput = document.getElementById('dob');
    if (dobInput) {
        const today = new Date();
        const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
        const maxDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
        dobInput.min = minDate.toISOString().split('T')[0];
        dobInput.max = maxDate.toISOString().split('T')[0];
    }

    // Initialize step states directly
    updateSteps();
}

