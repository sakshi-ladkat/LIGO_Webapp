import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

export function User_affilation() {
  return `
  <div class="form-view active" data-view="1">

    <div class="view-header">
      <h2>Affiliation Selection</h2>
      <p>Search and confirm your primary affiliated institute.</p>
    </div>

    <div class="form-grid">

      <!-- Institute -->
      <div class="input-group full-width">
        <label for="institute">Select Institute <span class="required">*</span></label>
        <select id="institute" class="form-control">
          <option value="" disabled selected>-- Search Institute --</option>
        </select>

        <div id="other-institute-wrapper" style="display:none; margin-top:10px;">
          <input type="text" id="otherInstitute" class="form-control"
            placeholder="Enter your institute name...">
        </div>
      </div>

      <!-- Designation -->
      <div class="input-group full-width">
        <label for="designation">Designation <span class="required">*</span></label>
        <select id="designation" class="form-control">
          <option value="" disabled selected>-- Select Designation --</option>
          <option value="student">Student</option>
          <option value="researcher">Researcher</option>
          <option value="faculty">Faculty</option>
        </select>
      </div>

      <!-- Supervisor Section -->
      <div id="supervisor-section" class="input-group full-width"
        style="display:none; padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">

        <h3 style="margin:0 0 12px 0;">Supervisor Details</h3>

        <div style="margin-bottom:15px;">
          <label for="supervisorSelect">Select Supervisor <span class="required">*</span></label>
          <select id="supervisorSelect" class="form-control">
            <option value="" disabled selected>-- Select Supervisor --</option>
          </select>
        </div>

        <div style="margin-bottom:15px;">
          <label for="supervisorEmail">Supervisor Email</label>
          <input type="email" id="supervisorEmail" class="form-control" disabled>
        </div>

        
        <!-- Cropper Modal -->
        <div id="cropper-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center;">
          <div style="background:white; padding:20px; border-radius:8px; width:90%; max-width:600px; text-align:center;">
            <h3 style="margin-top:0;">Crop Your ID Card</h3>
            <div style="max-height:400px; overflow:hidden; margin-bottom:15px; display:flex; justify-content:center; align-items:center;">
              <img id="cropper-image" style="max-width:100%; max-height:350px; display:block;">
            </div>
            <div class="button-group" style="justify-content:center; gap:10px;">
              <button type="button" id="crop-btn" class="btn-primary">Confirm & Save Crop</button>
              <button type="button" id="cancel-crop-btn" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>

        <div id="id-upload-wrapper" style="display:none;">
          <label for="idCard">Upload ID Card <span class="required">*</span></label>
          <input type="file" id="idCard" class="form-control" accept="image/*,.pdf">
          
          <!-- Cropped Preview Location -->
          <div id="id-preview-wrapper" style="display:none; margin-top:15px; text-align:center;">
            <p style="margin-bottom:5px; font-weight:600; color:#10b981;">Preview Ready ✓</p>
            <img id="id-preview-image" style="max-width:180px; border:2px solid #e2e8f0; border-radius:6px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          </div>
        </div>

      </div>

    </div>
  </div>
  `;
}

