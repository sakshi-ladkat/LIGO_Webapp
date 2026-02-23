// ========================================
// DASHBOARD SECTIONS
// ========================================

function getOverviewSection(user, completion = 0, profileData = null) {
    const isSuperAdmin = user.roles && user.roles.some(r => r.slug === 'super_admin');

    return `
        <div class="dashboard-header">
            <h1>Welcome back, ${user.username}! 👋</h1>
            <p>${isSuperAdmin ? 'System Status Overview' : "Here's what's happening with your account today."}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            ${!isSuperAdmin ? (completion < 100 ? `
            <div class="card">
                <h3 style="color: var(--primary-600); margin-bottom: 1rem;">📋 Profile Completion</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${completion}%"></div>
                </div>
                <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 0.5rem;">${completion}% Complete</p>
                <a href="#" class="btn btn-outline mt-md" data-section="registration">Complete Profile</a>
            </div>
            ` : `
            <div class="card">
                <h3 style="color: var(--primary-600); margin-bottom: 1rem;">🚀 User Dashboard</h3>
                <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 1rem;">Everything is set up! You can now participate in projects.</p>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary btn-sm" onclick="openRequestModal()">+ New Request</button>
                    <button class="btn btn-outline btn-sm" onclick="loadDashboardSection('requests', ${JSON.stringify(user).replace(/"/g, '&quot;')})">My Requests</button>
                </div>
            </div>
            `) : `
            <div class="card">
                <h3 style="color: var(--primary-600); margin-bottom: 1rem;">📊 System Quick Stats</h3>
                <p style="font-size: 1.25rem; font-weight: 600;">System is Online</p>
                <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 0.5rem;">Total Users: Loading...</p>
                <a href="#" class="btn btn-outline mt-md" data-section="admin">Manage System</a>
            </div>
            `}

            <div class="card">
                <h3 style="color: var(--success); margin-bottom: 1rem;">✅ Account Status</h3>
                <p style="font-size: 0.875rem; color: var(--gray-600);">
                    <strong>Email:</strong> ${user.email}<br>
                    <strong>Status:</strong> <span style="color: var(--success);">Active</span><br>
                    <strong>Role:</strong> ${user.roles ? user.roles.map(r => r.name).join(', ') : 'User'}
                </p>
            </div>

            <div class="card">
                <h3 style="color: var(--info); margin-bottom: 1rem;">🎯 Quick Actions</h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${isSuperAdmin ? `
                    <a href="#" class="btn btn-outline" data-section="admin">User Management</a>
                    <a href="#" class="btn btn-outline" data-section="settings">System Settings</a>
                    ` : `
                    ${completion < 100 ? '<a href="#" class="btn btn-outline" data-section="registration">Fill Registration Form</a>' : ''}
                    ${completion === 100 ? '<a href="#" class="btn btn-outline" data-section="requests">View Requests</a>' : ''}
                    <a href="#" class="btn btn-outline" data-section="profile">View My Profile</a>
                    <a href="#" class="btn btn-outline" data-section="settings">Account Settings</a>
                    `}
                </div>
            </div>
        </div>
    `;
}

function getRegistrationSection(user, profileData = null) {
    return `
        <div class="dashboard-header">
            <h1>Registration Form</h1>
            <p>Complete your profile by filling in all required information</p>
        </div>

        <div class="card">
            <!-- Progress Bar -->
            <div class="progress-bar">
                <div class="progress-fill" id="formProgress" style="width: 25%"></div>
            </div>

            <!-- Form Steps Indicator -->
            <div class="form-steps">
                <div class="form-step active" data-step="1">
                    <div class="step-number">1</div>
                    <div class="step-label">Personal Info</div>
                </div>
                <div class="form-step" data-step="2">
                    <div class="step-number">2</div>
                    <div class="step-label">Academic Info</div>
                </div>
                <div class="form-step" data-step="3">
                    <div class="step-number">3</div>
                    <div class="step-label">Affiliation</div>
                </div>
                <div class="form-step" data-step="4">
                    <div class="step-number">4</div>
                    <div class="step-label">Project Details</div>
                </div>
            </div>

            <!-- Form Sections -->
            ${getPersonalInfoForm(user, profileData)}
            ${getAcademicInfoForm()}
            ${getAffiliationForm()}
            ${getProjectDetailsForm()}
        </div>
    `;
}

