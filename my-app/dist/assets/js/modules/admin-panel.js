// ── Admin Panel Module ─────────────────────────────────────────────────────────
// Handles: User Management, All Requests (approve/reject), Role Management panels.
// Initialised from dashboard.js after permissions are confirmed.

const API = () => window.CONFIG?.API_BASE_URL || 'http://127.0.0.1:8000';
const getToken = () => sessionStorage.getItem('auth_token') || '';

async function adminFetch(path, opts = {}) {
    const res = await fetch(`${API()}${path}`, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
            ...opts.headers,
        },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Module State ──────────────────────────────────────────────────────────────
let adminCurrentPage = 1;
let allReqCurrentPage = 1;
let allReqCurrentStatus = '';
let assignableRoles = [];
let availableSystems = [];
let modalTargetUser = null;

// ── Public initialiser ────────────────────────────────────────────────────────
export async function initAdminPanel(hasPermissionFn, hasRoleFn) {
    // Load reference data in parallel
    const [rolesRes, systemsRes] = await Promise.allSettled([
        adminFetch('/api/admin/roles'),
        adminFetch('/api/admin/systems'),
    ]);
    assignableRoles = rolesRes.status === 'fulfilled' ? rolesRes.value : [];
    availableSystems = systemsRes.status === 'fulfilled' ? systemsRes.value : [];

    // User Management panel
    if (hasPermissionFn('view_users')) {
        await loadInstituteFilter();
        setupAdminSearch();
        await loadAdminUsers(1);
        setupRoleModal();
    }

    // All Requests panel
    if (hasPermissionFn('approve_request')) {
        setupRequestFilters();
        await loadAllRequests(1, '');
    }

    // Role Management panel
    if (hasRoleFn('super_admin')) {
        document.getElementById('createRoleCard').style.display = 'block';
        setupCreateRoleForm();
    }
    if (hasPermissionFn('view_all_reports') || hasRoleFn('super_admin')) {
        await loadRolesTable();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
async function loadInstituteFilter() {
    try {
        const institutes = await adminFetch('/api/admin/institutes');
        const sel = document.getElementById('adminInstituteFilter');
        if (sel) {
            institutes.forEach(i => {
                const o = document.createElement('option');
                o.value = i.id; o.textContent = i.name;
                sel.appendChild(o);
            });
        }
    } catch { /* silent */ }

    // Populate Role dropdown from assignable roles
    const roleSel = document.getElementById('adminRoleFilter');
    if (roleSel && assignableRoles.length) {
        assignableRoles.forEach(r => {
            const o = document.createElement('option');
            o.value = r.slug; o.textContent = r.name;
            roleSel.appendChild(o);
        });
    }

    // Populate System dropdown
    const sysSel = document.getElementById('adminSystemFilter');
    const subSysSel = document.getElementById('adminSubsystemFilter');
    if (sysSel && availableSystems.length) {
        availableSystems.forEach(s => {
            const o = document.createElement('option');
            o.value = s.name; o.textContent = s.name;
            sysSel.appendChild(o);
        });
    }

    // Cascade: change system → repopulate subsystems
    sysSel?.addEventListener('change', async () => {
        if (!subSysSel) return;
        subSysSel.innerHTML = '<option value="">— All Subsystems —</option>';
        const sysName = sysSel.value;
        if (!sysName) return;
        try {
            const sys = availableSystems.find(s => s.name === sysName);
            if (!sys) return;
            const subs = await adminFetch(`/api/admin/subsystems?system_id=${sys.id}`);
            subs.forEach(sub => {
                const o = document.createElement('option');
                o.value = sub.name; o.textContent = sub.name;
                subSysSel.appendChild(o);
            });
        } catch { /* silent */ }
    });
}

function setupAdminSearch() {
    document.getElementById('adminSearchBtn')?.addEventListener('click', () => { adminCurrentPage = 1; loadAdminUsers(1); });
    document.getElementById('adminSearchInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') { adminCurrentPage = 1; loadAdminUsers(1); } });
}

async function loadAdminUsers(page = 1) {
    adminCurrentPage = page;
    const tbody = document.getElementById('adminUsersBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--gray-400);">Loading…</td></tr>`;

    const search = document.getElementById('adminSearchInput')?.value || '';
    const inst = document.getElementById('adminInstituteFilter')?.value || '';
    const roleSl = document.getElementById('adminRoleFilter')?.value || '';
    const sysName = document.getElementById('adminSystemFilter')?.value || '';
    const subSysName = document.getElementById('adminSubsystemFilter')?.value || '';
    const params = new URLSearchParams({ page });
    if (search) params.set('search', search);
    if (inst) params.set('institute_id', inst);
    if (roleSl) params.set('role_slug', roleSl);
    if (sysName) params.set('system_name', sysName);
    if (subSysName) params.set('sub_system_name', subSysName);

    try {
        const data = await adminFetch(`/api/admin/users?${params}`);
        renderUsersTable(data);
        renderPagination('adminPagination', data.current_page, data.last_page, (p) => loadAdminUsers(p));
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--danger);">${e.message}</td></tr>`;
    }
}

function renderUsersTable(data) {
    const tbody = document.getElementById('adminUsersBody');
    if (!data.data.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--gray-400);">No users found.</td></tr>`;
        return;
    }
    tbody.innerHTML = data.data.map(u => {
        const name = u.full_name || u.username;
        const roles = u.roles.length
            ? u.roles.map(r => {
                let badgeTxt = r.name;
                if (r.system_name) badgeTxt += ` <span style="font-size:0.75rem;opacity:0.8;">(${r.system_name})</span>`;
                else if (r.sub_system_name) badgeTxt += ` <span style="font-size:0.75rem;opacity:0.8;">(${r.sub_system_name})</span>`;
                return `<span class="role-badge">${badgeTxt}</span>`;
            }).join(' ')
            : `<span style="color:var(--gray-400);font-size:0.82rem;">No role</span>`;
        return `<tr class="admin-table-row">
            <td style="padding:12px 16px;font-weight:500;">${name}</td>
            <td style="padding:12px 16px;color:var(--gray-600);font-size:0.9rem;">${u.email}</td>
            <td style="padding:12px 16px;color:var(--gray-500);font-size:0.88rem;">${u.institute || '—'}</td>
            <td style="padding:12px 16px;">${roles}</td>
            <td style="padding:12px 16px;color:var(--gray-400);font-size:0.82rem;">${u.created_at || '—'}</td>
            <td style="padding:12px 16px;text-align:center;">
                <button class="btn btn-sm btn-primary" onclick="window.openRoleModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Assign Role</button>
            </td>
        </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL ACCESS REQUESTS
// ─────────────────────────────────────────────────────────────────────────────
function setupRequestFilters() {
    document.querySelectorAll('.req-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.req-filter-btn').forEach(b => {
                b.style.background = '#fff';
                b.style.color = 'var(--gray-700)';
                b.style.border = '1px solid var(--gray-300)';
                b.style.fontWeight = 'normal';
            });
            btn.style.background = 'var(--primary)';
            btn.style.color = '#fff';
            btn.style.border = '1px solid var(--primary)';
            btn.style.fontWeight = '600';
            allReqCurrentStatus = btn.dataset.status;
            allReqCurrentPage = 1;
            loadAllRequests(1, allReqCurrentStatus);
        });
    });
}

async function loadAllRequests(page = 1, status = '') {
    allReqCurrentPage = page;
    allReqCurrentStatus = status;
    const tbody = document.getElementById('allRequestsBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--gray-400);">Loading…</td></tr>`;

    const params = new URLSearchParams({ page });
    if (status) params.set('status', status);

    try {
        const data = await adminFetch(`/api/admin/requests?${params}`);
        renderRequestsTable(data);
        renderPagination('allRequestsPagination', data.current_page, data.last_page, (p) => loadAllRequests(p, allReqCurrentStatus));
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--danger);">${e.message}</td></tr>`;
    }
}

const STATUS_BADGE = {
    pending: { bg: '#fff3cd', color: '#856404', label: 'Pending' },
    approved: { bg: '#d1e7dd', color: '#0a3622', label: 'Approved' },
    rejected: { bg: '#f8d7da', color: '#842029', label: 'Rejected' },
};

function renderRequestsTable(data) {
    const tbody = document.getElementById('allRequestsBody');
    if (!data.data.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--gray-400);">No requests found.</td></tr>`;
        return;
    }
    tbody.innerHTML = data.data.map(r => {
        const s = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
        const badge = `<span style="background:${s.bg};color:${s.color};border-radius:999px;padding:3px 12px;font-size:0.8rem;font-weight:600;">${s.label}</span>`;
        const actions = r.status === 'pending'
            ? `<div style="display:flex;gap:6px;justify-content:center;">
                 <button class="btn btn-sm btn-primary" onclick="window.adminApproveReq(${r.id}, this)">Approve</button>
                 <button class="btn btn-sm" style="background:#dc3545;color:#fff;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:0.82rem;font-weight:600;" onclick="window.adminRejectReq(${r.id}, this)">Reject</button>
               </div>`
            : `<span style="color:var(--gray-400);font-size:0.82rem;">By ${r.approved_by || '—'}</span>`;
        return `<tr class="admin-table-row">
            <td style="padding:12px 16px;font-weight:500;">${r.applicant || r.email}</td>
            <td style="padding:12px 16px;color:var(--gray-700);">${r.system_name || '—'}</td>
            <td style="padding:12px 16px;color:var(--gray-600);font-size:0.88rem;">${r.institute || '—'}</td>
            <td style="padding:12px 16px;font-size:0.85rem;color:var(--gray-600);">${r.services || '—'}</td>
            <td style="padding:12px 16px;font-size:0.82rem;color:var(--gray-500);">${r.start_date || '—'} → ${r.end_date || '—'}</td>
            <td style="padding:12px 16px;text-align:center;">${badge}</td>
            <td style="padding:12px 16px;text-align:center;">${actions}</td>
        </tr>`;
    }).join('');
}

