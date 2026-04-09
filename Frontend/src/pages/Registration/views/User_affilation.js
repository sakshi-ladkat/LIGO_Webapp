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

        
        <div id="id-upload-wrapper" style="display:none;">
          <label for="idCard">Upload ID Card <span class="required">*</span></label>
          <input type="file" id="idCard" class="form-control" accept="image/*,.pdf">
        </div>

      </div>

    </div>
  </div>
  `;
}