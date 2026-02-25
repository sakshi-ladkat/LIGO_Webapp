// ── Dashboard Module ───────────────────────────────────────────────
// Handles sidebar nav, profile load, cascading request form, logout
import { initAdminPanel } from './admin-panel.js';

const API = () => window.CONFIG?.API_BASE_URL || 'http://127.0.0.1:8000';

// Read the Sanctum token stored by login.js
function getAuthToken() {
    return sessionStorage.getItem('auth_token') || '';
}

async function apiFetch(path, opts = {}) {
    const token = getAuthToken();
    if (!token) {
        // No token — send back to login
        sessionStorage.clear();
        window.location.hash = '/login';
        throw new Error('Not authenticated. Please log in.');
    }

    const res = await fetch(`${API()}${path}`, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...opts.headers,
        },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Token expired / revoked — clear session and redirect
        if (res.status === 401) {
            sessionStorage.clear();
            window.location.hash = '/login';
        }
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Global permission state (populated on mount) ──────────
let userRoles = [];       // [{ id, name, slug, level, description }]
let userPerms = new Set(); // Set of permission slugs

/**
 * Returns true if the logged-in user has the given permission slug.
 * e.g. hasPermission('approve_request')
 */
export function hasPermission(slug) {
    return userPerms.has(slug);
}

/**
 * Returns true if the user has any of the given role slugs.
 * e.g. hasRole('super_admin', 'pet_lead')
 */
export function hasRole(...slugs) {
    return userRoles.some(r => slugs.includes(r.slug));
}

/**
 * Fetch user's roles + permissions from the server and store globally.
 * Called once on dashboard mount.
 */
async function loadPermissions() {
    try {
        const data = await apiFetch('/api/auth/me');
        userRoles = data.roles || [];
        userPerms = new Set(data.permissions || []);
        console.log('[Dashboard] Roles:', userRoles.map(r => r.slug));
        console.log('[Dashboard] Permissions:', [...userPerms]);
    } catch (err) {
        console.warn('[Dashboard] Could not load permissions:', err);
    }
}

/**
 * Show/hide sidebar tabs based on the user's loaded permissions.
 * Authority roles (approve_request) see admin tabs, NOT education/affiliation/own-request.
 * Regular users see profile, education, affiliation, request.
 */
function applySidebarPermissions() {
    const isAuthority = hasPermission('approve_request') || hasPermission('view_users');

    // Tabs only for regular users
    ['education', 'affiliation', 'request'].forEach(panel => {
        const btn = document.querySelector(`.dash-tab-btn[data-panel="${panel}"]`);
        if (btn) btn.style.display = isAuthority ? 'none' : '';
    });

    // Tabs for authority roles
    const adminBtn = document.querySelector('.dash-tab-btn[data-panel="admin"]');
    if (adminBtn) adminBtn.style.display = hasPermission('view_users') ? '' : 'none';

    const rolesBtn = document.querySelector('.dash-tab-btn[data-panel="roles"]');
    if (rolesBtn) rolesBtn.style.display = hasPermission('create_role') ? '' : 'none';

    // All Requests tab — visible to anyone with approve_request (incl. superadmin)
    const allReqBtn = document.querySelector('.dash-tab-btn[data-panel="all-requests"]');
    if (allReqBtn) allReqBtn.style.display = hasPermission('approve_request') ? '' : 'none';

    // Profile always visible to everyone
    const profileBtn = document.querySelector('.dash-tab-btn[data-panel="profile"]');
    if (profileBtn) profileBtn.style.display = '';
}

// ── Mount ─────────────────────────────────────────────────
export async function mountDashboard() {
    console.log('[Dashboard] Mounting…');

    // Hide the SPA shell header/footer
    document.getElementById('app-header')?.style.setProperty('display', 'none', 'important');
    document.getElementById('app-footer')?.style.setProperty('display', 'none', 'important');

    // 1. Fetch permissions first — gates everything else
    await loadPermissions();
    applySidebarPermissions();

    setupNav();
    setupLogout();
    await loadProfile();
    await loadSystems();
    await loadEducation();
    await loadAffiliations();
    setupRequestForm();
    checkLockout();

    // 2. Conditionally initialise the admin panel
    if (hasPermission('view_users')) {
        await initAdminPanel(hasPermission, hasRole);
    }

    console.log('[Dashboard] Ready.');
}

// ── Navigation ────────────────────────────────────────────
function setupNav() {
    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const panel = btn.dataset.panel;
            document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${panel}`)?.classList.add('active');
            if (panel === 'profile') renderProfilePanel();
        });
    });
}

// ── Logout ────────────────────────────────────────────────
function setupLogout() {
    document.getElementById('dashLogoutBtn')?.addEventListener('click', async () => {
        try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch (_) { }
        sessionStorage.clear();
        // Restore the SPA shell header/footer
        document.getElementById('app-header')?.style.removeProperty('display');
        document.getElementById('app-footer')?.style.removeProperty('display');
        window.location.hash = '/login';
    });
}

// ── Profile ───────────────────────────────────────────────
let profileData = null;

async function loadProfile() {
    try {
        const data = await apiFetch('/api/dashboard/profile');
        profileData = data;
        sessionStorage.setItem('auth_user', JSON.stringify(data.user));

        const reg = data.registration || {};
        const user = data.user || {};
        const inst = data.institute || {};
        const name = [reg.first_name, reg.last_name].filter(Boolean).join(' ') || user.username || 'User';
        const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        // Top-bar user chip
        document.getElementById('dashAvatar').textContent = initials;
        document.getElementById('dashProfileName').textContent = name;
        document.getElementById('dashProfileEmail').textContent = user.email || '—';

        // Profile panel banner (populated when panel opens)
        const bannerAvatar = document.getElementById('profileAvatarLg');
        const bannerName = document.getElementById('profileBannerName');
        const bannerInst = document.getElementById('dashProfileInstitute');
        if (bannerAvatar) bannerAvatar.textContent = initials;
        if (bannerName) bannerName.textContent = name;
        if (bannerInst) bannerInst.textContent = inst.name || '—';
    } catch (err) {
        console.error('[Dashboard] Profile load failed:', err);
    }
}

function renderProfilePanel() {
    const grid = document.getElementById('profileGrid');
    if (!profileData) return;

    const reg = profileData.registration || {};
    const inst = profileData.institute || {};

    const fullName = [reg.prefix, reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(' ');
    const fullAddress = [reg.address_line1, reg.address_line2, reg.address_line3, reg.city, reg.state, reg.postal_code, reg.country].filter(Boolean).join(', ');

    const fields = [
        { label: 'Name', value: fullName },
        { label: 'Email', value: profileData.user?.email },
        { label: 'Contact', value: [reg.office_country_code, reg.office_city_code, reg.office_number].filter(Boolean).join(' ') },
        { label: 'Date of Birth', value: reg.dob },
        { label: 'Institute', value: inst.name },
        { label: 'Account Since', value: profileData.user?.created_at?.slice(0, 10) },
    ];

    if (grid) {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gap = '16px';
        grid.innerHTML = fields
            .map(f => `
                <div style="display: flex; flex-direction: column;">
                    <div style="font-size: 0.85rem; color: var(--gray-500); font-weight: 500; text-transform: uppercase;">${f.label}</div>
                    <div style="font-size: 1rem; color: var(--gray-800);">${f.value || '—'}</div>
                </div>`)
            .join('');
    }

    setupProfileEditForm(reg);
}

function setupProfileEditForm(reg) {
    const editBtn = document.getElementById('btnEditProfile');
    const cancelBtn = document.getElementById('btnCancelEditProfile');
    const form = document.getElementById('profileEditForm');
    const actions = document.getElementById('profileActions');
    const feedback = document.getElementById('profileEditFeedback');
    const inputs = form?.querySelectorAll('.form-input');

    if (!editBtn || !form) return;

    // Reset UI to view mode
    form.style.display = 'none';
    if (grid) grid.style.display = 'grid';
    editBtn.style.display = 'block';

    // Populate form with existing data
    document.getElementById('editPrefix').value = reg.prefix || '';
    document.getElementById('editFirstName').value = reg.first_name || '';
    document.getElementById('editMiddleName').value = reg.middle_name || '';
    document.getElementById('editLastName').value = reg.last_name || '';
    document.getElementById('editDob').value = reg.dob || '';
    document.getElementById('editAddress1').value = reg.address_line1 || '';
    document.getElementById('editAddress2').value = reg.address_line2 || '';
    document.getElementById('editAddress3').value = reg.address_line3 || '';
    document.getElementById('editCity').value = reg.city || '';
    document.getElementById('editState').value = reg.state || '';
    document.getElementById('editPostal').value = reg.postal_code || '';
    document.getElementById('editCountry').value = reg.country || '';

    // Show form editable
    editBtn.onclick = () => {
        if (grid) grid.style.display = 'none';
        editBtn.style.display = 'none';
        form.style.display = 'block';
        feedback.style.display = 'none';
    };

    // Hide form
    cancelBtn.onclick = () => {
        form.style.display = 'none';
        if (grid) grid.style.display = 'grid';
        editBtn.style.display = 'block';

        // Restore existing data
        document.getElementById('editPrefix').value = reg.prefix || '';
        document.getElementById('editFirstName').value = reg.first_name || '';
        document.getElementById('editMiddleName').value = reg.middle_name || '';
        document.getElementById('editLastName').value = reg.last_name || '';
        document.getElementById('editDob').value = reg.dob || '';
        document.getElementById('editAddress1').value = reg.address_line1 || '';
        document.getElementById('editAddress2').value = reg.address_line2 || '';
        document.getElementById('editAddress3').value = reg.address_line3 || '';
        document.getElementById('editCity').value = reg.city || '';
        document.getElementById('editState').value = reg.state || '';
        document.getElementById('editPostal').value = reg.postal_code || '';
        document.getElementById('editCountry').value = reg.country || '';
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btnSaveProfile');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            const body = {
                prefix: document.getElementById('editPrefix').value,
                first_name: document.getElementById('editFirstName').value,
                middle_name: document.getElementById('editMiddleName').value,
                last_name: document.getElementById('editLastName').value,
                dob: document.getElementById('editDob').value || null,
                address_line1: document.getElementById('editAddress1').value,
                address_line2: document.getElementById('editAddress2').value,
                address_line3: document.getElementById('editAddress3').value,
                city: document.getElementById('editCity').value,
                state: document.getElementById('editState').value,
                postal_code: document.getElementById('editPostal').value,
                country: document.getElementById('editCountry').value,
            };

            await apiFetch('/api/dashboard/profile', {
                method: 'PUT',
                body: JSON.stringify(body)
            });

            feedback.textContent = 'Profile updated successfully!';
            feedback.style.display = 'block';
            feedback.style.backgroundColor = 'var(--success-light)';
            feedback.style.color = 'var(--success)';

            // Reload profile data after a short delay
            setTimeout(async () => {
                await loadProfile();
                renderProfilePanel();
            }, 1000);

        } catch (err) {
            feedback.textContent = err.message || 'Failed to update profile.';
            feedback.style.display = 'block';
            feedback.style.backgroundColor = 'var(--error-light)';
            feedback.style.color = 'var(--error)';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save Changes';
        }
    };
}

// ── Systems ───────────────────────────────────────────────
let allSystems = [];

async function loadSystems() {
    const sel = document.getElementById('reqSystem');
    if (!sel) return;
    try {
        allSystems = await apiFetch('/api/dashboard/systems');
        const unique = [...new Map(allSystems.map(s => [s.name, s])).values()];
        sel.innerHTML = '<option value="">— Select a system —</option>'
            + unique.map(s =>
                `<option value="${s.name}">${s.name}${s.code ? ' (' + s.code + ')' : ''}</option>`
            ).join('');
    } catch (err) {
        sel.innerHTML = '<option value="">Error loading systems</option>';
        console.error('[Dashboard] Systems load failed:', err);
    }
}

// ── Request Form (cascading) ──────────────────────────────
function setupRequestForm() {
    const $ = id => document.getElementById(id);

    const show = id => { const el = $(id); if (el) el.classList.remove('req-step-hidden'); };
    const hide = id => { const el = $(id); if (el) el.classList.add('req-step-hidden'); };
    const reset = (sel, ph) => { sel.innerHTML = `<option value="">${ph}</option>`; };

    // Initial state setup
    ['reqSystemStep', 'reqInstituteStep', 'reqSubmitStep'].forEach(hide);

    const today = new Date().toISOString().split('T')[0];
    const elStart = $('reqStartDate');
    const elEnd = $('reqEndDate');
    if (elStart) elStart.min = today;
    if (elEnd) elEnd.min = today;

    // 1. Date selection
    const checkDates = () => {
        ['reqSystemStep', 'reqInstituteStep', 'reqSubmitStep'].forEach(hide);
        reset($('reqSystem'), '— Loading systems… —');
        reset($('reqInstitute'), '— Select institute —');

        if ($('reqStartDate').value && $('reqEndDate').value) {
            show('reqSystemStep');
            loadSystems(); // Ensure systems are populated when step is shown
        }
    };
    $('reqStartDate')?.addEventListener('change', checkDates);
    $('reqEndDate')?.addEventListener('change', checkDates);

    // 2. System Selection
    $('reqSystem')?.addEventListener('change', async () => {
        const name = $('reqSystem').value;
        reset($('reqInstitute'), '— Select institute —');
        ['reqInstituteStep', 'reqSubmitStep'].forEach(hide);
        hideFeedback();
        $('reqSystemHint').textContent = '';
        if (!name) return;

        try {
            const institutes = await apiFetch(
                `/api/dashboard/institutes-by-system?system_name=${encodeURIComponent(name)}`
            );
            if (!institutes.length) {
                $('reqSystemHint').textContent = 'No institutes found for this system.';
                return;
            }
            $('reqInstitute').innerHTML = '<option value="">— Select institute —</option>'
                + institutes.map(i => `<option value="${i.id}">${i.name}${i.city ? ' — ' + i.city : ''}</option>`).join('');
            show('reqInstituteStep');
        } catch (err) {
            $('reqSystemHint').textContent = 'Failed to load institutes.';
        }
    });

    // 3. Institute Selection
    $('reqInstitute')?.addEventListener('change', async () => {
        const iid = $('reqInstitute').value;
        ['reqServicesStep', 'reqSubmitStep'].forEach(hide);
        hideFeedback();
        if (iid) {
            show('reqServicesStep');
        }
    });

    // 4. Services Selection validation
    const checkServices = () => {
        const anyChecked = document.querySelectorAll('.req-service-cb:checked').length > 0;
        if (anyChecked) {
            show('reqSubmitStep');
        } else {
            hide('reqSubmitStep');
        }
    };
    document.querySelectorAll('.req-service-cb').forEach(cb => cb.addEventListener('change', checkServices));

    $('reqSubmitBtn')?.addEventListener('click', async () => {
        const startDate = $('reqStartDate')?.value;
        const endDate = $('reqEndDate')?.value;
        const systemName = $('reqSystem')?.value;
        const instituteId = $('reqInstitute')?.value;

        const selectedServices = Array.from(document.querySelectorAll('.req-service-cb:checked'))
            .map(cb => cb.value).join(',');

        if (!startDate || !endDate || !systemName || !instituteId || !selectedServices) {
            showFeedback('Please complete all steps (and select at least one service) before submitting.', 'error'); return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
            showFeedback('End date must be after start date.', 'error'); return;
        }

        $('reqSubmitBtn').textContent = 'Sending…';
        $('reqSubmitBtn').disabled = true;
        hideFeedback();

        try {
            const res = await apiFetch('/api/dashboard/send-request', {
                method: 'POST',
                body: JSON.stringify({
                    system_name: systemName,
                    institute_id: parseInt(instituteId),
                    services: selectedServices,
                    start_date: startDate,
                    end_date: endDate,
                }),
            });
            showFeedback(res.message || 'Request submitted successfully!', 'success');
            // Reset all
            ['reqStartDate', 'reqEndDate', 'reqSystem', 'reqInstitute'].forEach(id => { if ($(id)) $(id).value = ''; });
            document.querySelectorAll('.req-service-cb').forEach(cb => cb.checked = false);
            ['reqSystemStep', 'reqInstituteStep', 'reqServicesStep', 'reqSubmitStep'].forEach(hide);
        } catch (err) {
            showFeedback(err.message || 'Failed to submit request.', 'error');
        } finally {
            $('reqSubmitBtn').textContent = 'Submit Request for Approval';
            $('reqSubmitBtn').disabled = false;
        }
    });
}

function showFeedback(msg, type) {
    const el = document.getElementById('reqFeedback');
    if (!el) return;
    el.textContent = msg;
    el.className = `req-feedback ${type}`;
}
function hideFeedback() {
    const el = document.getElementById('reqFeedback');
    if (el) el.className = 'req-feedback';
}

// ── Education & Affiliation ───────────────────────────────
let userEducation = [];
let userAffiliation = [];

async function loadEducation() {
    try {
        userEducation = await apiFetch('/api/dashboard/education');
        renderEducation();
    } catch (e) {
        console.error('Failed to load education.', e);
    }
}

async function loadAffiliations() {
    try {
        userAffiliation = await apiFetch('/api/dashboard/affiliations');
        renderAffiliations();
    } catch (e) {
        console.error('Failed to load affiliations.', e);
    }
}

function renderEducation() {
    const list = document.getElementById('academicEntriesList');
    if (!list) return;

    if (userEducation.length === 0) {
        list.innerHTML = '';
    } else {
        list.innerHTML = userEducation.map(edu => `
        <div class="dash-card" style="margin-bottom: 1rem; position: relative; padding-bottom: 4rem;">
            <div class="profile-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); border: none; padding: 0;">
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Degree</div>
                    <div class="profile-field-value">${edu.degree_title} (${edu.degree_level})</div>
                </div>
                ${edu.specialization ? `
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Specialization</div>
                    <div class="profile-field-value">${edu.specialization}</div>
                </div>` : ''}
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Institute</div>
                    <div class="profile-field-value">${edu.institute_name} &mdash; ${edu.institute_country}</div>
                </div>
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Duration</div>
                    <div class="profile-field-value">${edu.start_date} to ${edu.end_date || 'Present'}</div>
                </div>
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Grade (${edu.grading_system})</div>
                    <div class="profile-field-value">${edu.grade_value}</div>
                </div>
            </div>
            <div style="position: absolute; bottom: 1.25rem; right: 1.25rem; display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-sm btn-primary" onclick="window.editEducation(${edu.id})">Modify</button>
                <button type="button" class="btn btn-sm btn-primary" onclick="window.removeEducation(${edu.id})">Remove</button>
            </div>
        </div>
        `).join('');
    }
    checkLockout();
}

function renderAffiliations() {
    const list = document.getElementById('affiliationEntriesList');
    if (!list) return;

    if (userAffiliation.length === 0) {
        list.innerHTML = '';
    } else {
        list.innerHTML = userAffiliation.map(aff => `
        <div class="dash-card" style="margin-bottom: 1rem; position: relative; padding-bottom: 4rem;">
            <div class="profile-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); border: none; padding: 0;">
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Position</div>
                    <div class="profile-field-value">${aff.position_role}</div>
                </div>
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Organization</div>
                    <div class="profile-field-value">${aff.affiliated_organization} &mdash; ${aff.country}</div>
                </div>
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Affiliation Type</div>
                    <div class="profile-field-value">${aff.current_affiliation}</div>
                </div>
                <div class="profile-field" style="border-bottom: none;">
                    <div class="profile-field-label">Duration</div>
                    <div class="profile-field-value">${aff.start_date} to ${aff.end_date || 'Present'}</div>
                </div>
            </div>
            <div style="position: absolute; bottom: 1.25rem; right: 1.25rem; display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-sm btn-primary" onclick="window.editAffiliation(${aff.id})">Modify</button>
                <button type="button" class="btn btn-sm btn-primary" onclick="window.removeAffiliation(${aff.id})">Remove</button>
            </div>
        </div>
        `).join('');
    }
    checkLockout();
}

function checkLockout() {
    const lockout = document.getElementById('requestLockout');
    const formWrap = document.getElementById('requestFormWrapper');
    if (!lockout || !formWrap) return;

    const hasEducation = userEducation.length > 0;
    const isStudent = profileData?.registration?.current_affiliation === 'Student' ||
        userAffiliation.some(a => a.current_affiliation === 'Student');
    const hasAffiliation = userAffiliation.length > 0;

    if (!hasEducation || (!isStudent && !hasAffiliation)) {
        lockout.style.setProperty('display', 'block', 'important');
        formWrap.style.setProperty('display', 'none', 'important');
    } else {
        lockout.style.setProperty('display', 'none', 'important');
        formWrap.style.removeProperty('display');
    }
}

window.removeEducation = async (id) => {
    if (!confirm('Are you sure you want to remove this qualification?')) return;
    try {
        await apiFetch(`/api/dashboard/education/${id}`, { method: 'DELETE' });
        await loadEducation();
    } catch (e) { alert('Failed to remove education'); }
};

window.editEducation = (id) => {
    const edu = userEducation.find(e => e.id === id);
    if (!edu) return;
    document.getElementById('academicInfoForm').dataset.editId = id; // Store ID
    document.getElementById('edu_level').value = edu.degree_level || '';
    document.getElementById('edu_title').value = edu.degree_title || '';
    document.getElementById('edu_spec').value = edu.specialization || '';
    document.getElementById('edu_inst').value = edu.institute_name || '';
    document.getElementById('instituteCountry').value = edu.institute_country || '';
    document.getElementById('edu_start').value = edu.start_date || '';
    document.getElementById('edu_end').value = edu.end_date || '';
    document.getElementById('edu_grade_sys').value = edu.grading_system || '';
    document.getElementById('edu_grade_val').value = edu.grade_value || '';
    document.getElementById('edu_current').checked = !!edu.is_current;

    document.getElementById('academicInfoForm').style.display = 'block';
    document.getElementById('btnShowEduForm').style.display = 'none';
    document.getElementById('btnAddEducationSubmit').textContent = 'Update Qualification';
};

window.removeAffiliation = async (id) => {
    if (!confirm('Are you sure you want to remove this affiliation?')) return;
    try {
        await apiFetch(`/api/dashboard/affiliations/${id}`, { method: 'DELETE' });
        await loadAffiliations();
    } catch (e) { alert('Failed to remove affiliation'); }
};

window.editAffiliation = (id) => {
    const aff = userAffiliation.find(a => a.id === id);
    if (!aff) return;
    document.getElementById('affiliationForm').dataset.editId = id; // Store ID
    document.getElementById('affil_type').value = aff.current_affiliation || '';
    document.getElementById('affil_org').value = aff.affiliated_organization || '';
    document.getElementById('affiliationCountrySelect').value = aff.country || '';
    document.getElementById('affil_role').value = aff.position_role || '';
    document.getElementById('affil_start').value = aff.start_date || '';
    document.getElementById('affil_end').value = aff.end_date || '';

    document.getElementById('affiliationForm').style.display = 'block';
    document.getElementById('btnShowAffilForm').style.display = 'none';
    document.getElementById('btnAddAffiliationSubmit').textContent = 'Update Affiliation';
};

// Toggle logic for forms
document.getElementById('btnShowEduForm')?.addEventListener('click', () => {
    document.getElementById('academicInfoForm').style.display = 'block';
    document.getElementById('btnShowEduForm').style.display = 'none';
});
document.getElementById('btnCancelEduForm')?.addEventListener('click', () => {
    document.getElementById('academicInfoForm').style.display = 'none';
    document.getElementById('btnShowEduForm').style.display = 'block';
    document.getElementById('academicInfoForm').reset();
    delete document.getElementById('academicInfoForm').dataset.editId;
    document.getElementById('btnAddEducationSubmit').textContent = 'Save Qualification';
});

document.getElementById('btnShowAffilForm')?.addEventListener('click', () => {
    document.getElementById('affiliationForm').style.display = 'block';
    document.getElementById('btnShowAffilForm').style.display = 'none';
});
document.getElementById('btnCancelAffilForm')?.addEventListener('click', () => {
    document.getElementById('affiliationForm').style.display = 'none';
    document.getElementById('btnShowAffilForm').style.display = 'block';
    document.getElementById('affiliationForm').reset();
    delete document.getElementById('affiliationForm').dataset.editId;
    document.getElementById('btnAddAffiliationSubmit').textContent = 'Save Affiliation';
});

// Forms setups
document.getElementById('academicInfoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnAddEducationSubmit');
    const feedback = document.getElementById('eduFeedback');
    btn.disabled = true; btn.textContent = 'Adding...';
    try {
        const body = {
            degree_level: document.getElementById('edu_level').value,
            degree_title: document.getElementById('edu_title').value,
            specialization: document.getElementById('edu_spec').value,
            institute_name: document.getElementById('edu_inst').value,
            institute_country: document.getElementById('instituteCountry').value,
            start_date: document.getElementById('edu_start').value,
            end_date: document.getElementById('edu_end').value || null,
            grading_system: document.getElementById('edu_grade_sys').value,
            grade_value: document.getElementById('edu_grade_val').value,
            is_current: document.getElementById('edu_current').checked ? 1 : 0
        };
        const form = document.getElementById('academicInfoForm');
        const editId = form.dataset.editId;
        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `/api/dashboard/education/${editId}` : '/api/dashboard/education';

        await apiFetch(url, { method, body: JSON.stringify(body) });
        e.target.reset();
        delete form.dataset.editId;

        feedback.style.display = 'block'; feedback.textContent = editId ? 'Updated successfully' : 'Added successfully'; feedback.className = 'req-feedback success';
        setTimeout(() => feedback.style.display = 'none', 3000);

        // Hide form, show button
        form.style.display = 'none';
        document.getElementById('btnShowEduForm').style.display = 'block';

        await loadEducation();
    } catch (err) {
        feedback.style.display = 'block'; feedback.textContent = err.message || 'Failed to add'; feedback.className = 'req-feedback error';
    } finally {
        btn.disabled = false; btn.textContent = 'Save Qualification';
    }
});

document.getElementById('affiliationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnAddAffiliationSubmit');
    const feedback = document.getElementById('affilFeedback');
    btn.disabled = true; btn.textContent = 'Adding...';
    try {
        const body = {
            current_affiliation: document.getElementById('affil_type').value,
            affiliated_organization: document.getElementById('affil_org').value,
            country: document.getElementById('affiliationCountrySelect').value,
            position_role: document.getElementById('affil_role').value,
            start_date: document.getElementById('affil_start').value,
            end_date: document.getElementById('affil_end').value || null
        };
        const form = document.getElementById('affiliationForm');
        const editId = form.dataset.editId;
        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `/api/dashboard/affiliations/${editId}` : '/api/dashboard/affiliations';

        await apiFetch(url, { method, body: JSON.stringify(body) });
        e.target.reset();
        delete form.dataset.editId;

        feedback.style.display = 'block'; feedback.textContent = editId ? 'Updated successfully' : 'Added successfully'; feedback.className = 'req-feedback success';
        setTimeout(() => feedback.style.display = 'none', 3000);

        // Hide form, show button
        form.style.display = 'none';
        document.getElementById('btnShowAffilForm').style.display = 'block';

        await loadAffiliations();
    } catch (err) {
        feedback.style.display = 'block'; feedback.textContent = err.message || 'Failed to add'; feedback.className = 'req-feedback error';
    } finally {
        btn.disabled = false; btn.textContent = 'Save Affiliation';
    }
});

// Load countries for selects
async function loadCountriesForSelects() {
    try {
        const res = await apiFetch(`/api/reference/all-countries`);
        if (Array.isArray(res)) {
            const options = '<option value="">Select Country</option>' + res.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            const sel1 = document.getElementById('instituteCountry');
            const sel2 = document.getElementById('affiliationCountrySelect');
            const sel3 = document.getElementById('editCountry');
            if (sel1) sel1.innerHTML = options;
            if (sel2) sel2.innerHTML = options;
        }
    } catch (e) {
        console.error('Failed to load countries', e);
    }
}
loadCountriesForSelects();