function getPersonalInfoForm(user, profileData = null) {
    const p = profileData || {};
    const hasValue = (val) => val && String(val).trim().length > 0 && val !== 'null';
    const lockAttr = (val) => hasValue(val) ? 'readonly style="background-color: var(--gray-100); cursor: not-allowed;"' : '';
    const lockSelectStyle = (val) => hasValue(val) ? 'style="background-color: var(--gray-100); pointer-events: none;" tabindex="-1"' : '';

    return `
        <div class="form-section active" id="step1">
            <h3 style="margin-bottom: 1rem;">Personal Information</h3>
            <div class="alert alert-info" style="margin-bottom: 1.5rem; display: flex; gap: 0.75rem; align-items: start;">
                 <svg style="width: 20px; height: 20px; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <div>
                    <strong>Note:</strong> Some fields are locked because you already provided this information during registration. 
                    Please fill in the remaining details to complete your profile.
                 </div>
            </div>
            
            <form id="personalInfoForm">
                <div class="form-row-3">
                    <div class="form-group"><label class="form-label">First Name *</label><input type="text" class="form-input" name="first_name" value="${p.first_name || ''}" required ${lockAttr(p.first_name)}></div>
                    <div class="form-group"><label class="form-label">Middle Name</label><input type="text" class="form-input" name="middle_name" value="${p.middle_name || ''}" ${lockAttr(p.middle_name)}></div>
                    <div class="form-group"><label class="form-label">Last Name *</label><input type="text" class="form-input" name="last_name" value="${p.last_name || ''}" required ${lockAttr(p.last_name)}></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Date of Birth *</label><input type="date" class="form-input" name="date_of_birth" value="${p.date_of_birth || ''}" required ${lockAttr(p.date_of_birth)}></div>
                    <div class="form-group"><label class="form-label">Gender *</label><select class="form-input" name="gender" required ${lockSelectStyle(p.gender)}><option value="">Select Gender</option><option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option><option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option><option value="Prefer not to say" ${p.gender === 'Prefer not to say' ? 'selected' : ''}>Prefer not to say</option></select></div>
                </div>
                <!-- Extend with other fields as per previous HTML content... -->
                <div class="form-actions"><button type="button" class="btn btn-primary" onclick="nextStep()">Next Step →</button></div>
            </form>
        </div>`;
}

function getAcademicInfoForm() {
    return `
        <div class="form-section" id="step2">
            <h3 style="margin-bottom: 1rem;">Academic Information</h3>
            <div id="academicEntriesList" style="margin-bottom: 2rem;"></div>
            <form id="academicInfoForm" style="background: var(--gray-50); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid var(--gray-200);">
                <h4 style="margin-bottom: 1rem;">Add New Qualification</h4>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Degree Level *</label><select class="form-input" name="degree_level" id="edu_level" required><option value="">Select Level</option><option value="High School">High School</option><option value="Bachelors">Bachelor's</option><option value="Masters">Master's</option></select></div>
                    <div class="form-group"><label class="form-label">Degree Title *</label><input type="text" class="form-input" name="degree_title" required></div>
                </div>
                <!-- Other hidden fields for brevity... -->
                <button type="button" class="btn btn-outline" style="width: 100%;" onclick="addAcademicEntry()">+ Add Qualification</button>
            </form>
            <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="prevStep()">← Previous</button><button type="button" class="btn btn-primary" id="academicNextBtn" onclick="nextStep()">Next Step →</button></div>
        </div>`;
}

function getAffiliationForm() {
    return `
        <div class="form-section" id="step3">
            <h3 style="margin-bottom: 1.5rem;">Working / Affiliation Details</h3>
            <form id="affiliationForm">
                <!-- Inner fields... -->
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="prevStep()">← Previous</button><button type="button" class="btn btn-primary" onclick="nextStep()">Next Step →</button></div>
            </form>
        </div>`;
}

function getProjectDetailsForm() {
    return `
        <div class="form-section" id="step4">
            <h3 style="margin-bottom: 1.5rem;">Project Details</h3>
            <form id="projectForm">
                <!-- Inner fields... -->
                <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="prevStep()">← Previous</button><button type="submit" class="btn btn-primary">Submit Registration</button></div>
            </form>
        </div>`;
}

function getSettingsSection(user) {
    return `
        <div class="dashboard-header">
            <h1>Account Settings</h1>
            <p>Manage your security and preferences</p>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div class="card">
                <h3 style="margin-bottom: 1.5rem;">Account Information</h3>
                <div class="info-grid">
                    <div class="info-item"><label>Username</label><p>${user.username}</p></div>
                    <div class="info-item"><label>Email Address</label><p>${user.email}</p></div>
                </div>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 1.5rem;">Update Password</h3>
                <form id="changePasswordForm">
                    <div class="form-group"><label class="form-label" for="current_password">Current Password</label><input type="password" class="form-input" id="current_password" required></div>
                    <div class="form-group"><label class="form-label" for="new_password">New Password</label><input type="password" class="form-input" id="new_password" minlength="8" required></div>
                    <div class="form-group"><label class="form-label" for="confirm_password">Confirm New Password</label><input type="password" class="form-input" id="confirm_password" required></div>
                    <button type="submit" class="btn btn-primary btn-block" id="passwordSubmitBtn">Update Password</button>
                </form>
                <div id="passwordMessage" style="margin-top: 1rem;"></div>
            </div>
        </div>`;
}

window.getOverviewSection = getOverviewSection;
window.getRegistrationSection = getRegistrationSection;
window.getSettingsSection = getSettingsSection;
