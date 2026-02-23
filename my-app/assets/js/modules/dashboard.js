// ── Dashboard Module ──────────────────────────────────────
// Handles sidebar nav, profile load, cascading request form, logout

const API = () => window.CONFIG?.API_BASE_URL || 'http://127.0.0.1:8000';

function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
}

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API()}${path}`, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getCookie('XSRF-TOKEN') || '',
            ...opts.headers,
        },
        credentials: 'include',
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Mount ─────────────────────────────────────────────────
export async function mountDashboard() {
    console.log('[Dashboard] Mounting…');

    // Hide global header/footer
    document.querySelector('header')?.style.setProperty('display', 'none', 'important');
    document.querySelector('footer')?.style.setProperty('display', 'none', 'important');

    setupNav();
    setupLogout();
    await loadProfile();
    await loadSystems();
    setupRequestForm();

    console.log('[Dashboard] Ready.');
}

// ── Navigation ────────────────────────────────────────────
function setupNav() {
    document.querySelectorAll('.dash-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const panel = item.dataset.panel;
            document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
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
        document.querySelector('header')?.style.removeProperty('display');
        document.querySelector('footer')?.style.removeProperty('display');
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

        document.getElementById('dashAvatar').textContent = initials;
        document.getElementById('dashProfileName').textContent = name;
        document.getElementById('dashProfileEmail').textContent = user.email || '—';
        document.getElementById('dashProfileInstitute').textContent = inst.name || '—';
    } catch (err) {
        console.error('[Dashboard] Profile load failed:', err);
    }
}

function renderProfilePanel() {
    const grid = document.getElementById('profileGrid');
    if (!grid || !profileData) return;

    const reg = profileData.registration || {};
    const inst = profileData.institute || {};

    const fields = [
        { label: 'First Name', value: reg.first_name },
        { label: 'Middle Name', value: reg.middle_name },
        { label: 'Last Name', value: reg.last_name },
        { label: 'Suffix', value: reg.suffix },
        { label: 'Email', value: profileData.user?.email },
        { label: 'Institute', value: inst.name },
        { label: 'City', value: reg.city },
        { label: 'State', value: reg.state },
        { label: 'Country', value: reg.country },
        { label: 'Postal Code', value: reg.postal_code },
        { label: 'Office Phone', value: [reg.office_country_code, reg.office_city_code, reg.office_number].filter(Boolean).join(' ') },
        { label: 'Account Since', value: profileData.user?.created_at?.slice(0, 10) },
    ];

    grid.innerHTML = fields
        .filter(f => f.value)
        .map(f => `
            <div class="profile-field">
                <div class="profile-field-label">${f.label}</div>
                <div class="profile-field-value">${f.value}</div>
            </div>`)
        .join('');
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

    const show = id => { const el = $(id); if (el) el.style.display = 'flex'; };
    const hide = id => { const el = $(id); if (el) el.style.display = 'none'; };
    const reset = (sel, ph) => { sel.innerHTML = `<option value="">${ph}</option>`; };

    $('reqSystem')?.addEventListener('change', async () => {
        const name = $('reqSystem').value;
        reset($('reqInstitute'), '— Select institute —');
        reset($('reqSubSystem'), '— Select sub-system —');
        ['reqInstituteStep', 'reqSubSystemStep', 'reqTimeStep', 'reqReasonStep', 'reqSubmitStep'].forEach(hide);
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

    $('reqInstitute')?.addEventListener('change', async () => {
        const name = $('reqSystem').value;
        const iid = $('reqInstitute').value;
        reset($('reqSubSystem'), '— Select sub-system —');
        ['reqSubSystemStep', 'reqTimeStep', 'reqReasonStep', 'reqSubmitStep'].forEach(hide);
        hideFeedback();
        if (!iid) return;

        try {
            const subs = await apiFetch(
                `/api/dashboard/sub-systems?system_name=${encodeURIComponent(name)}&institute_id=${iid}`
            );
            $('reqSubSystem').innerHTML = '<option value="">— Select sub-system —</option>'
                + subs.map(s => `<option value="${s.id}">${s.name}${s.code ? ' (' + s.code + ')' : ''}</option>`).join('');
            show('reqSubSystemStep');
        } catch (err) {
            console.error('[Dashboard] Sub-systems load failed:', err);
        }
    });

    $('reqSubSystem')?.addEventListener('change', () => {
        ['reqTimeStep', 'reqReasonStep', 'reqSubmitStep'].forEach(hide);
        if ($('reqSubSystem').value) show('reqTimeStep');
    });

    $('reqTimePeriod')?.addEventListener('change', () => {
        ['reqReasonStep', 'reqSubmitStep'].forEach(hide);
        if ($('reqTimePeriod').value) { show('reqReasonStep'); show('reqSubmitStep'); }
    });

    $('reqSubmitBtn')?.addEventListener('click', async () => {
        const systemName = $('reqSystem')?.value;
        const instituteId = $('reqInstitute')?.value;
        const subSystemId = $('reqSubSystem')?.value;
        const timePeriod = $('reqTimePeriod')?.value;

        if (!systemName || !instituteId || !subSystemId || !timePeriod) {
            showFeedback('Please complete all steps before submitting.', 'error'); return;
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
                    sub_system_id: parseInt(subSystemId),
                    time_period: timePeriod,
                    reason: $('reqReason')?.value || '',
                }),
            });
            showFeedback(res.message || 'Request submitted!', 'success');
            // Reset all
            ['reqSystem', 'reqInstitute', 'reqSubSystem', 'reqTimePeriod'].forEach(id => { if ($(id)) $(id).value = ''; });
            if ($('reqReason')) $('reqReason').value = '';
            ['reqInstituteStep', 'reqSubSystemStep', 'reqTimeStep', 'reqReasonStep', 'reqSubmitStep'].forEach(hide);
        } catch (err) {
            showFeedback(err.message || 'Failed to submit request.', 'error');
        } finally {
            $('reqSubmitBtn').textContent = 'Send Request →';
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
