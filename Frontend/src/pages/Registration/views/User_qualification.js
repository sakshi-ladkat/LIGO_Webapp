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
          placeholder="e.g. Gravitational Wave Physics">
      </div>

      <div class="input-group">
        <label for="institutionAwarded">Institution Awarded</label>
        <input type="text" id="institutionAwarded" class="form-control"
          placeholder="University or College name">
      </div>

      <div class="input-group">
        <label for="graduationYear">Year of Graduation</label>
        <input type="text" id="graduationYear" class="form-control"
          placeholder="e.g. 2022">
      </div>

      <div class="input-group full-width">
        <label for="researchInterests">Research Interests / Area of Expertise</label>
        <textarea id="researchInterests" class="form-control" rows="3"
          placeholder="Briefly describe your research interests..."></textarea>
      </div>

    </div>
  </div>
  `;
}