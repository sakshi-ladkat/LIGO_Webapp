export function User_profile() {
  return `
  <div class="form-view" data-view="2">

    <div class="view-header">
      <h2>Personal Information</h2>
      <p>Please provide your full name and basic details</p>
    </div>

    <div class="form-grid">

      <div class="input-group">
        <label for="title">Salutation <span class="required">*</span></label>
        <select id="title" class="form-control">
          <option value="" disabled selected>-- Select Salutation --</option>
        </select>
      </div>

      <div class="input-group">
        <label for="firstName">First Name <span class="required">*</span></label>
        <input type="text" id="firstName" class="form-control" required minlength="2" maxlength="50" pattern="[A-Za-z]+" title="Alphabets only. No spaces allowed." oninput="this.value = this.value.replace(/[^A-Za-z]/g, '')">
      </div>

      <div class="input-group">
        <label for="middleName">Middle Name</label>
        <input type="text" id="middleName" class="form-control" minlength="2" maxlength="50" pattern="[A-Za-z]+" title="Alphabets only. No spaces allowed." oninput="this.value = this.value.replace(/[^A-Za-z]/g, '')">
      </div>

      <div class="input-group">
        <label for="lastName">Last Name <span class="required">*</span></label>
        <input type="text" id="lastName" class="form-control" required minlength="2" maxlength="50" pattern="[A-Za-z]+" title="Alphabets only. No spaces allowed." oninput="this.value = this.value.replace(/[^A-Za-z]/g, '')">
      </div>

      <div class="input-group">
        <label for="dob">Date of Birth <span class="required">*</span></label>
        <input type="date" id="dob" class="form-control">
      </div>

      <div class="input-group">
        <label for="gender">Gender <span class="required">*</span></label>
        <select id="gender" class="form-control">
          <option value="" disabled selected>-- Select --</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
      </div>

    </div>
  </div>
  `;
}