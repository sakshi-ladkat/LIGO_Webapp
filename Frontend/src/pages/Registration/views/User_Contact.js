export function User_Contact() {
    return `
  <div class="form-view" data-view="4">

    <div class="view-header">
      <h2>Contact Information</h2>
      <p>Provide your address and phone details</p>
    </div>

    <div class="form-grid">

      <div class="input-group">
        <label for="continent">Continent <span class="required">*</span></label>
        <select id="continent" class="form-control">
          <option value="" disabled selected>-- Select Continent --</option>
        </select>
      </div>

      <div class="input-group">
        <label for="country">Country <span class="required">*</span></label>
        <select id="country" class="form-control">
          <option value="" disabled selected>-- Select Continent First --</option>
        </select>
      </div>

      <div class="input-group full-width">
        <label for="address1">Address Line 1 <span class="required">*</span></label>
        <input type="text" id="address1" class="form-control">
      </div>

      <div class="input-group">
        <label for="address2">Address Line 2</label>
        <input type="text" id="address2" class="form-control">
      </div>

      <div class="input-group">
        <label for="address3">Address Line 3</label>
        <input type="text" id="address3" class="form-control">
      </div>

      <div class="input-group">
        <label for="city">City <span class="required">*</span></label>
        <input type="text" id="city" class="form-control">
      </div>

      <div class="input-group">
        <label for="state">State / Province <span class="required">*</span></label>
        <input type="text" id="state" class="form-control">
      </div>

      <div class="input-group">
        <label for="zipcode">Postal Code <span class="required">*</span></label>
        <input type="text" id="zipcode" class="form-control">
      </div>

      <!-- Phone Section -->
      <div class="input-group full-width phone-section">
        <div class="phone-header">Office Phone Number</div>

        <div class="phone-inputs row">
          <div class="col ratio-1">
            <label for="phoneCode">Code <span class="required">*</span></label>
            <input type="text" id="phoneCode" class="form-control" placeholder="+1">
          </div>

          <div class="col ratio-1">
            <label for="cityCode">City Code</label>
            <input type="text" id="cityCode" class="form-control" placeholder="212">
          </div>

          <div class="col ratio-3">
            <label for="phoneNumber">Number <span class="required">*</span></label>
            <input type="text" id="phoneNumber" class="form-control" placeholder="555-1234">
          </div>
        </div>
      </div>

      <div class="input-group full-width">
        <label for="faxNumber">Fax Number</label>
        <input type="text" id="faxNumber" class="form-control" placeholder="Optional">
      </div>

    </div>
  </div>
  `;
}