window.adminApproveReq = async (id, btn) => {
    btn.disabled = true; btn.textContent = '…';
    try {
        await adminFetch(`/api/admin/requests/${id}/approve`, { method: 'POST' });
        loadAllRequests(allReqCurrentPage, allReqCurrentStatus);
    } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = 'Approve'; }
};

window.adminRejectReq = async (id, btn) => {
    if (!confirm('Reject this request?')) return;
    btn.disabled = true; btn.textContent = '…';
    try {
        await adminFetch(`/api/admin/requests/${id}/reject`, { method: 'POST' });
        loadAllRequests(allReqCurrentPage, allReqCurrentStatus);
    } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = 'Reject'; }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ASSIGNMENT MODAL
// ─────────────────────────────────────────────────────────────────────────────
function setupRoleModal() {
    const modal = document.getElementById('roleAssignModal');
    const modalSelect = document.getElementById('roleModalSelect');
    const sysWrap = document.getElementById('roleModalSystemWrap');
    const subsysWrap = document.getElementById('roleModalSubsystemWrap');
    const sysSelect = document.getElementById('roleModalSystem');
    const subsysSelect = document.getElementById('roleModalSubsystem');
    const assignBtn = document.getElementById('btnAssignRole');

    const close = () => {
        modal.style.display = 'none';
        modalTargetUser = null;
        document.getElementById('roleModalFeedback').style.display = 'none';
        sysWrap.style.display = 'none';
        subsysWrap.style.display = 'none';
    };
    document.getElementById('closeRoleModal')?.addEventListener('click', close);
    document.getElementById('closeRoleModal2')?.addEventListener('click', close);
    modal?.addEventListener('click', e => { if (e.target === modal) close(); });

    // Populate role dropdown
    modalSelect.innerHTML = '<option value="">— Select role to assign —</option>';
    assignableRoles.forEach(r => {
        const o = document.createElement('option');
        o.value = r.id;
        o.dataset.slug = r.slug;
        o.textContent = `${r.name} (level ${r.level})`;
        modalSelect.appendChild(o);
    });

    // System dropdown will be populated dynamically when a system role is chosen.

    // Show/hide system & sub-system dropdowns based on selected role
    modalSelect.addEventListener('change', async () => {
        const chosen = modalSelect.options[modalSelect.selectedIndex];
        const slug = chosen?.dataset.slug || '';
        sysWrap.style.display = (slug === 'system_lead' || slug === 'subsystem_lead') ? 'block' : 'none';
        subsysWrap.style.display = slug === 'subsystem_lead' ? 'block' : 'none';
        subsysSelect.innerHTML = '<option value="">— Select sub-system —</option>';

        // Dynamically fetch and populate systems when needed, filtered by user's institute
        if (slug === 'system_lead' || slug === 'subsystem_lead') {
            sysSelect.innerHTML = '<option value="">Loading systems...</option>';
            try {
                const url = modalTargetUser?.institute_id
                    ? `/api/admin/systems?institute_id=${modalTargetUser.institute_id}`
                    : '/api/admin/systems';
                const systems = await adminFetch(url);
                sysSelect.innerHTML = '<option value="">— Select system —</option>';
                systems.forEach(s => {
                    const o = document.createElement('option');
                    o.value = s.id; o.textContent = s.name;
                    sysSelect.appendChild(o);
                });
            } catch {
                sysSelect.innerHTML = '<option value="">Failed to load systems</option>';
            }
        }

        // Populate sub-systems when system is selected
        if (slug === 'subsystem_lead') {
            sysSelect.onchange = async () => {
                const sid = sysSelect.value;
                if (!sid) return;
                try {
                    const subs = await adminFetch(`/api/admin/subsystems?system_id=${sid}`);
                    subsysSelect.innerHTML = '<option value="">— Select sub-system —</option>';
                    subs.forEach(s => {
                        const o = document.createElement('option');
                        o.value = s.id; o.textContent = s.name;
                        subsysSelect.appendChild(o);
                    });
                } catch { /* silent */ }
            };
        }
    });

    assignBtn?.addEventListener('click', async () => {
        if (!modalTargetUser) return;
        const roleId = parseInt(modalSelect.value);
        if (!roleId) { showModalFeedback('Please select a role.', 'error'); return; }

        assignBtn.disabled = true; assignBtn.textContent = 'Assigning…';
        try {
            const payload = { user_id: modalTargetUser.id, role_id: roleId };

            // If the role requires a system assignment
            const sysId = parseInt(sysSelect.value);
            if (sysWrap.style.display !== 'none' && sysId) {
                payload.system_id = sysId;
            }

            // If the role requires a sub-system assignment 
            const subSysId = parseInt(subsysSelect.value);
            if (subsysWrap.style.display !== 'none' && subSysId) {
                payload.sub_system_id = subSysId;
            }

            const res = await adminFetch('/api/admin/assign-role', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            showModalFeedback(res.message, 'success');
            modalTargetUser.roles.push(res.role);
            renderCurrentRoles();
            loadAdminUsers(adminCurrentPage);
        } catch (e) {
            showModalFeedback(e.message, 'error');
        } finally {
            assignBtn.disabled = false; assignBtn.textContent = 'Assign';
        }
    });
}

function renderCurrentRoles() {
    const wrap = document.getElementById('roleModalCurrentRoles');
    if (!wrap || !modalTargetUser) return;
    if (!modalTargetUser.roles.length) {
        wrap.innerHTML = `<span style="color:var(--gray-400);font-size:0.85rem;">No roles assigned yet.</span>`;
        return;
    }
    wrap.innerHTML = modalTargetUser.roles.map(r =>
        `<span class="role-badge" style="display:inline-flex;align-items:center;gap:4px;">
            ${r.name}
            <button onclick="window.removeRoleFromModal(${r.id})" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:0.9rem;line-height:1;">&times;</button>
        </span>`
    ).join('');
}

window.removeRoleFromModal = async (roleId) => {
    if (!modalTargetUser) return;
    try {
        const res = await adminFetch('/api/admin/assign-role', {
            method: 'DELETE',
            body: JSON.stringify({ user_id: modalTargetUser.id, role_id: roleId }),
        });
        modalTargetUser.roles = modalTargetUser.roles.filter(r => r.id !== roleId);
        renderCurrentRoles();
        showModalFeedback(res.message, 'success');
        loadAdminUsers(adminCurrentPage);
    } catch (e) { showModalFeedback(e.message, 'error'); }
};

window.openRoleModal = (user) => {
    modalTargetUser = typeof user === 'string' ? JSON.parse(user) : user;
    document.getElementById('roleModalUser').innerHTML =
        `<strong>${modalTargetUser.full_name || modalTargetUser.username}</strong><br>
         <span style="color:var(--gray-500);font-size:0.88rem;">${modalTargetUser.email}${modalTargetUser.institute ? ' — ' + modalTargetUser.institute : ''}</span>`;
    renderCurrentRoles();
    document.getElementById('roleModalFeedback').style.display = 'none';
    document.getElementById('roleModalSelect').value = '';
    document.getElementById('roleModalSystemWrap').style.display = 'none';
    document.getElementById('roleModalSubsystemWrap').style.display = 'none';
    const modal = document.getElementById('roleAssignModal');
    modal.style.display = 'flex';
};

function showModalFeedback(msg, type) {
    const el = document.getElementById('roleModalFeedback');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.background = type === 'success' ? '#f0fff4' : '#fff5f5';
    el.style.color = type === 'success' ? '#38a169' : '#e53e3e';
    el.style.border = `1px solid ${type === 'success' ? '#38a169' : '#e53e3e'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES TABLE
// ─────────────────────────────────────────────────────────────────────────────
async function loadRolesTable() {
    const tbody = document.getElementById('rolesTableBody');
    if (!tbody) return;
    try {
        const roles = await adminFetch('/api/admin/all-roles');
        tbody.innerHTML = roles.map(r => `
            <tr class="admin-table-row">
                <td style="padding:12px 16px;font-weight:500;">${r.name}</td>
                <td style="padding:12px 16px;font-family:monospace;font-size:0.85rem;color:var(--gray-600);">${r.slug}</td>
                <td style="padding:12px 16px;text-align:center;"><span style="background:var(--gray-100);border-radius:999px;padding:3px 12px;font-size:0.82rem;font-weight:600;">${r.level}</span></td>
                <td style="padding:12px 16px;color:var(--gray-600);">${r.description || '—'}</td>
                <td style="padding:12px 16px;text-align:center;font-weight:600;">${r.users_count ?? '—'}</td>
            </tr>`).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--danger);">${e.message}</td></tr>`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ROLE FORM
// ─────────────────────────────────────────────────────────────────────────────
function setupCreateRoleForm() {
    const form = document.getElementById('createRoleForm');
    const fb = document.getElementById('createRoleFeedback');
    const btn = document.getElementById('btnCreateRole');

    document.getElementById('newRoleName')?.addEventListener('input', e => {
        document.getElementById('newRoleSlug').value = e.target.value.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        btn.disabled = true; btn.textContent = 'Creating…';
        fb.style.display = 'none';
        try {
            await adminFetch('/api/admin/roles', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('newRoleName').value,
                    slug: document.getElementById('newRoleSlug').value,
                    level: parseInt(document.getElementById('newRoleLevel').value),
                    description: document.getElementById('newRoleDesc').value,
                }),
            });
            fb.textContent = 'Role created!';
            fb.style.cssText = 'display:block;background:#f0fff4;color:#38a169;border:1px solid #38a169;padding:10px;border-radius:4px;margin-top:10px;';
            form.reset();
            await loadRolesTable();
        } catch (err) {
            fb.textContent = err.message;
            fb.style.cssText = 'display:block;background:#fff5f5;color:#e53e3e;border:1px solid #e53e3e;padding:10px;border-radius:4px;margin-top:10px;';
        } finally {
            btn.disabled = false; btn.textContent = 'Create Role';
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Pagination renderer
// ─────────────────────────────────────────────────────────────────────────────
const _paginationCallbacks = {};

function renderPagination(containerId, current, last, onPageClick) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (last <= 1) { wrap.innerHTML = ''; return; }

    // Store the callback so it can be called from the event listener
    _paginationCallbacks[containerId] = onPageClick;

    wrap.innerHTML = Array.from({ length: last }, (_, i) => i + 1).map(p =>
        `<button data-page="${p}" data-pagination-id="${containerId}" style="border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:0.85rem;${p === current ? 'background:var(--primary);color:#fff;' : 'background:var(--gray-100);color:var(--gray-700);'}">${p}</button>`
    ).join('');

    // Wire up clicks (remove old listener first by replacing the node)
    const newWrap = wrap.cloneNode(false);
    newWrap.innerHTML = wrap.innerHTML;
    wrap.parentNode.replaceChild(newWrap, wrap);
    newWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-page]');
        if (!btn) return;
        const page = parseInt(btn.dataset.page, 10);
        const cb = _paginationCallbacks[btn.dataset.paginationId];
        if (cb) cb(page);
    });
}
