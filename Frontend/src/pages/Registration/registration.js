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
         <div id="affiliated-institute-banner-wrapper" style="display:none; margin-bottom: 20px;"></div>
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
                        if (input.tagName === 'SELECT') {
                            input.dispatchEvent(new Event('change'));
                        }
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

        // CORRECTION MODE OVERRIDE
        if (window._isCorrectionMode) {
            const allInputs = document.querySelectorAll('.form-container input, .form-container select, .form-container textarea');
            allInputs.forEach(input => {
                // If it's the file input or buttons, handle carefully, but buttons are not in this selector (type=button handled by specific IDs)
                if (!window._allowedCorrectionIds.includes(input.id) && input.type !== 'button' && input.type !== 'submit') {
                    input.disabled = true;
                    input.classList.add('locked-field');
                    // Ensure the visual feedback makes it clear it's read-only/locked
                    input.style.opacity = '0.6';
                    input.style.cursor = 'not-allowed';
                } else {
                    input.disabled = false;
                    input.classList.remove('locked-field');
                    input.style.opacity = '1';
                    input.style.cursor = 'text';
                }
            });
        }


        // Update Affiliated Institute display below progress bar
        const bannerWrapper = document.getElementById('affiliated-institute-banner-wrapper');
        if (bannerWrapper) {
            const instituteSelect = document.getElementById('institute');
            let selectedVal = instituteSelect ? instituteSelect.value : '';
            let displayText = '';

            // Fallback to localStorage if select is not yet populated
            if (!selectedVal) {
                try {
                    const draft = JSON.parse(localStorage.getItem('registration_draft') || '{}');
                    selectedVal = draft.institute || '';
                    if (selectedVal && selectedVal !== 'other' && instituteSelect && instituteSelect.options.length > 1) {
                        const opt = Array.from(instituteSelect.options).find(o => o.value == selectedVal);
                        if (opt) displayText = opt.text;
                    }
                } catch (e) { }
            } else if (selectedVal !== 'other' && instituteSelect && instituteSelect.selectedIndex >= 0) {
                displayText = instituteSelect.options[instituteSelect.selectedIndex].text;
            }

            if (selectedVal === 'other') {
                const otherInst = document.getElementById('otherInstitute');
                displayText = otherInst ? otherInst.value : '';
                if (!displayText) {
                    try {
                        const draft = JSON.parse(localStorage.getItem('registration_draft') || '{}');
                        displayText = draft.otherInstitute || '';
                    } catch (e) { }
                }
            }

            if (currentStep > 1 && displayText) {
                bannerWrapper.innerHTML = `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 20px; border-radius: 0; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #e0e7ff; color: #4f46e5; padding: 8px; border-radius: 0; display: inline-flex; align-items: center; justify-content: center;">
                                <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Institute.svg); mask-image: url(/assets/icons/Institute.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                            </span>
                            <div>
                                <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">Selected Affiliated Institute</div>
                                <div style="font-size: 14px; font-weight: 700; color: #1e293b;">${displayText}</div>
                            </div>
                        </div>
                    </div>
                `;
                bannerWrapper.style.display = 'block';
            } else {
                bannerWrapper.style.display = 'none';
                bannerWrapper.innerHTML = '';
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

                // Custom specific validations
                if (isValid) {
                    const dobInput = document.getElementById('dob');
                    if (dobInput && document.body.contains(dobInput)) {
                        const val = dobInput.value;
                        if (val) {
                            const date = new Date(val);
                            const year = date.getFullYear();
                            const currentYear = new Date().getFullYear();
                            if (year < (currentYear - 80) || year > (currentYear - 14)) {
                                if (window.showToast) window.showToast(`Birth year must be between ${currentYear - 80} and ${currentYear - 14}.`, "error");
                                else alert(`Birth year must be between ${currentYear - 80} and ${currentYear - 14}.`);
                                isValid = false;
                            } else {
                                dobInput.setCustomValidity("");
                            }
                        }
                    }

                    const addr1 = document.getElementById('address1');
                    const addr2 = document.getElementById('address2');
                    const addr3 = document.getElementById('address3');
                    if (addr1 && document.body.contains(addr1)) {
                        const v1 = addr1.value.trim().toLowerCase();
                        const v2 = addr2 ? addr2.value.trim().toLowerCase() : '';
                        const v3 = addr3 ? addr3.value.trim().toLowerCase() : '';
                        if (v1 && ((v1 === v2) || (v1 === v3))) {
                            if (window.showToast) window.showToast("Address lines must not contain duplicate data.", "error");
                            else alert("Address lines must not contain duplicate data.");
                            isValid = false;
                        } else if (v2 && (v2 === v3)) {
                            if (window.showToast) window.showToast("Address lines must not contain duplicate data.", "error");
                            else alert("Address lines must not contain duplicate data.");
                            isValid = false;
                        } else {
                            if (addr2) addr2.setCustomValidity("");
                            if (addr3) addr3.setCustomValidity("");
                        }
                    }

                    const phoneInput = document.getElementById('phoneNumber');
                    if (phoneInput && document.body.contains(phoneInput)) {
                        const phVal = phoneInput.value.replace(/\D/g, '');
                        if (phVal && (phVal.length < 7 || phVal.length > 15)) {
                            phoneInput.setCustomValidity("Phone number must be between 7 and 15 digits.");
                            phoneInput.reportValidity();
                            isValid = false;
                        } else {
                            phoneInput.setCustomValidity("");
                        }
                    }
                }

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
                try { payload = JSON.parse(stored); } catch (e) { }

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
                const designation = payload['designation'];
                const designationText = document.querySelector(`#designation option[value="${designation}"]`)?.textContent.toLowerCase() || '';
                const isStudent = designationText.includes('student') || designationText.includes('intern');

                const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
                const mode = urlParams.get('mode');
                const isEditOrReapply = mode === 'edit' || mode === 'reapply';

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
                } else if (isStudent && !isEditOrReapply) {
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
                        if (window.showToast) window.showToast(data.error, 'error');
                        else alert(data.error);

                        nextBtn.disabled = false;
                        nextBtn.textContent = 'Submit';
                    } else {
                        // Registration complete logic
                        if (window.showToast) window.showToast('Registration submitted successfully!', 'success');
                        localStorage.removeItem('registration_draft');
                        localStorage.setItem('user_status', 'filled');
                        
                        // Force dashboard refresh
                        if (window.location.hash === '#/dashboard') {
                            window.dispatchEvent(new HashChangeEvent("hashchange"));
                        } else {
                            window.location.hash = '#/dashboard';
                        }
                    }
                }).catch(err => {
                    console.error('Submission error:', err);
                    const msg = 'Submission failed due to a system error. Please try logging out and in again.';
                    if (window.showToast) window.showToast(msg, 'error');
                    else alert(msg);

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
                        if (selectId === 'institute') {
                            updateSteps();
                        }
                    }
                } catch (e) { }
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

    // Pincode API logic for India
    const zipcodeInput = document.getElementById('zipcode');
    const cityInput = document.getElementById('city');
    const stateInput = document.getElementById('state');

    if (zipcodeInput && countrySelect && cityInput && stateInput) {
        zipcodeInput.addEventListener('input', async (e) => {
            const val = e.target.value.trim();
            const countryText = countrySelect.options[countrySelect.selectedIndex]?.text || '';
            
            // Only use Indian pincode API if country is India and zipcode is 6 digits
            if (countryText.toLowerCase() === 'india' && val.length === 6 && /^\d+$/.test(val)) {
                try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${val}`);
                    const data = await res.json();
                    if (data && data[0] && data[0].Status === 'Success') {
                        const postOffices = data[0].PostOffice;
                        if (postOffices && postOffices.length > 0) {
                            // Populate State
                            stateInput.value = postOffices[0].State;
                            stateInput.dispatchEvent(new Event('change'));
                            
                            // Convert City to Dropdown if it's currently an input
                            const currentCityVal = cityInput.value;
                            const cityParent = cityInput.parentNode;
                            
                            let citySelect = document.getElementById('city_select');
                            if (!citySelect) {
                                citySelect = document.createElement('select');
                                citySelect.id = 'city_select';
                                citySelect.className = 'form-control';
                                cityInput.style.display = 'none';
                                cityInput.id = 'city_hidden'; // Rename to avoid ID conflict
                                cityParent.appendChild(citySelect);
                            }
                            
                            citySelect.innerHTML = '<option value="" disabled selected>-- Select City/Area --</option>';
                            const uniqueCities = [...new Set(postOffices.map(po => po.Name))].sort();
                            uniqueCities.forEach(city => {
                                const opt = document.createElement('option');
                                opt.value = city;
                                opt.textContent = city;
                                citySelect.appendChild(opt);
                            });
                            
                            // If draft had a city, try to select it
                            if (uniqueCities.includes(currentCityVal)) {
                                citySelect.value = currentCityVal;
                            } else {
                                citySelect.value = uniqueCities[0];
                            }
                            
                            // Keep hidden input updated for submission/draft saving
                            citySelect.addEventListener('change', () => {
                                document.getElementById('city_hidden').value = citySelect.value;
                                document.getElementById('city_hidden').dispatchEvent(new Event('change'));
                            });
                            document.getElementById('city_hidden').value = citySelect.value;
                            document.getElementById('city_hidden').dispatchEvent(new Event('change'));
                            
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch pincode data:", err);
                }
            } else if (countryText.toLowerCase() === 'india' && val.length < 6) {
                // Revert to normal input if user clears or edits pincode
                const citySelect = document.getElementById('city_select');
                const hiddenCity = document.getElementById('city_hidden');
                if (citySelect && hiddenCity) {
                    citySelect.remove();
                    hiddenCity.id = 'city';
                    hiddenCity.style.display = 'block';
                }
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

    // Init Edit/Reapply Mode if specified in URL
    async function initEditMode() {
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const mode = urlParams.get('mode');
        if (mode === 'edit' || mode === 'reapply') {
            try {
                // Fetch app data
                const appRes = await authFetch('/api/auth/review/my-application');
                if (!appRes.ok) throw new Error('Failed to fetch app');
                const appData = await appRes.json();

                const correctionFields = appData.application.correction_fields ? JSON.parse(appData.application.correction_fields) : [];
                const isCorrection = mode === 'edit' && appData.application.correction_required;

                // Show Banner
                if (isCorrection) {
                    const banner = document.createElement('div');
                    banner.innerHTML = `
                        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 1.25rem; border-radius: 0.75rem; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1rem;">
                            <div style="background: #f59e0b; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <span style="-webkit-mask-image: url(/assets/icons/Warning.svg); mask-image: url(/assets/icons/Warning.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
                            </div>
                            <div>
                                <div style="font-weight: 800; color: #b45309; font-size: 0.95rem; margin-bottom: 0.3rem;">Correction Required</div>
                                <div style="color: #d97706; font-size: 0.85rem; line-height: 1.5; font-weight: 500; margin-bottom: 0.5rem;">
                                    Please update the fields as requested: ${appData.application.rejection_reason || ''}
                                </div>
                                <div style="color: #92400e; font-size: 0.8rem;">
                                    <strong>Reasons:</strong> ${correctionFields.join(', ')}
                                </div>
                            </div>
                        </div>
                    `;
                    formContainer.insertBefore(banner, formContainer.firstChild);
                    if (window.feather) window.feather.replace();
                } else if (mode === 'reapply') {
                    const banner = document.createElement('div');
                    banner.innerHTML = `
                        <div style="background: #e0f2fe; border: 1px solid #bae6fd; padding: 1.25rem; border-radius: 0.75rem; margin-bottom: 2rem; display: flex; align-items: flex-start; gap: 1rem;">
                            <div style="background: #0284c7; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <span style="-webkit-mask-image: url(/assets/icons/rotate-cw.svg); mask-image: url(/assets/icons/rotate-cw.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
                            </div>
                            <div>
                                <div style="font-weight: 800; color: #0369a1; font-size: 0.95rem; margin-bottom: 0.3rem;">Reapply Application</div>
                                <div style="color: #0284c7; font-size: 0.85rem; line-height: 1.5; font-weight: 500;">
                                    Your previous application was declined. You are reapplying now. All fields are editable, and your previous data has been preloaded for your convenience.
                                </div>
                            </div>
                        </div>
                    `;
                    formContainer.insertBefore(banner, formContainer.firstChild);
                    if (window.feather) window.feather.replace();
                }

                // Fetch Me data
                const meRes = await authFetch('/api/auth/me');
                if (!meRes.ok) throw new Error('Failed to fetch profile');
                const meData = await meRes.json();

                // Pre-fill Draft
                const draft = { currentStep: 1 }; // Reset to step 1 for editing

                if (meData.profile) {
                    draft.title = meData.profile.title || '';
                    draft.firstName = meData.profile.first_name || '';
                    draft.middleName = meData.profile.middle_name || '';
                    draft.lastName = meData.profile.last_name || '';
                    draft.dob = meData.profile.date_of_birth || '';
                    draft.gender = meData.profile.gender || '';
                }
                if (meData.contact) {
                    draft.continent = meData.contact.continent_id || '';
                    draft.country = meData.contact.country_id || '';
                    draft.address1 = meData.contact.address_line_1 || '';
                    draft.address2 = meData.contact.address_line_2 || '';
                    draft.address3 = meData.contact.address_line_3 || '';
                    draft.city = meData.contact.city || '';
                    draft.state = meData.contact.state || '';
                    draft.zipcode = meData.contact.postal_code || '';
                    draft.phoneCode = meData.contact.country_code || '';
                    draft.cityCode = meData.contact.city_code || '';
                    draft.phoneNumber = meData.contact.phone_number || '';
                    draft.faxNumber = meData.contact.fax_number || '';
                }
                if (meData.qualifications && meData.qualifications.length > 0) {
                    const q = meData.qualifications[0];
                    draft.highestQualification = q.highest_qualification || '';
                    draft.fieldOfStudy = q.field_of_study || '';
                    draft.university = q.university || '';
                    draft.graduationYear = q.graduation_year || '';
                    draft.graduationMonth = q.graduation_month || '';
                }
                if (meData.affiliation) {
                    draft.institute = meData.affiliation.institute_id || '';
                    draft.designation = meData.affiliation.category_id || '';
                    draft.department = meData.affiliation.department || '';
                }
                if (meData.supervisor) {
                    draft.supervisorSelect = meData.supervisor.supervisor_id || '';
                }

                localStorage.setItem('registration_draft', JSON.stringify(draft));
                loadDraft();
                // Apply Field Locks
                if (isCorrection && correctionFields.length > 0) {
                    const correctionFieldMap = {
                        'Missing Identity Proof': ['idCard'],
                        'Incomplete Educational Details': ['highestQualification', 'fieldOfStudy', 'university', 'graduationYear', 'graduationMonth'],
                        'Invalid Institute Category': ['instituteCategory', 'instituteId', 'department', 'otherInstitute']
                    };

                    let allowedIds = [];
                    correctionFields.forEach(cf => {
                        if (correctionFieldMap[cf]) {
                            allowedIds = allowedIds.concat(correctionFieldMap[cf]);
                        }
                    });

                    // Add custom CSS for locked fields
                    const style = document.createElement('style');
                    style.innerHTML = `
                        .locked-field-container { position: relative; }
                        .locked-field-container input, .locked-field-container select, .locked-field-container textarea {
                            background-color: #f1f5f9 !important;
                            cursor: not-allowed !important;
                            color: #64748b !important;
                            border-color: #e2e8f0 !important;
                        }
                        .lock-icon {
                            position: absolute;
                            right: 10px;
                            top: 50%;
                            transform: translateY(-50%);
                            color: #94a3b8;
                            width: 14px;
                            height: 14px;
                        }
                        .lock-tooltip {
                            position: absolute;
                            background: #1e293b;
                            color: white;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 0.7rem;
                            bottom: 100%;
                            left: 50%;
                            transform: translateX(-50%);
                            display: none;
                            white-space: nowrap;
                            z-index: 100;
                            margin-bottom: 5px;
                        }
                        .locked-field-container:hover .lock-tooltip { display: block; }
                    `;
                    document.head.appendChild(style);

                    const allInputs = document.querySelectorAll('input, select, textarea');
                    allInputs.forEach(input => {
                        if (input.id && input.id !== 'currentStep' && !allowedIds.includes(input.id)) {
                            input.disabled = true;
                            input.readOnly = true;

                            const parent = input.parentElement;
                            if (parent && !parent.classList.contains('locked-field-container')) {
                                parent.classList.add('locked-field-container');
                                const lockIcon = document.createElement('div');
                                lockIcon.className = 'lock-icon';
                                lockIcon.innerHTML = '<span style="-webkit-mask-image: url(/assets/icons/Block.svg); mask-image: url(/assets/icons/Block.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 14px; height: 14px; display: inline-block;"></span>';
                                parent.appendChild(lockIcon);

                                const tooltip = document.createElement('div');
                                tooltip.className = 'lock-tooltip';
                                tooltip.innerText = 'Field locked during correction review';
                                parent.appendChild(tooltip);
                            }
                        }
                    });
                    if (window.feather) window.feather.replace();
                }

            } catch (err) {
                console.error("Edit mode error:", err);
            }
        }
    }

    initEditMode();
}