export function initAffiliation() {
  // 1. Fetch Institutes
  fetchOptions('/api/reference/institutes', 'institute', 'Search Institute');

  // 2. Fetch Designations (Subcategories)
  fetchOptions('/api/reference/categories', 'designation', 'Select Designation');

  // 3. Fetch Supervisors
  fetchOptions('/api/reference/supervisors', 'supervisorSelect', 'Select Supervisor');

  // UI Toggle Logic
  const designationSelect = document.getElementById('designation');
  const supervisorSection = document.getElementById('supervisor-section');
  const idUploadWrapper = document.getElementById('id-upload-wrapper');
  const otherInstituteWrapper = document.getElementById('other-institute-wrapper');
  const instituteSelect = document.getElementById('institute');

  if (designationSelect) {
    designationSelect.addEventListener('change', (e) => {
      const selectedText = e.target.options[e.target.selectedIndex]?.text.toLowerCase() || '';

      // Show supervisor/ID section if Student is selected
      if (selectedText.includes('student')) {
        supervisorSection.style.display = 'block';
        idUploadWrapper.style.display = 'block';
      } else {
        supervisorSection.style.display = 'none';
        idUploadWrapper.style.display = 'none';
      }
    });
  }

  if (instituteSelect) {
    instituteSelect.addEventListener('change', (e) => {
      const selectedValue = e.target.value.toLowerCase();
      if (selectedValue === 'other') {
        otherInstituteWrapper.style.display = 'block';
      } else {
        otherInstituteWrapper.style.display = 'none';
        document.getElementById('otherInstitute').value = '';
      }

      // Optional: Filter supervisors based on institute
      // fetchOptions(`/api/reference/supervisors?institute_id=${e.target.value}`, 'supervisorSelect', 'Select Supervisor');
    });
  }

  // Auto-fill supervisor email when supervisor is selected
  const supervisorSelect = document.getElementById('supervisorSelect');
  if (supervisorSelect) {
    supervisorSelect.addEventListener('change', async (e) => {
      // we need to access the email somehow. We can either embed it in data attributes during fetchOptions,
      // or fetch it. For now since fetchOptions strips data, we'll keep it simple or implement specific fetch.
    });
  }

  // --- Image Cropper Logic ---
  const idCardInput = document.getElementById('idCard');
  const cropperModal = document.getElementById('cropper-modal');
  const cropperImage = document.getElementById('cropper-image');
  const cropBtn = document.getElementById('crop-btn');
  const cancelCropBtn = document.getElementById('cancel-crop-btn');
  const idPreviewWrapper = document.getElementById('id-preview-wrapper');
  const idPreviewImage = document.getElementById('id-preview-image');
  
  let cropperInstance = null;

  if (idCardInput) {
    idCardInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        
        // PDFs cannot be cropped, just accept them natively
        if (file.type === 'application/pdf') {
           idPreviewWrapper.style.display = 'none';
           return; 
        }

        if (!file.type.startsWith('image/')) {
           window.showToast('Please upload a valid image or PDF.', 'error');
           e.target.value = '';
           return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          cropperImage.src = event.target.result;
          cropperModal.style.display = 'flex';
          
          if (cropperInstance) cropperInstance.destroy();
          cropperInstance = new Cropper(cropperImage, {
            viewMode: 1,
            dragMode: 'move',
            background: false,
            responsive: true,
          });
        };
        reader.readAsDataURL(file);
      }
    });

    cropBtn.addEventListener('click', () => {
      if (!cropperInstance) return;
      const canvas = cropperInstance.getCroppedCanvas({
        maxWidth: 1024,
        maxHeight: 1024
      });
      
      if (!canvas) {
         window.showToast('Failed to crop image.', 'error');
         return;
      }
      
      idPreviewImage.src = canvas.toDataURL('image/jpeg', 0.85);
      idPreviewWrapper.style.display = 'block';
      
      canvas.toBlob((blob) => {
        const newFile = new File([blob], 'cropped_id.jpg', { type: 'image/jpeg', lastModified: new Date().getTime() });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(newFile);
        
        // Completely overwrite the hidden input file block with our pristine cropped file
        idCardInput.files = dataTransfer.files;
        
        cropperModal.style.display = 'none';
        cropperInstance.destroy();
        cropperInstance = null;
      }, 'image/jpeg', 0.85);
    });

    cancelCropBtn.addEventListener('click', () => {
      cropperModal.style.display = 'none';
      idCardInput.value = ''; // wipe selection on cancel
      idPreviewWrapper.style.display = 'none';
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
    });
  }
}

// Helper fetch to populate dropdowns (Since it's local to this file now)
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
      opt.dataset.email = item.email || ''; // store email if exists (for supervisors)
      select.appendChild(opt);
    });

    if (selectId === 'institute') {
      const optOther = document.createElement('option');
      optOther.value = 'other';
      optOther.textContent = 'Other';
      select.appendChild(optOther);
    }

    // Event to populate email if datasets are used
    select.addEventListener('change', (e) => {
      if (selectId === 'supervisorSelect') {
        const emailInput = document.getElementById('supervisorEmail');
        const selectedOpt = select.options[select.selectedIndex];
        if (emailInput && selectedOpt) {
          emailInput.value = selectedOpt.dataset.email || '';
        }
      }
    });

    // Restore draft values purely for this field
    const stored = localStorage.getItem('registration_draft');
    if (stored) {
      try {
        const draft = JSON.parse(stored);
        if (draft[selectId]) {
          select.value = draft[selectId];
          select.dispatchEvent(new Event('change'));
        }
      } catch (e) { }
    }
  } catch (error) {
    console.error(error);
  }
}