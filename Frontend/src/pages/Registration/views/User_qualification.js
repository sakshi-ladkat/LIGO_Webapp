export function User_education() {
  return `
  <div class="form-view" data-view="3">

    <div class="view-header">
      <h2>Qualification Details</h2>
      <p>Provide your academic and professional qualifications</p>
    </div>

    <div class="form-grid">

      <div class="input-group full-width">
        <label for="highestDegree">Highest Degree / Qualification <span class="required">*</span></label>
        <input type="text" id="highestDegree" class="form-control" placeholder="Master's Degree">
      </div>

      <div class="input-group full-width">
        <label for="fieldOfStudy">Field of Study / Specialization <span class="required">*</span></label>
        <input type="text" id="fieldOfStudy" class="form-control"
          placeholder="write your specialization subject">
      </div>

      <div class="input-group">
        <label for="institutionAwarded">Institution Awarded</label>
        <input type="text" id="institutionAwarded" class="form-control"
          placeholder="University or College name">
      </div>

      <div class="input-group">
        <label for="graduationMonth">Month of Graduation <span class="required">*</span></label>
        <select id="graduationMonth" class="form-control">
            <option value="" disabled selected>-- Select Month --</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
        </select>
      </div>

      <div class="input-group">
        <label for="graduationYear">Year of Graduation <span class="required">*</span></label>
        <input type="number" id="graduationYear" class="form-control"
          placeholder="e.g. 2020" min="${new Date().getFullYear() - 70}" max="2100">
      </div>

      <div class="input-group">
        <label for="researchInterests">Research Interests / Area of Expertise</label>
        <input type="text" id="researchInterests" class="form-control"
          placeholder="Briefly describe your research interests...">
      </div>

    </div>
  </div>
  `;
}