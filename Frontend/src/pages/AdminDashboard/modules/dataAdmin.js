// Force Vite reload
/**
 * MODULE: Data Admin (Modify Data)
 * 
 * Powers the dynamic CRUD configuration for the "Modify Data" tab.
 * Responsible for rendering hierarchical lists (Categories, Services, Roles) 
 * and generating the generic forms for creating or updating system data.
 */

import { authFetch } from '../../../utils/auth.js';
import { API, BASE_URL } from '../../../config/api.js';
import { _app, _state } from './core.js';
import { __esc, _formatDate, _statusColor, _actionIcon } from '../../../utils/helpers.js';
import { _showToast, _buildHierarchicalPageHtml, _wireHierarchicalPage, _buildCategoriesPageHtml, _wireCategoriesPage, _buildSimpleListPageHtml, _wireSimpleListPage } from './utils.js';

// ═══════════════════════════════════════════════════════════════════════════
// MODIFY DATA MODULE
// ═══════════════════════════════════════════════════════════════════════════
const _ENTITIES = [
    { key: 'institutes', label: 'Institutes', fullLabel: 'Institute Management', desc: 'Add new authorized institutes or review pending registrations', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Institute.svg); mask-image: url(/assets/icons/Institute.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'users_roles', label: 'Users', fullLabel: 'Users & Roles', desc: 'Manage system users and assign roles', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/users_roles.svg); mask-image: url(/assets/icons/users_roles.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'categories', label: 'Categories', fullLabel: 'Category Management', desc: 'Define new academic or organizational groups', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/categories.svg); mask-image: url(/assets/icons/categories.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'services', label: 'Services', fullLabel: 'Services Management', desc: 'Manage system services and their details', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/services.svg); mask-image: url(/assets/icons/services.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'systems', label: 'Systems', fullLabel: 'Systems Management', desc: 'Manage systems and their configurations', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/systems.svg); mask-image: url(/assets/icons/systems.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'requests', label: 'Requests', fullLabel: 'Request Types', desc: 'Configure application request types', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/requests.svg); mask-image: url(/assets/icons/requests.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'titles', label: 'Salutations', fullLabel: 'Salutations', desc: 'Manage available user salutations', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/titles.svg); mask-image: url(/assets/icons/titles.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'durations', label: 'Durations', fullLabel: 'Duration Settings', desc: 'Configure system-wide duration options', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/durations.svg); mask-image: url(/assets/icons/durations.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
];

export function _buildModifyCards(permissions = []) {
    const cardPerms = {
        'institutes': ['manage_institutes'],
        'users_roles': ['manage_users', 'manage_roles', 'assign_roles'],
        'categories': ['manage_categories'],
        'services': ['manage_services'],
        'systems': ['manage_systems'],
        'requests': ['manage_requests'],
        'titles': ['manage_salutations'],
        'durations': ['manage_durations']
    };

    return _ENTITIES.filter(e => {
        const required = cardPerms[e.key] || [];
        return required.some(p => permissions.includes(p));
    }).map(e => `
        <div class="adm-data-card" data-entity="${e.key}">
            <span class="adm-data-card-icon">${e.icon}</span>
            <div class="adm-data-card-title">${e.label}</div>
        </div>`).join('');
}

export function _initModifyCards() {
    _app.querySelectorAll('.adm-data-card[data-entity]').forEach(card => {
        if (card._wired) return;
        card._wired = true;
        card.addEventListener('click', () => {
            const entity = card.dataset.entity;
            if (entity === 'institutes') {
                _switchTab('institutes');
            } else {
                _switchTab('data-admin', entity);
            }
        });
    });
}

export async function _loadDataAdmin(entity) {
    const container = _app.querySelector('#adm-data-admin-container');
    const meta = _ENTITIES.find(e => e.key === entity);

    const isHierarchical = ['services', 'systems', 'workflows'].includes(entity);
    container.innerHTML = `
        <div class="adm-page-header" style="margin-bottom:2rem; display:flex; align-items:center; gap:1.5rem;">
            <button class="adm-btn adm-btn-secondary" onclick="_switchTab('modify')" style="padding:0; border-radius:12px; width:42px; height:42px; display:flex; align-items:center; justify-content:center; background:#fff; border:1px solid #e2e8f0; color:#64748b; transition:all 0.2s;" onmouseover="this.style.borderColor='#6366f1'; this.style.color='#6366f1';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#64748b';" title="Go Back">
                <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/arrow-left.svg); mask-image: url(/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
            </button>
            <div style="display:flex; align-items:center; gap:1rem;">
                <div style="width:48px; height:48px; border-radius:12px; background:#eef2ff; color:#6366f1; display:flex; align-items:center; justify-content:center;">
                    ${meta?.icon || ''}
                </div>
                <div>
                    <h2 class="adm-page-title" style="margin:0;">${meta?.fullLabel || meta?.label || entity}</h2>
                    <p class="adm-page-sub" style="margin:0; margin-top:4px;">${meta?.desc || `Comprehensive view and modification of ${meta?.label?.toLowerCase() || 'data'}.`}</p>
                </div>
            </div>
        </div>
        <div id="adm-data-admin-content">
            <div class="adm-loading"><div class="adm-spinner"></div> Loading…</div>
        </div>
    `;

    const content = container.querySelector('#adm-data-admin-content');

    // ── Special: Users & Roles ──────────────────────────────────────────
    if (entity === 'users_roles') {
        content.innerHTML = await _buildUsersPageHtml(_state.permissions);
        _wireAssignRoleForm(content);
        return;
    }

    // ── Special: Categories ─────────────────────────────────────────────
    if (entity === 'categories') {
        content.innerHTML = await _buildCategoriesPageHtml();
        _wireCategoriesPage(content);
        return;
    }

    // ── Special: Hierarchical (Services, Systems, Workflows) ──────────
    if (entity === 'services' || entity === 'systems' || entity === 'workflows') {
        content.innerHTML = await _buildHierarchicalPageHtml(entity);
        _wireHierarchicalPage(content, entity);
        return;
    }

    // ── Special: Simple Lists (Titles, Durations, etc) ───────────────────
    if (['titles', 'durations', 'requests'].includes(entity)) {
        content.innerHTML = await _buildSimpleListPageHtml(entity);
        _wireSimpleListPage(content, entity);
        return;
    }

    // ── Generic entity list ─────────────────────────────────────────────
    try {
        const res = await authFetch(API.ADMIN_DATA(entity));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();

        if (!rows?.length) {
            content.innerHTML = `<div class="adm-empty"><span>📭</span>No records found for this category.</div>`;
            return;
        }

        content.innerHTML = `
            <div class="adm-inst-section">
                <div class="adm-inst-section-title"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/list.svg); mask-image: url(/assets/icons/list.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Existing Records</div>
                <div class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>Name / Identifier</th>
                                <th>Technical Code / Slug</th>
                                <th>Status</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => {
            const name = row.name || row.workflow_name || row.code || row.slug || Object.values(row)[1] || '—';
            const sub = row.slug || row.code || row.type || '—';
            return `
                                <tr>
                                    <td><strong>${__esc(String(name))}</strong></td>
                                    <td><code style="color:#6366f1;">${__esc(String(sub))}</code></td>
                                    <td>
                                        <span class="adm-pill ${row.is_active === false ? 'adm-pill-pending' : 'adm-pill-approved'}">
                                            ${row.is_active === false ? 'Inactive' : 'Active'}
                                        </span>
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="adm-btn adm-btn-secondary" style="font-size:0.7rem;">Modify</button>
                                    </td>
                                </tr>`;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (err) {
        content.innerHTML = `<div class="adm-empty"><span>❌</span>Failed: ${__esc(err.message)}</div>`;
    }
}

// ── Users page with assign-role form ─────────────────────────────────────
async function _buildUsersPageHtml(permissions = []) {
    let rolesOptions = '<option value="">— Select Role —</option>';
    let instOptions = '<option value="">— Select Institute —</option>';
    let catOptions = '<option value="">— Select Category —</option>';

    try {
        const [rRes, iRes, cRes] = await Promise.all([
            authFetch(API.ADMIN_ROLES),
            authFetch(API.ADMIN_INSTITUTES),
            authFetch(API.ADMIN_DATA('categories'))
        ]);
        if (rRes.ok) { const roles = await rRes.json(); rolesOptions += roles.map(r => `<option value="${r.id}">${__esc(r.name)}</option>`).join(''); }
        if (iRes.ok) {
            const data = await iRes.json();
            const list = Array.isArray(data) ? data : (data.all || data.active || []);
            instOptions += list.map(i => `<option value="${i.id}">${__esc(i.name)}</option>`).join('');
        }
        if (cRes.ok) { const cats = await cRes.json(); catOptions += cats.map(c => `<option value="${c.id}">${__esc(c.name)}</option>`).join(''); }
    } catch (_) { }

    const hasCreateRole = permissions.includes('manage_roles');
    const hasAssignRole = permissions.includes('assign_roles');

    let cardsHtml = '';
    let columns = 0;

    if (hasCreateRole) {
        columns++;
        cardsHtml += `
        <!-- Create Role Card -->
        <div class="adm-data-card" id="adm-card-create-role" style="cursor: pointer;">
            <span class="adm-data-card-icon"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/users_roles.svg); mask-image: url(/assets/icons/users_roles.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span></span>
            <div class="adm-data-card-title">Create Role</div>
        </div>
        `;
    }

    if (hasAssignRole) {
        columns++;
        cardsHtml += `
        <!-- Assign Role Card -->
        <div class="adm-data-card" id="adm-card-assign-role" style="cursor: pointer;">
            <span class="adm-data-card-icon"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/Assign_user.svg); mask-image: url(/assets/icons/Assign_user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span></span>
            <div class="adm-data-card-title">Assign Role</div>
        </div>
        `;
    }

    columns++;
    cardsHtml += `
    <!-- Active Users Card -->
    <div class="adm-data-card" id="adm-card-active-users" style="cursor: pointer;">
        <span class="adm-data-card-icon"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/user-check.svg); mask-image: url(/assets/icons/user-check.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span></span>
        <div class="adm-data-card-title">User Directory</div>
    </div>
    `;

    const gridColumnsStyle = columns === 1
        ? 'grid-template-columns: minmax(180px, 220px);'
        : `grid-template-columns: repeat(${columns}, minmax(180px, 220px));`;

    return `
    <div id="adm-users-roles-main-container" class="adm-cards-grid" style="margin-top: 1rem; margin-bottom: 2rem; ${gridColumnsStyle} justify-content: center; gap: 3rem; padding: 1.5rem 0;">
        ${cardsHtml}
    </div>

    <!-- Hidden Subpage Container -->
    <div id="adm-users-roles-view-container" style="display: none;"></div>

    <!-- Hidden options to hold metadata for _manageUser fetching -->
    <select id="adm-m-role-select" style="display: none;">${rolesOptions}</select>
    <select id="adm-m-inst-select" style="display: none;">${instOptions}</select>
    <select id="adm-m-cat-select" style="display: none;">${catOptions}</select>
    `;
}

async function _buildCreateRoleHtml() {
    let permissionsHtml = '';
    try {
        const pRes = await authFetch(`${BASE_URL}/api/auth/admin/permissions`);
        if (pRes.ok) {
            const perms = await pRes.json();
            const groups = perms.reduce((acc, p) => { (acc[p.type] = acc[p.type] || []).push(p); return acc; }, {});
            permissionsHtml = Object.keys(groups).map(type => `
                <div style="margin-bottom:1.5rem;">
                    <div style="font-size:0.7rem; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:0.75rem; letter-spacing:0.05em; display:flex; align-items:center; gap:8px;">
                        <span style="width:4px; height:12px; background:#6366f1; border-radius:2px;"></span>
                        ${__esc(type)}
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem;">
                        ${groups[type].map(p => `
                            <label style="display:flex; align-items:center; gap:10px; font-size:0.75rem; cursor:pointer; padding:10px 12px; background:#fff; border:1.5px solid #e2e8f0; border-radius:8px; transition:all 0.2s;" class="perm-box-label">
                                <input type="checkbox" class="role-perm-cb" value="${p.id}" style="width:16px; height:16px; accent-color:#6366f1;" />
                                <span style="font-weight:600; color:#334155;">${__esc(p.name)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }
    } catch (_) { }

    return `
    <!-- Back Button -->
    <div style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem; font-family: 'Inter', sans-serif;">
        <button id="adm-users-roles-back-btn" class="adm-btn adm-btn-secondary" style="height:38px; font-size:0.8rem; font-weight:700; padding:0 1.25rem; border-radius:8px; background:#fff; color:#475569; border:1px solid #cbd5e1; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/arrow-left.svg); mask-image: url(/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 14px; height: 14px; display: inline-block; vertical-align: text-bottom;"></span> Back to Menu
        </button>
    </div>

    <!-- Master Role Creator (Accordion) -->
    <div class="adm-accordion open" id="role-creator-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1.15rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/shield.svg); mask-image: url(/assets/icons/shield.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-right:1rem;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div>
                                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">MASTER ROLE CREATOR</h4>
                                <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">DEFINE NEW ADMINISTRATIVE TIERS AND PERMISSIONS</p>
                            </div>
                        </div>
                        <div class="adm-radio-group" style="margin:0; background:#f1f5f9; padding:3px; border-radius:8px;" onclick="event.stopPropagation()">
                            <label class="adm-radio-label" style="margin:0;">
                                <input type="radio" name="role-mode" value="create" checked>
                                <span class="adm-radio-chip" style="padding:6px 12px; font-size:0.75rem;">Create Role</span>
                            </label>
                            <label class="adm-radio-label" style="margin:0;">
                                <input type="radio" name="role-mode" value="update">
                                <span class="adm-radio-chip" style="padding:6px 12px; font-size:0.75rem;">Update Role</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div class="adm-form" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1.25rem; margin-bottom:1.5rem;">
                <div class="adm-form-group">
                    <label class="adm-label">Role Name</label>
                    <input id="new-role-name" type="text" placeholder="e.g. Finance Admin" class="adm-select" />
                </div>
                <div class="adm-form-group">
                    <label class="adm-label">Technical Slug</label>
                    <input id="new-role-slug" type="text" placeholder="e.g. finance_admin" class="adm-select" />
                </div>
                <div class="adm-form-group">
                    <label class="adm-label">Authority Level (1-100)</label>
                    <input id="new-role-level" type="number" min="1" max="100" placeholder="50" class="adm-select" />
                </div>
            </div>
            <!-- Nested Permissions Accordion -->
            <div class="adm-accordion" id="role-perms-accordion" style="margin-bottom:1.5rem; border:1.5px solid #eef2ff; border-radius:10px; background:#f8fafc;">
                <div class="adm-accordion-header" style="padding:0.75rem 1rem; background:linear-gradient(to right, #f8fafc, #fff); cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="extracted-svg" style="width:16px; height:16px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/lock.svg); mask-image: url(/assets/icons/lock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        <span style="font-size:0.85rem; font-weight:700; color:#1e293b;">SELECT ROLE PERMISSIONS</span>
                    </div>
                    <span class="extracted-svg" style="width:16px; height:16px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div class="adm-accordion-content" style="padding:1.25rem;">
                    <div id="role-permissions-grid" style="max-height:400px; overflow-y:auto; padding-right:10px;">
                        ${permissionsHtml}
                    </div>
                </div>
            </div>
            <div id="role-create-fb" style="min-height:1.2rem; font-size:0.85rem; margin-bottom:1rem;"></div>
            <button id="add-role-btn" class="adm-btn adm-btn-primary" style="width:auto; padding:0.75rem 2.5rem; background:#6366f1;">Initialize New Role</button>
        </div>
    </div>

    <!-- Existing Roles (Accordion - Separate) -->
    <div class="adm-accordion open" id="roles-list-accordion" style="margin-top:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/list.svg); mask-image: url(/assets/icons/list.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">EXISTING ROLES DIRECTORY</h4>
                <span id="roles-list-count" style="margin-left:auto; background:#6366f1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>
            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; margin-left: 10px; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div id="adm-roles-list-container"></div>
        </div>
    </div>
    `;
}

async function _buildAssignRoleHtml() {
    return `
    <!-- Back Button -->
    <div style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem; font-family: 'Inter', sans-serif;">
        <button id="adm-users-roles-back-btn" class="adm-btn adm-btn-secondary" style="height:38px; font-size:0.8rem; font-weight:700; padding:0 1.25rem; border-radius:8px; background:#fff; color:#475569; border:1px solid #cbd5e1; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/arrow-left.svg); mask-image: url(/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 14px; height: 14px; display: inline-block; vertical-align: text-bottom;"></span> Back to Menu
        </button>
    </div>

    <!-- Assign Role & Affiliation (Accordion) -->
    <div class="adm-accordion open" id="assign-role-editor-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; font-family: 'Inter', sans-serif;">
        <div class="adm-accordion-header" style="padding:1.15rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/edit-3.svg); mask-image: url(/assets/icons/edit-3.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">ASSIGN ROLE & AFFILIATION</h4>
                    <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">MANAGE USER ASSIGNMENTS IN REAL-TIME</p>
                </div>
            </div>
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <!-- Placeholder prompt when no user is loaded -->
            <div id="adm-assign-placeholder" style="padding: 2.5rem; text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; color: #64748b; font-size: 0.85rem; font-weight: 600;">
                <span class="extracted-svg" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 6px; color: #6366f1; -webkit-mask-image: url(/assets/icons/info.svg); mask-image: url(/assets/icons/info.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                Select a user from the Users Directory below to edit their role.
            </div>

            <!-- Form fields (hidden initially until a user is clicked) -->
            <div id="adm-assign-editor-form" style="display: none; flex-direction: column; gap: 1.25rem;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
                    <!-- User Email -->
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 6px;">User Email</label>
                        <input type="text" id="adm-editor-email" disabled style="
                            width: 100%;
                            background: #f8fafc;
                            color: #64748b;
                            cursor: not-allowed;
                            border: 1.5px solid #e2e8f0;
                            padding: 10px 12px;
                            border-radius: 8px;
                            font-size: 0.85rem;
                            font-weight: 600;
                        " />
                    </div>

                    <!-- User Institute -->
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 6px;">User Institute</label>
                        <input type="text" id="adm-editor-inst" disabled style="
                            width: 100%;
                            background: #f8fafc;
                            color: #64748b;
                            cursor: not-allowed;
                            border: 1.5px solid #e2e8f0;
                            padding: 10px 12px;
                            border-radius: 8px;
                            font-size: 0.85rem;
                            font-weight: 600;
                        " />
                    </div>

                    <!-- User Category -->
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 6px;">User Category</label>
                        <input type="text" id="adm-editor-cat" disabled style="
                            width: 100%;
                            background: #f8fafc;
                            color: #64748b;
                            cursor: not-allowed;
                            border: 1.5px solid #e2e8f0;
                            padding: 10px 12px;
                            border-radius: 8px;
                            font-size: 0.85rem;
                            font-weight: 600;
                        " />
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; align-items: flex-end;">
                    <!-- Assign Role Dropdown -->
                    <div>
                        <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 6px;">Assign / Change Role</label>
                        <select id="adm-editor-role-select" style="
                            width: 100%;
                            padding: 10px 12px;
                            border-radius: 8px;
                            font-size: 0.85rem;
                            font-weight: 600;
                            border: 1.5px solid #cbd5e1;
                            background: #fff;
                            outline: none;
                            cursor: pointer;
                            height: 42px;
                        ">
                            <!-- Populated dynamically -->
                        </select>
                    </div>

                    <!-- Entity Dropdown (Hidden initially) -->
                    <div id="adm-editor-entity-container" style="display: none;">
                        <label id="adm-editor-entity-label" style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 6px;">Select System</label>
                        <select id="adm-editor-entity-select" style="
                            width: 100%;
                            padding: 10px 12px;
                            border-radius: 8px;
                            font-size: 0.85rem;
                            font-weight: 600;
                            border: 1.5px solid #cbd5e1;
                            background: #fff;
                            outline: none;
                            cursor: pointer;
                            height: 42px;
                        ">
                            <!-- Populated dynamically -->
                        </select>
                    </div>

                    <!-- Sub-Entity Dropdown (Hidden initially, used for subsystem selection) -->
                    <div id="adm-editor-sub-entity-container" style="display: none;">
                        <label style="display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 6px;">Select Subsystem</label>
                        <select id="adm-editor-sub-entity-select" style="
                            width: 100%;
                            padding: 10px 12px;
                            border-radius: 8px;
                            font-size: 0.85rem;
                            font-weight: 600;
                            border: 1.5px solid #cbd5e1;
                            background: #fff;
                            outline: none;
                            cursor: pointer;
                            height: 42px;
                        ">
                            <!-- Populated dynamically -->
                        </select>
                    </div>

                    <!-- Actions -->
                    <div style="display: flex; gap: 10px; height: 42px;">
                        <button id="adm-editor-cancel-btn" class="adm-btn adm-btn-secondary" style="flex: 1; height: 100%; font-size: 0.8rem; font-weight: 700; border-radius: 8px;">Cancel</button>
                        <button id="adm-editor-submit-btn" class="adm-btn" style="flex: 1.5; height: 100%; font-size: 0.8rem; font-weight: 700; border-radius: 8px; background: #6366f1; color: #fff; border: 1px solid #6366f1;">Assign Role</button>
                    </div>
                </div>

                <!-- Warning for LI-Coordinator -->
                <div id="adm-editor-warning" style="
                    display: none;
                    padding: 12px 16px;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 8px;
                    color: #b45309;
                    font-size: 0.75rem;
                    font-weight: 600;
                    line-height: 1.5;
                ">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span class="extracted-svg" style="width: 14px; height: 14px; color: #d97706; display: inline-block; -webkit-mask-image: url(/assets/icons/alert-triangle.svg); mask-image: url(/assets/icons/alert-triangle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        <strong style="color: #92400e;">Warning</strong>
                    </div>
                    Assigning a new LI-Coordinator will deactivate the current active coordinator for this institute.
                </div>

                <div id="adm-editor-error" style="display: none; color: #ef4444; font-size: 0.75rem; font-weight: 700; font-family: 'Inter', sans-serif;"></div>
            </div>
        </div>
    </div>

    <!-- Active Users (Accordion) -->
    <div class="adm-accordion open" id="active-users-list-accordion" style="margin-top:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; font-family: 'Inter', sans-serif;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #ecfdf5 20%, #fff); border-left:5px solid #10b981; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#10b981; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/user-check.svg); mask-image: url(/assets/icons/user-check.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">ACTIVE USERS</h4>
                <span id="active-users-list-count" style="background:#10b981; color:#fff; padding:2px 8.5px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>
            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div id="adm-active-users-list-container"></div>
        </div>
    </div>

    <!-- Users Directory (Accordion) -->
    <div class="adm-accordion open" id="users-list-accordion" style="margin-top:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; font-family: 'Inter', sans-serif;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/users.svg); mask-image: url(/assets/icons/users.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">USERS DIRECTORY</h4>
                <span id="users-list-count" style="background:#6366f1; color:#fff; padding:2px 8.5px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>

            <!-- Search Input on Header -->
            <div style="flex:1; max-width:300px; position:relative; margin-left:auto; margin-right:12px;" onclick="event.stopPropagation();">
                <span class="extracted-svg" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:#94a3b8; pointer-events:none; display: inline-block; -webkit-mask-image: url(/assets/icons/search.svg); mask-image: url(/assets/icons/search.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                <input type="text" id="adm-users-search-input" class="adm-search-input" placeholder="Search users by name or email…" style="height:34px; padding-left:2.25rem; font-size:0.75rem; border-color:#dcd7ff; background:#fff; margin:0;" />
            </div>

            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div id="adm-users-list-container"></div>
        </div>
    </div>
    `;
}

async function _wireAssignRoleForm(content) {
    const mainContainer = content.querySelector('#adm-users-roles-main-container');
    const viewContainer = content.querySelector('#adm-users-roles-view-container');

    const cardCreate = content.querySelector('#adm-card-create-role');
    const cardAssign = content.querySelector('#adm-card-assign-role');

    if (cardCreate) {
        cardCreate.onclick = async () => {
            mainContainer.style.display = 'none';
            viewContainer.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading Create Role View…</div>`;
            viewContainer.style.display = 'block';

            viewContainer.innerHTML = await _buildCreateRoleHtml();
            _wireCreateRoleSubpage(viewContainer);
        };
    }

    if (cardAssign) {
        cardAssign.onclick = async () => {
            mainContainer.style.display = 'none';
            viewContainer.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading Assign Role View…</div>`;
            viewContainer.style.display = 'block';

            viewContainer.innerHTML = await _buildAssignRoleHtml();
            _wireAssignRoleSubpage(viewContainer);
        };
    }

    const cardActiveUsers = content.querySelector('#adm-card-active-users');
    if (cardActiveUsers) {
        cardActiveUsers.onclick = async () => {
            mainContainer.style.display = 'none';
            viewContainer.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading Active Users View…</div>`;
            viewContainer.style.display = 'block';

            viewContainer.innerHTML = await _buildActiveUsersHtml();
            _wireActiveUsersSubpage(viewContainer);
        };
    }
}

function _wireCreateRoleSubpage(container) {
    // Back Button
    const backBtn = container.querySelector('#adm-users-roles-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            container.style.display = 'none';
            const mainContainer = container.previousElementSibling;
            if (mainContainer) mainContainer.style.display = '';
        };
    }

    const roleCreator = container.querySelector('#role-creator-accordion');
    if (roleCreator) {
        roleCreator.querySelector('.adm-accordion-header').onclick = () => roleCreator.classList.toggle('open');

        const permsAccordion = roleCreator.querySelector('#role-perms-accordion');
        if (permsAccordion) {
            permsAccordion.querySelector('.adm-accordion-header').onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                permsAccordion.classList.toggle('open');
            };
        }

        const addRoleBtn = roleCreator.querySelector('#add-role-btn');
        addRoleBtn.onclick = async () => {
            const name = roleCreator.querySelector('#new-role-name').value.trim();
            const slug = roleCreator.querySelector('#new-role-slug').value.trim();
            const level = roleCreator.querySelector('#new-role-level').value;
            const fb = roleCreator.querySelector('#role-create-fb');
            const perms = Array.from(roleCreator.querySelectorAll('.role-perm-cb:checked')).map(cb => cb.value);

            if (!name || !slug) { fb.style.color = '#ef4444'; fb.textContent = 'Name and Slug are required.'; return; }

            addRoleBtn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = roleCreator.dataset.editId ? 'Updating Role…' : 'Initializing Role…';
            try {
                const isEdit = !!roleCreator.dataset.editId;
                const method = isEdit ? 'PATCH' : 'POST';
                const endpoint = isEdit ? `${BASE_URL}/api/auth/admin/roles/${roleCreator.dataset.editId}` : `${BASE_URL}/api/auth/admin/roles`;

                const res = await authFetch(endpoint, {
                    method: method,
                    body: JSON.stringify({ name, slug, level, permissions: perms })
                });
                const data = await res.json();
                if (res.ok) {
                    _showToast(`Role ${isEdit ? 'updated' : 'created'} successfully`);
                    fb.style.color = '#10b981'; fb.textContent = `✓ Role ${isEdit ? 'Updated' : 'Initialized'}.`;
                    // Clear form
                    roleCreator.dataset.editId = '';
                    addRoleBtn.textContent = 'Initialize New Role';
                    roleCreator.querySelector('.adm-accordion-header h4').textContent = 'MASTER ROLE CREATOR';
                    roleCreator.querySelector('#new-role-name').value = '';
                    roleCreator.querySelector('#new-role-slug').value = '';
                    roleCreator.querySelectorAll('.role-perm-cb').forEach(cb => cb.checked = false);
                    setTimeout(() => {
                        roleCreator.classList.remove('open');
                        loadRoleList();
                    }, 1000);
                } else {
                    fb.style.color = '#ef4444'; fb.textContent = data.error || 'Operation failed.';
                }
            } catch (e) { fb.style.color = '#ef4444'; fb.textContent = e.message; }
            finally { addRoleBtn.disabled = false; }
        };

        const modeRadios = roleCreator.querySelectorAll('input[name="role-mode"]');
        modeRadios.forEach(r => {
            r.onchange = () => {
                if (r.value === 'create') {
                    roleCreator.dataset.editId = '';
                    addRoleBtn.textContent = 'Initialize New Role';
                    roleCreator.querySelector('.adm-accordion-header h4').textContent = 'MASTER ROLE CREATOR';
                    roleCreator.querySelector('#new-role-name').value = '';
                    roleCreator.querySelector('#new-role-slug').value = '';
                    roleCreator.querySelectorAll('.role-perm-cb').forEach(cb => cb.checked = false);
                } else {
                    // Show edit selection logic - we can let them use the "Edit" buttons in the table
                    // Or they can click "Edit" and it will switch this radio for them.
                    // For now, if they manually click Update, just alert them to select a role from below.
                    if (!roleCreator.dataset.editId) {
                        _showToast('Please click "Edit" on a role in the list below to update it.', 'info');
                        // Switch back to create if no editId
                        modeRadios[0].checked = true;
                    }
                }
            };
        });
    }

    const rolesListAccordion = container.querySelector('#roles-list-accordion');
    if (rolesListAccordion) {
        rolesListAccordion.querySelector('.adm-accordion-header').onclick = () => rolesListAccordion.classList.toggle('open');
    }

    const rolesContainer = container.querySelector('#adm-roles-list-container');
    const loadRoleList = async () => {
        try {
            const res = await authFetch(API.ADMIN_ROLES);
            const list = res.ok ? await res.json() : [];
            list.sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0));
            // Store globally for edit dropdown
            window.__admRolesCache = list;

            const rolesAccordionCount = container.querySelector('#roles-list-count');
            if (rolesAccordionCount) {
                rolesAccordionCount.textContent = list.length;
                rolesAccordionCount.style.display = 'inline-block';
            }

            rolesContainer.innerHTML = `
                <div class="adm-table-wrap" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                    <table class="adm-table" style="margin: 0;">
                        <thead>
                            <tr>
                                <th style="width: 80px; text-align: center;">Level</th>
                                <th style="width: 200px;">Role</th>
                                <th>Permissions</th>
                                <th style="width: 120px; text-align: center;">Status</th>
                                <th style="width: 100px; text-align: center;">Toggle</th>
                                <th style="width: 80px; text-align: center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(r => {
                const isSuper = r.slug === 'super_admin';
                return `
                                <tr>
                                    <td style="text-align: center; vertical-align: middle;">
                                        <div style="width:42px; height:42px; border-radius:10px; background:#f5f3ff; color:#6366f1; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; border:1px solid #e0e7ff; margin:0 auto;">
                                            L${r.level || '—'}
                                        </div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        <div style="display:flex; flex-direction:column; gap:4px;">
                                            <strong style="color:#1e293b; font-size:0.95rem;">${__esc(r.name)}</strong>
                                            <div>
                                                <code style="font-size:0.7rem; color:#6366f1; background:#f0f4ff; padding:2px 6px; border-radius:4px; font-weight:600;">${__esc(r.slug)}</code>
                                            </div>
                                        </div>
                                    </td>
                                    <td style="vertical-align: middle;">
                                        ${r.permissions && r.permissions.length ? `
                                            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                                                ${r.permissions.map(p => `
                                                    <span style="font-size:0.65rem; font-weight: 700; color:#6366f1; background:#eef2ff; padding:2px 8px; border-radius:6px; border:1px solid #d0d7ff;" title="${__esc(p.type)}">
                                                        ${__esc(p.name)}
                                                    </span>
                                                `).join('')}
                                            </div>
                                        ` : `<div style="font-size:0.7rem; color:#94a3b8; font-style:italic; font-weight: 600;">No permissions assigned.</div>`}
                                    </td>
                                    <td style="text-align: center; vertical-align: middle;">
                                        <span class="adm-pill ${r.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}" style="font-size:0.65rem; min-width:65px; text-align:center; font-weight: 700; text-transform: uppercase;">
                                            ${r.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style="text-align: center; vertical-align: middle;">
                                        <label class="adm-switch" style="margin: 0 auto;">
                                            <input type="checkbox" class="role-status-toggle" data-id="${r.id}" ${r.is_active ? 'checked' : ''} ${isSuper ? 'disabled' : ''}>
                                            <span class="adm-switch-slider"></span>
                                        </label>
                                    </td>
                                    <td style="text-align: center; vertical-align: middle;">
                                        ${!isSuper ? `<button class="adm-btn adm-btn-secondary edit-role-btn" data-role='${__esc(JSON.stringify(r))}' style="padding: 4px 8px; font-size: 0.7rem; display:inline-flex; align-items:center; gap:4px;"><span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/edit-2.svg); mask-image: url(/assets/icons/edit-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width:12px; height:12px;"></span>Edit</button>` : ''}
                                    </td>
                                </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>`;

            rolesContainer.querySelectorAll('.edit-role-btn').forEach(btn => {
                btn.onclick = () => {
                    const role = JSON.parse(btn.dataset.role);
                    roleCreator.querySelector('#new-role-name').value = role.name;
                    roleCreator.querySelector('#new-role-slug').value = role.slug;
                    roleCreator.querySelector('#new-role-level').value = role.level;

                    roleCreator.querySelectorAll('.role-perm-cb').forEach(cb => {
                        cb.checked = role.permissions.some(p => p.id == cb.value);
                    });

                    roleCreator.dataset.editId = role.id;
                    const addRoleBtn = roleCreator.querySelector('#add-role-btn');
                    addRoleBtn.textContent = 'Update Role';
                    roleCreator.classList.add('open');
                    roleCreator.querySelector('.adm-accordion-header h4').textContent = 'UPDATE EXISTING ROLE';
                    const modeRadios = roleCreator.querySelectorAll('input[name="role-mode"]');
                    if (modeRadios.length > 1) modeRadios[1].checked = true;
                    roleCreator.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };
            });

            rolesContainer.querySelectorAll('.role-status-toggle').forEach(sw => {
                sw.onchange = async () => {
                    try {
                        const res = await authFetch(`${BASE_URL}/api/auth/admin/roles/${sw.dataset.id}/toggle`, { method: 'PATCH' });
                        if (res.ok) {
                            _showToast('Role status updated');
                            loadRoleList();
                        } else {
                            const errData = await res.json();
                            _showToast(errData.error || 'Failed to update status', 'error');
                            sw.checked = !sw.checked;
                        }
                    } catch (e) {
                        _showToast(e.message, 'error');
                        sw.checked = !sw.checked;
                    }
                };
            });
        } catch (e) {
            rolesContainer.innerHTML = `<div class="adm-empty" style="color:#ef4444;"><span>⚠️</span>Error loading roles: ${e.message}</div>`;
        }
    };

    loadRoleList();
}

function _wireAssignRoleSubpage(container) {
    // Back Button
    const backBtn = container.querySelector('#adm-users-roles-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            container.style.display = 'none';
            const mainContainer = container.previousElementSibling;
            if (mainContainer) mainContainer.style.display = '';
        };
    }

    const assignEditorAccordion = container.querySelector('#assign-role-editor-accordion');
    if (assignEditorAccordion) {
        assignEditorAccordion.querySelector('.adm-accordion-header').onclick = () => assignEditorAccordion.classList.toggle('open');
    }

    const usersListAccordion = container.querySelector('#users-list-accordion');
    if (usersListAccordion) {
        usersListAccordion.querySelector('.adm-accordion-header').onclick = () => usersListAccordion.classList.toggle('open');
    }

    const activeUsersListAccordion = container.querySelector('#active-users-list-accordion');
    if (activeUsersListAccordion) {
        activeUsersListAccordion.querySelector('.adm-accordion-header').onclick = () => activeUsersListAccordion.classList.toggle('open');
    }

    const usersContainer = container.querySelector('#adm-users-list-container');
    let cachedUsers = [];
    let instF, roleF;

    const renderFilteredUsers = () => {
        const searchQuery = (container.querySelector('#adm-users-search-input')?.value || '').toLowerCase().trim();

        const grouped = [];
        const map = new Map();
        cachedUsers.forEach(u => {
            const key = u.email;
            if (map.has(key)) {
                const existing = map.get(key);
                if (u.role_name && !existing.roles.includes(u.role_name)) {
                    existing.roles.push(u.role_name);
                }
            } else {
                const copy = { ...u, roles: u.role_name ? [u.role_name] : [] };
                grouped.push(copy);
                map.set(key, copy);
            }
        });

        grouped.forEach(u => {
            u.role_name = u.roles.length ? u.roles.join(', ') : 'Unassigned';
        });

        const filtered = grouped.filter(u => {
            const name = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            return !searchQuery || name.includes(searchQuery) || email.includes(searchQuery);
        });

        // Update count badge
        const badgeEl = usersContainer.querySelector('#user-count-badge');
        if (badgeEl) {
            badgeEl.textContent = filtered.length;
        }
        const accordionCount = container.querySelector('#users-list-count');
        if (accordionCount) {
            accordionCount.textContent = filtered.length;
            accordionCount.style.display = 'inline-block';
        }

        const listContainer = usersContainer.querySelector('#adm-users-actual-list');
        if (!listContainer) return;



        listContainer.innerHTML = filtered.length ? `
            <div class="adm-table-wrap" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; max-height:550px; overflow-y:auto; scrollbar-width:thin;">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th style="text-align:center;">User Identity</th>
                            <th>Designated Role</th>
                            <th>Institute / Affiliation</th>
                            <th style="text-align:center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${filtered.map(u => {
            const isBlocked = !!u.is_blocked || u.status === 'blocked' || u.status === 'deactivated';
            const nameInitials = (u.name || '').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??';
            return `
                        <tr style="${isBlocked ? 'background:#fff5f5;' : ''}">
                            <td style="text-align:left;">
                                <div style="display:flex; align-items:center; gap:1.25rem;">
                                    <div style="width:42px; height:42px; border-radius:10px; background:${isBlocked ? 'linear-gradient(135deg, #fee2e2, #fecaca)' : 'linear-gradient(135deg, #f5f3ff, #ede9fe)'}; display:flex; align-items:center; justify-content:center; color:${isBlocked ? '#dc2626' : '#6366f1'}; font-weight:800; font-size:0.85rem; border:1px solid ${isBlocked ? '#fca5a5' : '#e0e7ff'}; box-shadow:0 2px 4px rgba(99, 102, 241, 0.05); flex-shrink:0;">
                                        ${nameInitials}
                                    </div>
                                    <div>
                                        <div style="font-weight:700; color:#1e293b; font-size:0.95rem; display:flex; align-items:center; gap:10px;">
                                            ${__esc(u.name)}
                                            <span class="adm-pill ${isBlocked ? 'adm-pill-pending' : (u.status === 'completed' || u.status === 'active' ? 'adm-pill-approved' : 'adm-pill-pending')}" style="font-size:0.6rem; padding:2px 8px; text-transform:uppercase; letter-spacing:0.02em; ${isBlocked ? 'background:#fef2f2; color:#ef4444; border:1px solid #fca5a5;' : ''}">
                                                ${isBlocked ? 'Blocked' : __esc(u.status)}
                                            </span>
                                        </div>
                                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px; font-weight:500;">${__esc(u.email)}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <div style="width:6px; height:6px; border-radius:50%; background:${isBlocked ? '#ef4444' : '#6366f1'};"></div>
                                    <span style="font-size:0.85rem; font-weight:700; color:#475569;">${__esc(u.role_name || 'Unassigned')}</span>
                                </div>
                            </td>
                            <td>
                                <span style="font-size:0.85rem; color:#475569; font-weight:600;" title="${__esc(u.institute_name || '—')}">
                                    ${__esc(u.institute_name || '—')}
                                </span>
                            </td>
                            <td style="text-align:center;">
                                <div style="display:inline-flex; align-items:center; justify-content:center; gap:8px;">
                                    <button class="adm-btn adm-btn-secondary" style="font-size:0.7rem; height:34px; padding:0 14px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-weight:700; color:#6366f1; display:flex; align-items:center; gap:6px; ${isBlocked ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor:pointer;'}" ${isBlocked ? 'disabled title="Unblock user first"' : `onclick="_manageUser('${u.email}')"`}>
                                        <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/edit-3.svg); mask-image: url(/assets/icons/edit-3.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Manage
                                    </button>
                                    <button class="adm-btn adm-btn-secondary" style="font-size:0.7rem; height:34px; padding:0 14px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-weight:700; color:#0ea5e9; display:flex; align-items:center; gap:6px; cursor:pointer;" onclick="window._viewUserProfileAndServices('${u.id}', '${u.email}')">
                                        <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/user.svg); mask-image: url(/assets/icons/user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Profile
                                    </button>
                                    <button class="adm-btn" style="font-size:0.7rem; height:34px; padding:0 12px; border-radius:8px; font-weight:700; color:${isBlocked ? '#10b981' : '#dc2626'}; border:1px solid ${isBlocked ? '#a7f3d0' : '#fecaca'}; background:${isBlocked ? '#ecfdf5' : '#fef2f2'}; display:flex; align-items:center; gap:4px; cursor:pointer;" onclick="_toggleBlockUser('${u.id}', ${isBlocked})">
                                        <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/assets/icons/${isBlocked ? 'unlock' : 'shield-off'}.svg); mask-image: url(/assets/icons/${isBlocked ? 'unlock' : 'shield-off'}.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> ${isBlocked ? 'Unblock' : 'Block'}
                                    </button>
                                </div>
                            </td>
                        </tr>`;
        }).join('')}
                    </tbody>
                </table>
            </div>` :
            `<div class="adm-empty" style="background:#fff; border:1px dashed #e2e8f0; border-radius:12px; padding:4rem 0;"><span>👤</span>No users found matching query.</div>`;
    };

    const loadUserList = async (instFilter = '', roleFilter = '') => {
        try {
            if (!_state.cachedInstitutesList || !_state.cachedRolesList) {
                const [instRes, roleRes] = await Promise.all([
                    authFetch(API.ADMIN_INSTITUTES),
                    authFetch(API.ADMIN_ROLES)
                ]);
                if (instRes.ok) {
                    const data = await instRes.json();
                    _state.cachedInstitutesList = data.all || [...(data.active || []), ...(data.pending || [])];
                }
                if (roleRes.ok) {
                    _state.cachedRolesList = await roleRes.json();
                }
            }
        } catch (err) {
            console.error('Failed to load dynamic filter lookups', err);
        }

        const instOptsHtml = (_state.cachedInstitutesList || []).map(i =>
            `<option value="${i.id}" ${instFilter == i.id ? 'selected' : ''}>${__esc(i.name)}</option>`
        ).join('');

        const roleOptsHtml = (_state.cachedRolesList || []).map(r =>
            `<option value="${r.id}" ${roleFilter == r.id ? 'selected' : ''}>${__esc(r.name)}</option>`
        ).join('');

        usersContainer.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; gap:1rem; padding:0.5rem 0;">
                <div style="font-size:0.85rem; color:#64748b; font-weight:700;">
                    Filter by Affiliation & Role:
                    <span id="user-count-badge" class="adm-pill adm-pill-approved" style="margin-left:8px; font-size:0.7rem; background:#fff;">...</span>
                </div>
                <div style="display:flex; gap:0.75rem;">
                    <select id="adm-user-list-inst-filter" class="adm-select" style="max-width:180px; height:34px; font-size:0.75rem; background:#fff; border-color:#dcd7ff; margin:0;">
                        <option value="">All Institutes</option>
                        ${instOptsHtml}
                    </select>
                    <select id="adm-user-list-role-filter" class="adm-select" style="max-width:180px; height:34px; font-size:0.75rem; background:#fff; border-color:#dcd7ff; margin:0;">
                        <option value="">All Roles</option>
                        ${roleOptsHtml}
                    </select>
                </div>
            </div>
            <div id="adm-users-actual-list">
                <div class="adm-loading"><div class="adm-spinner"></div> Loading users...</div>
            </div>
        `;

        instF = usersContainer.querySelector('#adm-user-list-inst-filter');
        roleF = usersContainer.querySelector('#adm-user-list-role-filter');

        const applyFilters = () => loadUserList(instF.value, roleF.value);
        instF.onchange = applyFilters;
        roleF.onchange = applyFilters;

        try {
            const params = new URLSearchParams();
            if (instFilter) params.append('institute_id', instFilter);
            if (roleFilter) params.append('role_id', roleFilter);

            const url = `${API.ADMIN_DATA('users')}?${params.toString()}`;
            const res = await authFetch(url);
            const usersJson = res.ok ? await res.json() : { data: [] };
            cachedUsers = usersJson.data || usersJson || [];

            renderFilteredUsers();
        } catch (err) { usersContainer.innerHTML = `Error loading users: ${err.message}`; }
    };

    const searchInput = container.querySelector('#adm-users-search-input');
    if (searchInput) {
        searchInput.oninput = () => renderFilteredUsers();
    }

    window._toggleBlockUser = async (userId, isBlocked) => {
        const targetUser = cachedUsers.find(u => String(u.id) === String(userId));
        const userName = targetUser ? targetUser.name : 'this user';

        const proceedToggle = async (reason = '') => {
            try {
                const res = await authFetch(`${BASE_URL}/api/auth/admin/users/${userId}/toggle-block`, {
                    method: 'PATCH',
                    body: JSON.stringify({ reason })
                });
                const data = await res.json();
                if (res.ok) {
                    _showToast(data.message, 'success');
                    loadUserList(instF?.value || '', roleF?.value || '');
                } else {
                    _showToast(data.error || 'Failed to update user block status', 'error');
                }
            } catch (e) {
                _showToast(e.message, 'error');
            }
        };

        if (!isBlocked) {
            const modalId = 'adm-block-reason-modal';
            let modalEl = document.getElementById(modalId);
            if (modalEl) modalEl.remove();

            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.style = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(8px);
                display: flex; align-items: center; justify-content: center;
                z-index: 99999; opacity: 0; transition: opacity 0.25s ease;
            `;

            modalEl.innerHTML = `
                <div style="background: #fff; width: 100%; max-width: 460px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; transform: scale(0.95); transition: transform 0.25s ease; border: 1px solid #e2e8f0;">
                    <div style="padding: 1.25rem 1.5rem; background: linear-gradient(to right, #fef2f2, #fff); border-bottom: 1px solid #fee2e2; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center;">
                            <span class="extracted-svg" style="width: 18px; height: 18px; display: inline-block; -webkit-mask-image: url(/assets/icons/shield-off.svg); mask-image: url(/assets/icons/shield-off.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: #991b1b;">Block User Profile</h3>
                            <p style="margin: 0; font-size: 0.65rem; color: #b91c1c; font-weight: 600;">ENFORCE SYSTEM ACCESS RESTRICTIONS</p>
                        </div>
                    </div>
                    <div style="padding: 1.5rem;">
                        <p style="margin: 0 0 1rem 0; font-size: 0.8rem; color: #475569; font-weight: 600; line-height: 1.5;">
                            You are about to block <strong style="color: #1e293b;">${__esc(userName)}</strong>. Please state the official reason for this administrative block below:
                        </p>
                        <textarea id="adm-block-reason-textarea" placeholder="e.g. Discovered multiple duplicate profiles/spam activity." style="width: 100%; height: 110px; padding: 12px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 0.8rem; resize: none; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#ef4444'"></textarea>
                        <div id="adm-block-reason-error" style="color: #ef4444; font-size: 0.75rem; font-weight: 700; margin-top: 8px; display: none;">Reason is required.</div>
                    </div>
                    <div style="padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="adm-block-cancel-btn" class="adm-btn adm-btn-secondary" style="height: 34px; font-size: 0.75rem; font-weight: 700; padding: 0 1rem; border-radius: 6px;">Cancel</button>
                        <button id="adm-block-confirm-btn" class="adm-btn" style="height: 34px; font-size: 0.75rem; font-weight: 700; padding: 0 1.25rem; border-radius: 6px; background: #dc2626; color: #fff; border: 1px solid #dc2626; cursor: pointer;">Confirm Block</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalEl);

            setTimeout(() => {
                modalEl.style.opacity = '1';
                modalEl.firstElementChild.style.transform = 'scale(1)';
            }, 50);

            const textarea = modalEl.querySelector('#adm-block-reason-textarea');
            const errorEl = modalEl.querySelector('#adm-block-reason-error');
            textarea.focus();

            const closeModal = () => {
                modalEl.style.opacity = '0';
                modalEl.firstElementChild.style.transform = 'scale(0.95)';
                setTimeout(() => modalEl.remove(), 250);
            };

            modalEl.querySelector('#adm-block-cancel-btn').onclick = closeModal;
            modalEl.querySelector('#adm-block-confirm-btn').onclick = () => {
                const val = textarea.value.trim();
                if (!val) {
                    errorEl.style.display = 'block';
                    textarea.style.borderColor = '#ef4444';
                    return;
                }
                closeModal();
                proceedToggle(val);
            };
        } else {
            if (confirm(`Are you sure you want to unblock ${userName}?`)) {
                proceedToggle();
            }
        }
    };


    window._manageUser = async (email) => {
        _showToast('Fetching user details...', 'info');

        try {
            const res = await authFetch(`${BASE_URL}/api/auth/admin/users/details?identifier=${encodeURIComponent(email)}`);
            if (!res.ok) {
                const errData = await res.json();
                _showToast(errData.error || 'Failed to fetch user details.', 'error');
                return;
            }

            const data = await res.json();

            if (data.status === 'deactivated' || data.is_blocked) {
                _showToast('This user is blocked. Unblock them first to manage their roles.', 'error');
                return;
            }

            // Populate the Assign Role Accordion on top!
            const placeholder = container.querySelector('#adm-assign-placeholder');
            const form = container.querySelector('#adm-assign-editor-form');

            if (placeholder) placeholder.style.display = 'none';
            if (form) form.style.display = 'flex';

            // Populate text inputs
            container.querySelector('#adm-editor-email').value = data.email || '';
            container.querySelector('#adm-editor-inst').value = data.institute_name || '—';
            container.querySelector('#adm-editor-cat').value = data.category_name || 'N/A';

            // Populate the role options select
            const editorRoleSelect = container.querySelector('#adm-editor-role-select');
            const existingRoleSelect = document.querySelector('#adm-m-role-select');
            if (editorRoleSelect && existingRoleSelect) {
                editorRoleSelect.innerHTML = existingRoleSelect.innerHTML;
                if (data.role_id) {
                    editorRoleSelect.value = data.role_id;
                }
            }

            // Setup LI-Coordinator Warning alert toggling and Entity Fetching
            const warningEl = container.querySelector('#adm-editor-warning');
            const entityContainer = container.querySelector('#adm-editor-entity-container');
            const entitySelect = container.querySelector('#adm-editor-entity-select');
            const entityLabel = container.querySelector('#adm-editor-entity-label');
            const subEntityContainer = container.querySelector('#adm-editor-sub-entity-container');
            const subEntitySelect = container.querySelector('#adm-editor-sub-entity-select');
            const submitBtn = container.querySelector('#adm-editor-submit-btn');
            const errorDiv = container.querySelector('#adm-editor-error');

            const checkRoleWarning = async () => {
                if (!editorRoleSelect || !warningEl) return;
                const selectedOption = editorRoleSelect.options[editorRoleSelect.selectedIndex];
                const selectedText = selectedOption ? selectedOption.textContent.trim() : '';

                // LI-Coordinator Warning
                if (selectedText === 'LI-Coordinator') {
                    warningEl.style.display = 'block';
                } else {
                    warningEl.style.display = 'none';
                }

                // Entity Dropdown Logic
                if (selectedText === 'System Lead' || selectedText === 'Subsystem Lead') {
                    if (errorDiv) {
                        errorDiv.style.display = 'none';
                        errorDiv.textContent = '';
                    }
                    submitBtn.disabled = true;
                    entityContainer.style.display = 'none';
                    if (subEntityContainer) subEntityContainer.style.display = 'none';

                    if (!data.institute_id) {
                        if (errorDiv) {
                            errorDiv.textContent = 'User has no affiliated institute. Cannot assign as a lead.';
                            errorDiv.style.display = 'block';
                        }
                        return;
                    }

                    const isSubsystemLead = selectedText === 'Subsystem Lead';

                    // Always fetch systems initially, for both System Lead and Subsystem Lead
                    const endpointUrl = `${BASE_URL}/api/reference/institutes/${data.institute_id}/systems`;

                    try {
                        const res = await authFetch(endpointUrl);
                        if (!res.ok) throw new Error('Failed to fetch systems');
                        const systems = await res.json();

                        if (systems.length === 0) {
                            if (errorDiv) {
                                errorDiv.textContent = `Cannot assign as a ${selectedText} as the institute has no active systems.`;
                                errorDiv.style.display = 'block';
                            }
                            return; // Keep submit button disabled
                        }

                        // Populate primary dropdown with systems
                        entityLabel.textContent = 'Select System';
                        entitySelect.innerHTML = '';

                        // Add a default placeholder if it's chained
                        if (isSubsystemLead) {
                            const placeholder = document.createElement('option');
                            placeholder.value = "";
                            placeholder.textContent = "-- Select a System first --";
                            placeholder.disabled = true;
                            placeholder.selected = true;
                            entitySelect.appendChild(placeholder);
                        }

                        systems.forEach(sys => {
                            const option = document.createElement('option');
                            option.value = sys.id;
                            option.textContent = sys.name + (sys.code ? ` (${sys.code})` : '');
                            entitySelect.appendChild(option);
                        });

                        entitySelect.dataset.entityType = isSubsystemLead ? 'subsystem_parent' : 'system';
                        entityContainer.style.display = 'block';

                        if (isSubsystemLead) {
                            if (subEntityContainer) {
                                subEntityContainer.style.display = 'block';
                                subEntitySelect.innerHTML = '<option value="" disabled selected>-- Select a System above --</option>';
                            }
                            submitBtn.disabled = true; // Still disabled until subsystem is chosen
                        } else {
                            submitBtn.disabled = false;
                        }

                    } catch (err) {
                        if (errorDiv) {
                            errorDiv.textContent = 'Failed to load institute systems.';
                            errorDiv.style.display = 'block';
                        }
                    }
                } else {
                    // Not a lead role
                    entityContainer.style.display = 'none';
                    if (subEntityContainer) subEntityContainer.style.display = 'none';
                    submitBtn.disabled = false;
                    if (errorDiv) {
                        errorDiv.style.display = 'none';
                    }
                }
            };

            // Add onchange listener for chained dropdowns
            if (entitySelect) {
                entitySelect.onchange = async () => {
                    const selectedText = editorRoleSelect.options[editorRoleSelect.selectedIndex]?.text;
                    if (selectedText === 'Subsystem Lead') {
                        const systemId = entitySelect.value;
                        if (!systemId) return;

                        submitBtn.disabled = true;
                        subEntitySelect.innerHTML = '<option value="" disabled selected>Loading subsystems...</option>';

                        try {
                            const res = await authFetch(`${BASE_URL}/api/reference/systems/${systemId}/subsystems`);
                            if (!res.ok) throw new Error('Failed to fetch subsystems');
                            const subsystems = await res.json();

                            if (subsystems.length === 0) {
                                subEntitySelect.innerHTML = '<option value="" disabled selected>No active subsystems found</option>';
                                return;
                            }

                            subEntitySelect.innerHTML = '<option value="" disabled selected>-- Select a Subsystem --</option>';
                            subsystems.forEach(sub => {
                                const option = document.createElement('option');
                                option.value = sub.id;
                                option.textContent = sub.name + (sub.code ? ` (${sub.code})` : '');
                                subEntitySelect.appendChild(option);
                            });

                            subEntitySelect.dataset.entityType = 'subsystem';
                            // Leave button disabled until subsystem is selected
                            submitBtn.disabled = true;

                        } catch (err) {
                            subEntitySelect.innerHTML = '<option value="" disabled selected>Failed to load subsystems</option>';
                        }
                    }
                };
            }

            if (subEntitySelect) {
                subEntitySelect.onchange = () => {
                    if (subEntitySelect.value) {
                        submitBtn.disabled = false;
                    }
                };
            }

            editorRoleSelect.onchange = checkRoleWarning;
            checkRoleWarning();

            // Clear errors
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }

            // Open the Assign Role accordion if it was closed
            if (assignEditorAccordion && !assignEditorAccordion.classList.contains('open')) {
                assignEditorAccordion.classList.add('open');
            }

            // Scroll up to the editor accordion smoothly
            assignEditorAccordion.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Setup button interactions
            const cancelBtn = container.querySelector('#adm-editor-cancel-btn');

            cancelBtn.onclick = () => {
                if (form) form.style.display = 'none';
                if (placeholder) placeholder.style.display = 'block';
                if (warningEl) warningEl.style.display = 'none';
                if (entityContainer) entityContainer.style.display = 'none';
            };

            submitBtn.onclick = async () => {
                const selectedRoleId = editorRoleSelect.value;
                const selectedText = editorRoleSelect.options[editorRoleSelect.selectedIndex]?.text;

                if (!selectedRoleId) {
                    if (errorDiv) {
                        errorDiv.textContent = 'Please select a role to assign.';
                        errorDiv.style.display = 'block';
                    }
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
                if (errorDiv) errorDiv.style.display = 'none';

                if (selectedText === 'LI-Coordinator' && data.institute_id) {
                    try {
                        const instRes = await authFetch(`${BASE_URL}/api/reference/institutes/${data.institute_id}`);
                        if (instRes.ok) {
                            const instData = await instRes.json();
                            if (!instData.has_li_coordinator) {
                                const confirmed = confirm("This institute currently doesn't have an LI-Coordinator. Do you want to add one?");
                                if (!confirmed) {
                                    submitBtn.disabled = false;
                                    submitBtn.textContent = 'Assign Role';
                                    return;
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to check institute LI-Coordinator status', e);
                    }
                }

                let payload = {
                    email: data.email,
                    role_id: selectedRoleId
                };

                if (entityContainer && entityContainer.style.display === 'block') {
                    if (selectedText === 'Subsystem Lead' && subEntityContainer && subEntityContainer.style.display === 'block') {
                        payload.entity_type = 'subsystem';
                        payload.entity_id = subEntitySelect.value;
                    } else {
                        payload.entity_type = entitySelect.dataset.entityType;
                        payload.entity_id = entitySelect.value;
                    }
                }

                try {
                    const postRes = await authFetch(`${BASE_URL}/api/auth/admin/users/assign-role`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (postRes.ok) {
                        _showToast('Role assigned successfully!', 'success');
                        if (form) form.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'block';
                        if (warningEl) warningEl.style.display = 'none';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Assign Role';
                        loadUserList(instF?.value || '', roleF?.value || '');
                    } else {
                        const errPayload = await postRes.json();
                        if (errorDiv) {
                            errorDiv.textContent = errPayload.error || 'Failed to update user role.';
                            errorDiv.style.display = 'block';
                        }
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Assign Role';
                    }
                } catch (err) {
                    console.error('Role update error:', err);
                    if (errorDiv) {
                        errorDiv.textContent = 'An unexpected network error occurred.';
                        errorDiv.style.display = 'block';
                    }
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Assign Role';
                }
            };

            _showToast('User details loaded into Editor', 'success');

        } catch (e) {
            console.error('Failed to fetch user details:', e);
            _showToast('Failed to load user details.', 'error');
        }
    };

    loadUserList();
}

async function _buildActiveUsersHtml() {
    let statuses = ['active', 'submitted', 'under_review', 'expired', 'onboarding', 'blocked', 'declined'];
    try {
        const { authFetch } = await import('../../../utils/auth.js');
        const { API } = await import('../../../config/api.js');
        const res = await authFetch(API.REFERENCE_USER_STATUSES);
        if (res && res.ok) {
            statuses = await res.json();
        }
    } catch (e) {
        console.warn('Could not fetch user statuses dynamically, using fallback', e);
    }

    const formatLabel = (s) => {
        if (s === 'under_review') return 'Under Review';
        return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const filterBtnsHtml = statuses.map(s => {
        return `<button class="adm-btn adm-btn-secondary" data-filter="${__esc(s)}" style="padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.85rem; box-shadow: none;">${__esc(formatLabel(s))}</button>`;
    }).join('');

    return `
    <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem;">
        <button id="adm-active-users-back-btn" class="adm-btn adm-btn-secondary" style="padding: 0.5rem; border-radius: 50%; width: 40px; height: 40px;">
            <span class="extracted-svg" style="-webkit-mask-image: url(/assets/icons/arrow-left.svg); mask-image: url(/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 18px; height: 18px; display: inline-block;"></span>
        </button>
        <div>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #1e293b;">User Directory</h3>
            <p style="margin: 0; font-size: 0.85rem; color: #64748b;">View and manage users by their current status.</p>
        </div>
    </div>
    
    <div style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;" id="user-directory-filters">
        ${filterBtnsHtml}
    </div>

    <div id="adm-active-users-list-container" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:1.5rem; margin-top:1rem; font-family: 'Inter', sans-serif;">
        <div class="adm-loading"><div class="adm-spinner"></div> Loading users...</div>
    </div>
    `;
}

function _wireActiveUsersSubpage(container) {
    const backBtn = container.querySelector('#adm-active-users-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            container.style.display = 'none';
            const mainContainer = container.previousElementSibling;
            if (mainContainer) mainContainer.style.display = '';
        };
    }

    const activeContainer = container.querySelector('#adm-active-users-list-container');
    if (!activeContainer) return;

    let currentFilter = 'active';

    const loadActiveUserList = async () => {
        try {
            const url = `${API.ADMIN_DATA('users')}`;
            const res = await authFetch(url);
            if (!res.ok) {
                activeContainer.innerHTML = `<div class="adm-empty" style="color:#ef4444;">Failed to load users.</div>`;
                return;
            }
            const data = await res.json();

            const grouped = [];
            const map = new Map();
            (data.data || []).forEach(u => {
                const key = u.email;
                if (map.has(key)) {
                    const existing = map.get(key);
                    if (u.role_name && !existing.roles.includes(u.role_name)) {
                        existing.roles.push(u.role_name);
                    }
                } else {
                    const copy = { ...u, roles: u.role_name ? [u.role_name] : [] };
                    grouped.push(copy);
                    map.set(key, copy);
                }
            });

            grouped.forEach(u => {
                u.role_name = u.roles.length ? u.roles.join(', ') : 'Unassigned';
            });

            const activeFiltered = grouped.filter(u => {
                if (currentFilter === 'blocked') {
                    return !!u.is_blocked;
                }
                if (currentFilter === 'declined') {
                    return u.status === 'declined' && !u.is_blocked;
                }
                if (u.is_blocked) return false;

                if (currentFilter === 'expired') {
                    return u.expired_at && new Date(u.expired_at) < new Date();
                }

                if (currentFilter === 'active') {
                    return u.status === 'active' && (!u.expired_at || new Date(u.expired_at) >= new Date());
                }

                return u.status === currentFilter;
            });

            const activeAccordionCount = container.querySelector('#active-users-list-count');
            if (activeAccordionCount) {
                activeAccordionCount.textContent = activeFiltered.length;
                activeAccordionCount.style.display = 'inline-block';
            }

            const titleEl = container.querySelector('#user-directory-title');
            if (titleEl) {
                titleEl.textContent = currentFilter.toUpperCase().replace('-', ' ') + ' USERS';
            }

            activeContainer.innerHTML = activeFiltered.length ? `
                <div class="adm-table-wrap" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; max-height:400px; overflow-y:auto; scrollbar-width:thin;">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th style="text-align:center;">User Identity</th>
                                <th>Institute / Affiliation</th>
                                <th style="text-align:center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeFiltered.map(u => {
                const nameInitials = (u.name || 'U').substring(0, 2).toUpperCase();
                return `
                                <tr>
                                    <td style="text-align:left;">
                                        <div style="display:flex; align-items:center; gap:1.25rem;">
                                            <div style="width:42px; height:42px; border-radius:10px; background:linear-gradient(135deg, #ecfdf5, #d1fae5); display:flex; align-items:center; justify-content:center; color:#10b981; font-weight:800; font-size:0.85rem; border:1px solid #a7f3d0; box-shadow:0 2px 4px rgba(16, 185, 129, 0.05); flex-shrink:0;">
                                                ${nameInitials}
                                            </div>
                                            <div>
                                                <div style="font-weight:700; color:#1e293b; font-size:0.95rem;">${__esc(u.name)}</div>
                                                <div style="font-size:0.75rem; color:#64748b; margin-top:2px; font-weight:500;">${__esc(u.email)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style="font-size:0.85rem; color:#475569; font-weight:600;" title="${__esc(u.institute_name || '—')}">
                                            ${__esc(u.institute_name || '—')}
                                        </span>
                                    </td>
                                    <td style="text-align:center;">
                                        <div style="display:inline-flex; gap:6px;">
                                            <button class="adm-btn adm-btn-secondary" style="font-size:0.7rem; height:34px; padding:0 12px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-weight:700; color:#6366f1; display:inline-flex; align-items:center; gap:5px; cursor:pointer;" onclick="window._viewUserProfile('${u.latest_application_id}', '${u.id}', '${u.email}', '${u.status}')">
                                                <span class="extracted-svg" style="width:11px; height:11px; display:inline-block; -webkit-mask-image:url(/assets/icons/user.svg); mask-image:url(/assets/icons/user.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span> Profile
                                            </button>
                                            ${(u.latest_application_id && u.latest_application_id !== 'null' && (u.status === 'active' || u.status === 'approved')) ? `
                                            <button class="adm-btn adm-btn-secondary" style="font-size:0.7rem; height:34px; padding:0 12px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; font-weight:700; color:#10b981; display:inline-flex; align-items:center; gap:5px; cursor:pointer;" onclick="window._viewUserServices('${u.id}', '${u.email}')">
                                                <span class="extracted-svg" style="width:11px; height:11px; display:inline-block; -webkit-mask-image:url(/assets/icons/layers.svg); mask-image:url(/assets/icons/layers.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span> Services
                                            </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>` :
                `<div class="adm-empty" style="background:#fff; border:1px dashed #e2e8f0; border-radius:12px; padding:4rem 0;"><span>👤</span>No users found for this filter.</div>`;
        } catch (err) {
            console.error('Active Users list error:', err);
            activeContainer.innerHTML = `<div class="adm-empty" style="color:#ef4444;">Error loading users.</div>`;
        }
    };

    // Filter colour definitions (Solid backgrounds, white text)
    const filterColours = {
        'active': { bg: '#10b981', text: '#ffffff', border: '#10b981' },
        'submitted': { bg: '#f59e0b', text: '#ffffff', border: '#f59e0b' },
        'under_review': { bg: '#3b82f6', text: '#ffffff', border: '#3b82f6' },
        'approved': { bg: '#059669', text: '#ffffff', border: '#059669' },
        'expired': { bg: '#64748b', text: '#ffffff', border: '#64748b' },
        'onboarding': { bg: '#8b5cf6', text: '#ffffff', border: '#8b5cf6' },
        'blocked': { bg: '#ef4444', text: '#ffffff', border: '#ef4444' },
        'deactivated': { bg: '#64748b', text: '#ffffff', border: '#64748b' },
        'declined': { bg: '#f43f5e', text: '#ffffff', border: '#f43f5e' }
    };

    // Wire up the filter buttons
    const filterContainer = container.querySelector('#user-directory-filters');
    if (filterContainer) {
        const buttons = filterContainer.querySelectorAll('button');

        // Initial styling application based on initial currentFilter ('active')
        buttons.forEach(b => {
            const f = b.getAttribute('data-filter');
            const colors = filterColours[f] || { bg: '#94a3b8', text: '#ffffff', border: '#94a3b8' };
            if (f === currentFilter) {
                b.style.background = colors.bg;
                b.style.color = colors.text;
                b.style.border = `1px solid ${colors.border}`;
            } else {
                b.style.background = '#f8fafc';
                b.style.color = '#64748b';
                b.style.border = '1px solid #e2e8f0';
            }
        });

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetFilter = e.target.getAttribute('data-filter');
                
                // Update styling
                buttons.forEach(b => {
                    const f = b.getAttribute('data-filter');
                    if (f === targetFilter) {
                        b.style.background = filterColours[f].bg;
                        b.style.color = filterColours[f].text;
                        b.style.border = `1px solid ${filterColours[f].border}`;
                    } else {
                        b.style.background = '#f8fafc';
                        b.style.color = '#64748b';
                        b.style.border = '1px solid #e2e8f0';
                    }
                });
                
                // Update filter and reload
                currentFilter = targetFilter;
                activeContainer.innerHTML = `<div class="adm-loading"><div class="adm-spinner"></div> Loading users...</div>`;
                loadActiveUserList();
            });
        });
    }
    
    loadActiveUserList();
}

/**
 * Opens a modal showing a user's profile and ACTIVE services only.
 * Used by the User Directory (active filter).
 */



    window._handleViewIdentityProfile = async (userId) => {
        if (!userId) return;
        _showToast('Fetching identity document...', 'info');
        try {
            const res = await authFetch(API.SECURE_FILE(userId));
            if (!res.ok) throw new Error(`Could not fetch file: ${ res.statusText }`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const overlay = document.querySelector('#adm-zoom-overlay');
            const zoomImg = document.querySelector('#adm-zoom-img');
            zoomImg.src = url;
            overlay.classList.add('open');
            document.querySelector('#adm-zoom-close-btn').onclick = () => {
                overlay.classList.remove('open');
                URL.revokeObjectURL(url);
            };
            overlay.onclick = (e) => {
                if (e.target.id === 'adm-zoom-overlay') {
                    overlay.classList.remove('open');
                    URL.revokeObjectURL(url);
                }
            };
        } catch (err) {
            _showToast(err.message, 'error');
        }
    };

    window._viewUserProfileAndServices = async (id, email) => {
        _showToast('Fetching profile...', 'info');
        try {
            const [profRes, servRes] = await Promise.all([
                authFetch(`${BASE_URL}/api/auth/admin/users/details?identifier=${encodeURIComponent(email)}`),
                authFetch(`${BASE_URL}/api/auth/admin/users/${id}/services`)
            ]);

            if (!profRes.ok || !servRes.ok) throw new Error('Failed to fetch data');

            const profile = await profRes.json();
            const services = await servRes.json();

            const mc = document.createElement('div');
            mc.innerHTML = `
        <div style="position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; animation: admFadeIn 0.2s ease;">
        <div style="background:#fff; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); width:600px; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; animation:admSlideUp 0.3s cubic-bezier(0.16,1,0.3,1); overflow:hidden;">

            <!-- Header -->
            <div style="padding:1.5rem; background:linear-gradient(to right, #f8fafc, #fff); border-bottom:1px solid #e2e8f0; display:flex; align-items:flex-start; justify-content:space-between;">
                <div style="display:flex; gap:16px; align-items:center;">
                    <div style="width:56px; height:56px; border-radius:12px; background:linear-gradient(135deg, #e0e7ff, #c7d2fe); color:#4f46e5; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:800; flex-shrink:0;">
                        ${ (profile.name || '').substring(0, 2).toUpperCase() }
                    </div>
                    <div>
                        <h3 style="margin:0 0 4px 0; font-size:1.2rem; color:#0f172a; font-weight:800;">${ __esc(profile.name) }</h3>
                        <div style="color:#64748b; font-size:0.85rem; font-weight:500;">${ __esc(profile.email) }</div>
                        <div style="margin-top:6px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            ${ (profile.roles && profile.roles.length > 0) ? profile.roles.map(r => `
                                            <span class="adm-pill adm-pill-approved" style="font-size:0.65rem; display:flex; align-items:center; gap:4px; padding-right:4px;">
                                                ${__esc(r.role_name)}
                                                <button class="rm-role-btn" data-roleid="${r.role_id}" style="background:none; border:none; color:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:2px; border-radius:50%; opacity:0.7;" onmouseover="this.style.opacity='1'; this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.opacity='0.7'; this.style.background='none'">
                                                    <span class="extracted-svg" style="width:10px; height:10px; display:inline-block; -webkit-mask-image:url(/assets/icons/x.svg); mask-image:url(/assets/icons/x.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                                </button>
                                            </span>
                                        `).join('') : `<span class="adm-pill adm-pill-pending" style="font-size:0.65rem;">No Role</span>` }
                            <span class="adm-pill" style="font-size:0.65rem; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;">${ __esc(profile.institute_name || 'No Institute') }</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="adm-btn adm-btn-secondary" style="font-size:0.75rem; padding:6px 12px; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; font-weight:700; color:#3b82f6; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" onclick="window._handleViewIdentityProfile('${id}')">
                        <span class="extracted-svg" style="width:12px; height:12px; display:inline-block; -webkit-mask-image:url(/assets/icons/file.svg); mask-image:url(/assets/icons/file.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span> ID Card
                    </button>
                    <button id="pmodal-close" style="background:none; border:none; cursor:pointer; padding:8px; color:#94a3b8;">
                        <span class="extracted-svg" style="width:20px; height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/x.svg); mask-image:url(/assets/icons/x.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div style="padding:1.5rem; overflow-y:auto; flex:1;">
                <h4 style="margin:0 0 1rem 0; font-size:0.9rem; color:#475569; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;">Active & Expired Services</h4>
                ${ services.length === 0 ? `
                                <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; padding:2rem; text-align:center; color:#64748b; font-size:0.85rem;">
                                    This user currently has no assigned services or subservices.
                                </div>
                            ` : `
                                <div style="display:flex; flex-direction:column; gap:12px;">
                                    ${services.map(s => {
                    const isExpired = new Date(s.expires_at) < new Date();
                    return `
                                        <div style="border:1px solid #e2e8f0; border-radius:10px; padding:1rem; display:flex; align-items:center; justify-content:space-between; background:${isExpired ? '#fef2f2' : '#fff'}; transition:box-shadow 0.2s;">
                                            <div>
                                                <div style="font-weight:700; color:#1e293b; font-size:0.95rem; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                                                    ${__esc(s.name)}
                                                    <span style="font-size:0.6rem; padding:2px 6px; border-radius:4px; background:${s.type === 'service' ? '#e0e7ff' : '#fce7f3'}; color:${s.type === 'service' ? '#4338ca' : '#be185d'}; font-weight:700; text-transform:uppercase;">${s.type}</span>
                                                </div>
                                                <div style="font-size:0.75rem; color:#64748b;">
                                                    <strong>Granted:</strong> ${new Date(s.granted_at).toLocaleDateString()} &nbsp;|&nbsp; 
                                                    <strong>Expires:</strong> <span style="color:${isExpired ? '#ef4444' : '#10b981'}; font-weight:600;">${s.expires_at ? new Date(s.expires_at).toLocaleDateString() : 'Never'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                ${isExpired ? `
                                                    <button class="adm-btn serv-renew-btn" data-assign="${s.assignment_id}" data-type="${s.type}" style="padding:6px 12px; font-size:0.75rem; border-radius:6px; background:#10b981; color:#fff; font-weight:700; border:none; cursor:pointer;">
                                                        Renew
                                                    </button>
                                                ` : `
                                                    <button class="adm-btn serv-remove-btn" data-assign="${s.assignment_id}" data-type="${s.type}" style="padding:6px 12px; font-size:0.75rem; border-radius:6px; background:#fef2f2; border:1px solid #fecaca; color:#ef4444; font-weight:700; cursor:pointer;">
                                                        Remove
                                                    </button>
                                                `}
                                            </div>
                                        </div>
                                        `;
                }).join('')}
                                </div>
                            `}
            </div>
        </div>
                </div>
            `;
            document.body.appendChild(mc);

            const close = () => {
                mc.firstElementChild.style.opacity = '0';
                setTimeout(() => mc.remove(), 200);
            };

            mc.querySelector('#pmodal-close').onclick = close;
            mc.querySelector('div').addEventListener('click', (e) => { if (e.target === mc.firstElementChild) close(); });

            // Attach Role Remove Events
            mc.querySelectorAll('.rm-role-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Are you sure you want to deactivate this role for the user?')) return;
                    const roleId = btn.dataset.roleid;
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    try {
                        const r = await authFetch(`${BASE_URL}/api/auth/admin/users/${id}/roles/${roleId}`, {
                            method: 'DELETE'
                        });
                        if (r.ok) { 
                            _showToast('Role deactivated successfully', 'info'); 
                            close(); 
                            window._viewUserProfileAndServices(id, email); 
                        } else {
                            const errData = await r.json();
                            throw new Error(errData.error || 'Failed to deactivate role');
                        }
                    } catch (e) {
                        _showToast(e.message, 'error');
                        btn.disabled = false; 
                        btn.style.opacity = '0.7';
                    }
                };
            });

            // Attach Renew Events
            mc.querySelectorAll('.serv-renew-btn').forEach(btn => {
                btn.onclick = async () => {
                    const assignId = btn.dataset.assign;
                    const type = btn.dataset.type;
                    btn.disabled = true;
                    btn.textContent = '...';
                    try {
                        const r = await authFetch(`${BASE_URL}/api/auth/admin/users/${id}/services/${assignId}/renew`, {
                            method: 'PATCH',
                            body: JSON.stringify({ type })
                        });
                        if (r.ok) { _showToast('Service renewed for 1 year', 'success'); close(); window._viewUserProfileAndServices(id, email); }
                        else throw new Error('Failed to renew');
                    } catch (e) {
                        _showToast(e.message, 'error');
                        btn.disabled = false; btn.textContent = 'Renew';
                    }
                };
            });

            // Attach Remove Events
            mc.querySelectorAll('.serv-remove-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Are you sure you want to remove this service?')) return;
                    const assignId = btn.dataset.assign;
                    const type = btn.dataset.type;
                    btn.disabled = true;
                    btn.textContent = '...';
                    try {
                        const r = await authFetch(`${BASE_URL}/api/auth/admin/users/${id}/services/${assignId}`, {
                            method: 'DELETE',
                            body: JSON.stringify({ type })
                        });
                        if (r.ok) { _showToast('Service removed', 'info'); close(); window._viewUserProfileAndServices(id, email); }
                        else throw new Error('Failed to remove');
                    } catch (e) {
                        _showToast(e.message, 'error');
                        btn.disabled = false; btn.textContent = 'Remove';
                    }
                };
            });

        } catch (err) {
            _showToast(err.message, 'error');
        }
    };


window._viewUserServices = async (id, email) => {


    try {
        const res = await authFetch(`${BASE_URL}/api/auth/admin/users/${id}/services`);
        if (!res.ok) throw new Error('Failed to fetch services');
        const services = await res.json();

        const mc = document.createElement('div');
        mc.innerHTML = `
        <style>
            .adm-service-acc details[open] summary { background: #eff6ff!important; border-bottom-color: #bfdbfe!important; }
            .adm-service-acc summary::marker, .adm-service-acc summary::-webkit-details-marker { display: none; }
            .adm-service-acc summary { user-select: none; }
            .adm-service-acc-icon { transition: transform 0.2s; }
            .adm-service-acc details[open] .adm-service-acc-icon { transform: rotate(180deg); }
        </style>
        <div style="position:fixed; inset:0; z-index:9500; kground:rgba(15,23,42,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; animation: admFadeIn 0.2s ease;">
            <div style="background:#fff; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); width:650px; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; animation:admSlideUp 0.3s cubic-bezier(0.16,1,0.3,1); overflow:hidden;">

                <div style="padding:1.5rem; background:#fff; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between;">
                    <h3 style="margin:0; font-size:1.15rem; color:#0f172a; font-weight:800; display:flex; align-items:center; gap:10px;">
                        <span class="extracted-svg" style="width:20px;height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/layers.svg); mask-image:url(/assets/icons/layers.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:#10b981;"></span>
                        Active & Expired Servicesbac
                    </h3>
                    <button class="adm-btn serv-close-btn" style="background:transparent; color:#94a3b8; border:none; cursor:pointer; padding:4px;">
                        <span class="extracted-svg" style="width:20px;height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/x.svg); mask-image:url(/assets/icons/x.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                    </button>
                </div>

                <div style="flex:1; overflow-y:auto; padding:1.5rem;" class="adm-service-acc">
                    <div style="display:flex; flex-direction:column; gap:0.75rem;">
                        ${ services.length > 0 ? services.map(s => `
                                <details style="border:1px solid #e2e8f0; border-radius:10px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.02); overflow:hidden;">
                                    <summary style="padding:1rem 1.25rem; cursor:pointer; display:flex; align-items:center; justify-content:space-between; background:#fff; transition:all 0.2s; list-style:none; outline:none; border-bottom:1px solid transparent;">
                                        <div style="display:flex; align-items:center; gap:1rem;">
                                            <div style="width:40px; height:40px; border-radius:8px; background:${s.type === 'service' ? '#eef2ff' : '#fdf2f8'}; color:${s.type === 'service' ? '#4f46e5' : '#db2777'}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                                <span class="extracted-svg" style="width:20px;height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/${s.type === 'service' ? 'server.svg' : 'box.svg'}); mask-image:url(/assets/icons/${s.type === 'service' ? 'server.svg' : 'box.svg'}); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                            </div>
                                            <div>
                                                <div style="font-weight:800; color:#0f172a; font-size:1rem; display:flex; align-items:center; gap:0.5rem;">
                                                    ${__esc(s.name)}
                                                    ${s.is_active === 0 ? `<span style="font-size:0.65rem; background:#fee2e2; color:#991b1b; padding:0.15rem 0.4rem; border-radius:4px; font-weight:800; text-transform:uppercase;">Inactive</span>` :
                                (s.expires_at && new Date(s.expires_at) < new Date() ? `<span style="font-size:0.65rem; background:#ffedd5; color:#c2410c; padding:0.15rem 0.4rem; border-radius:4px; font-weight:800; text-transform:uppercase;">Expired</span>` :
                                    `<span style="font-size:0.65rem; background:#dcfce7; color:#166534; padding:0.15rem 0.4rem; border-radius:4px; font-weight:800; text-transform:uppercase;">Active</span>`)}
                                                </div>
                                                <div style="font-size:0.7rem; color:${s.type === 'service' ? '#6366f1' : '#ec4899'}; margin-top:4px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; display:inline-block; padding:0.15rem 0.5rem; background:${s.type === 'service' ? '#e0e7ff' : '#fce7f3'}; border-radius:12px;">${__esc(s.type)}</div>
                                            </div>
                                        </div>
                                        <div style="color:#94a3b8; display:flex; align-items:center;">
                                            <span class="extracted-svg adm-service-acc-icon" style="width:20px;height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/chevron-down.svg); mask-image:url(/assets/icons/chevron-down.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                        </div>
                                    </summary>
                                    <div style="padding:1.25rem; background:#f8fafc; display:flex; align-items:center; justify-content:space-between; gap:1rem;">
                                        <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                            <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:#334155;">
                                                <span class="extracted-svg" style="width:14px;height:14px; display:inline-block; -webkit-mask-image:url(/assets/icons/calendar.svg); mask-image:url(/assets/icons/calendar.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:#94a3b8;"></span>
                                                <span style="font-weight:600;">Granted:</span> ${new Date(s.granted_at).toLocaleDateString('en-GB')}
                                            </div>
                                            <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:${s.expires_at && new Date(s.expires_at) < new Date() ? '#ef4444' : '#334155'};">
                                                <span class="extracted-svg" style="width:14px;height:14px; display:inline-block; -webkit-mask-image:url(/assets/icons/clock.svg); mask-image:url(/assets/icons/clock.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                                <span style="font-weight:600;">Expires:</span> ${s.expires_at ? new Date(s.expires_at).toLocaleDateString('en-GB') : 'Never'}
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:0.5rem;">
                                            ${s.is_active === 0 || (s.expires_at && new Date(s.expires_at) < new Date()) ? `<button class="adm-btn serv-renew-btn" data-assign="${s.assignment_id}" data-type="${s.type}" style="padding:0.5rem 1rem; font-size:0.8rem; font-weight:800; border-radius:8px; background:#10b981; color:#fff; border:none; cursor:pointer; box-shadow:0 2px 4px rgba(16,185,129,0.2);">Renew 1Yr</button>` : ''}
                                            ${s.is_active === 1 ? `<button class="adm-btn serv-remove-btn" data-assign="${s.assignment_id}" data-type="${s.type}" style="padding:0.5rem 1rem; font-size:0.8rem; font-weight:800; border-radius:8px; background:#ef4444; color:#fff; border:none; cursor:pointer; box-shadow:0 2px 4px rgba(239,68,68,0.2);">Remove Access</button>` : ''}
                                        </div>
                                    </div>
                                </details>
                            `).join('') : `<div class="adm-empty" style="color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; padding:3rem; border-radius:12px;">No services assigned to this user.</div>` }
                    </div>
                </div>
            </div>
        </div>`;

        document.body.appendChild(mc);
        const close = () => { mc.firstElementChild.style.opacity='0'; setTimeout(()=>mc.remove(),200); };
        mc.querySelector('.serv-close-btn').onclick = close;
        mc.onclick = (e) => { if(e.target===mc.firstElementChild) close(); };

        mc.querySelectorAll('.serv-renew-btn').forEach(btn => {
            btn.onclick = async () => {
                const assignId = btn.dataset.assign;
                const type = btn.dataset.type;
                btn.disabled = true;
                btn.textContent = '...';
                try {
                    const r = await authFetch(`${BASE_URL}/api/auth/admin/users/${id}/services/${assignId}/renew`, {
                        method: 'PATCH',
                        body: JSON.stringify({ type })
                    });
if (r.ok) { _showToast('Service renewed for 1 year', 'success'); close(); window._viewUserServices(id, email); }
else throw new Error('Failed to renew');
                } catch (e) {
    _showToast(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Renew 1Yr';
}
            };
        });

mc.querySelectorAll('.serv-remove-btn').forEach(btn => {
    btn.onclick = async () => {
        if (!confirm('Are you sure you want to remove this service?')) return;
        const assignId = btn.dataset.assign;
        const type = btn.dataset.type;
        btn.disabled = true;
        btn.textContent = '...';
        try {
            const r = await authFetch(`${BASE_URL}/api/auth/admin/users/${id}/services/${assignId}`, {
                method: 'DELETE',
                body: JSON.stringify({ type })
            });
            if (r.ok) { _showToast('Service removed', 'info'); close(); window._viewUserServices(id, email); }
            else throw new Error('Failed to remove');
        } catch (e) {
            _showToast(e.message, 'error');
            btn.disabled = false; btn.textContent = 'Remove';
        }
    };
});
    } catch (err) {
    _showToast(err.message, 'error');
}
};


window._admCarouselNext = (btn) => {
    const carousel = btn.closest('div[style*="position:relative"]').querySelector('.adm-app-carousel');
    const slides = Array.from(carousel.children);
    let activeIdx = slides.findIndex(s => s.style.display === 'block');
    slides[activeIdx].style.display = 'none';
    activeIdx = (activeIdx + 1) % slides.length;
    slides[activeIdx].style.display = 'block';
};
window._admCarouselPrev = (btn) => {
    const carousel = btn.closest('div[style*="position:relative"]').querySelector('.adm-app-carousel');
    const slides = Array.from(carousel.children);
    let activeIdx = slides.findIndex(s => s.style.display === 'block');
    slides[activeIdx].style.display = 'none';
    activeIdx = (activeIdx - 1 + slides.length) % slides.length;
    slides[activeIdx].style.display = 'block';
};

window._viewUserProfile = async (latestAppId, userId, email, userStatus) => {


    try {
        let applicantHtml = '';
        let hasProfile = false;

        if (userId && userId !== 'null' && userId !== 'undefined') {
            try {
                const { API } = await import('../../../config/api.js');
                const pRes = await authFetch(API.APPLICANT_PROFILE(userId));
                if (pRes.ok) {
                    const profileData = await pRes.json();
                    hasProfile = true;
                    const formatDt = (dt) => {
                        if (!dt) return '—';
                        return new Date(dt).toLocaleDateString('en-GB');
                    };

                    applicantHtml = `
                    <div style="background:#f8fafc; border-radius:12px; padding:1.5rem; border:1px solid #e2e8f0; height:100%;">
                        <h4 style="margin:0 0 1rem 0; font-size:1.05rem; font-weight:800; color:#0f172a; border-bottom:2px solid #eef2ff; padding-bottom:0.5rem;">Applicant Profile</h4>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                            <div><div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:700;">Email</div><div style="font-size:0.85rem; color:#1e293b; font-weight:600; word-break:break-all;">${__esc(profileData.email || '—')}</div></div>
                            <div><div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:700;">Phone</div><div style="font-size:0.85rem; color:#1e293b; font-weight:600;">${__esc(profileData.phone_number || '—')}</div></div>
                            <div><div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:700;">Gender</div><div style="font-size:0.85rem; color:#1e293b; font-weight:600;">${__esc(profileData.gender || '—')}</div></div>
                            <div><div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:700;">DOB</div><div style="font-size:0.85rem; color:#1e293b; font-weight:600;">${__esc(formatDt(profileData.date_of_birth))}</div></div>
                            <div style="grid-column: span 2;"><div style="font-size:0.7rem; color:#64748b; text-transform:uppercase; font-weight:700;">Country</div><div style="font-size:0.85rem; color:#1e293b; font-weight:600;">${__esc(profileData.country_name || '—')}</div></div>
                        </div>

                        <h4 style="margin:0 0 0.75rem 0; font-size:0.9rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Affiliation</h4>
                        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; box-shadow:0 1px 2px rgba(0,0,0,0.02); margin-bottom:1.5rem;">
                            <div style="font-weight:700; color:#0f172a; font-size:0.85rem;">${__esc(profileData.institute_name || profileData.other_institute || '—')}</div>
                            <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">${__esc(profileData.designation || '—')}</div>
                        </div>

                        ${profileData.highest_qualification ? `
                        <h4 style="margin:0 0 0.75rem 0; font-size:0.9rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Qualification</h4>
                        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; box-shadow:0 1px 2px rgba(0,0,0,0.02); margin-bottom:1.5rem;">
                            <div style="font-weight:700; color:#0f172a; font-size:0.85rem;">${__esc(profileData.highest_qualification)} in ${__esc(profileData.field_of_study || '—')}</div>
                            <div style="font-size:0.75rem; color:#64748b; margin-top:0.25rem;">${__esc(profileData.university || '—')} &bull; ${__esc(profileData.graduation_year || '—')}</div>
                        </div>
                        ` : ''}
                    </div>
                    `;
                }
            } catch (e) {
                console.warn('Failed to fetch applicant profile', e);
            }
        }

        let contentHtml = '';
        if (!latestAppId || latestAppId === 'null' || latestAppId === 'undefined') {
            // User has no application, fallback to basic profile info
            const res = await authFetch(`${BASE_URL}/api/auth/admin/users/details?identifier=${encodeURIComponent(email)}`);
            let p = { email, name: email.split('@')[0] };
            if (res.ok) p = await res.json();

            if (userStatus === 'under_review' || userStatus === 'submitted') {
                contentHtml = `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                    <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
                        ${__esc((p.name || '?')[0].toUpperCase())}
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${__esc(p.name || '—')}</div>
                        <div style="color:#64748b;font-size:0.85rem;">${__esc(p.email || '')}</div>
                    </div>
                </div>
                <div class="adm-empty" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:1rem; padding:3rem 2rem;">
                    <div style="width:64px;height:64px;border-radius:50%;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                        <span class="extracted-svg" style="width:32px;height:32px; display:inline-block; -webkit-mask-image:url(/assets/icons/clock.svg); mask-image:url(/assets/icons/clock.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                    </div>
                    <div style="font-size:1.15rem; font-weight:800; color:#1e40af; margin-bottom:0.5rem;">Awaiting 1st Authority Approval</div>
                    <div style="color:#1d4ed8; font-size:0.9rem; margin-bottom:1.5rem; max-width:400px; margin-left:auto; margin-right:auto;">This user has submitted their profile and is currently waiting for their account activation application to be approved by the 1st authority.</div>
                </div>`;
            } else if (userStatus === 'onboarding') {
                contentHtml = `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                    <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
                        ${__esc((p.name || '?')[0].toUpperCase())}
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${__esc(p.name || '—')}</div>
                        <div style="color:#64748b;font-size:0.85rem;">${__esc(p.email || '')}</div>
                    </div>
                </div>
                <div class="adm-empty" style="background:#fdf2f8; border:1px solid #fbcfe8; border-radius:1rem; padding:3rem 2rem;">
                    <div style="width:64px;height:64px;border-radius:50%;background:#fce7f3;color:#db2777;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                        <span class="extracted-svg" style="width:32px;height:32px; display:inline-block; -webkit-mask-image:url(/assets/icons/edit-3.svg); mask-image:url(/assets/icons/edit-3.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                    </div>
                    <div style="font-size:1.15rem; font-weight:800; color:#9d174d; margin-bottom:0.5rem;">Registration Form is Pending</div>
                    <div style="color:#be185d; font-size:0.9rem; margin-bottom:1.5rem; max-width:400px; margin-left:auto; margin-right:auto;">This user is currently in the onboarding stage and has not yet submitted their registration form.</div>
                </div>`;
            } else if (hasProfile) {
                // User has profile but no active application
                contentHtml = `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                    <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
                        ${__esc((p.name || '?')[0].toUpperCase())}
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${__esc(p.name || '—')}</div>
                        <div style="color:#64748b;font-size:0.85rem;">${__esc(p.email || '')}</div>
                    </div>
                </div>
                <div class="adm-empty" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:1rem; padding:3rem 2rem;">
                    <div style="width:64px;height:64px;border-radius:50%;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                        <span class="extracted-svg" style="width:32px;height:32px; display:inline-block; -webkit-mask-image:url(/assets/icons/file-minus.svg); mask-image:url(/assets/icons/file-minus.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                    </div>
                    <div style="font-size:1.15rem; font-weight:800; color:#334155; margin-bottom:0.5rem;">No Active Application</div>
                    <div style="color:#64748b; font-size:0.9rem; margin-bottom:1.5rem; max-width:400px; margin-left:auto; margin-right:auto;">This user has successfully completed their Applicant Profile, but they have not submitted any active applications yet.</div>
                </div>`;
            } else {
                // User has NO profile and NO application
                contentHtml = `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                    <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
                        ${__esc((p.name || '?')[0].toUpperCase())}
                    </div>
                    <div>
                        <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${__esc(p.name || '—')}</div>
                        <div style="color:#64748b;font-size:0.85rem;">${__esc(p.email || '')}</div>
                    </div>
                </div>
                <div class="adm-empty" style="background:#fffbeb; border:1px solid #fde68a; border-radius:1rem; padding:3rem 2rem;">
                    <div style="width:64px;height:64px;border-radius:50%;background:#fef3c7;color:#d97706;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                        <span class="extracted-svg" style="width:32px;height:32px; display:inline-block; -webkit-mask-image:url(/assets/icons/alert-circle.svg); mask-image:url(/assets/icons/alert-circle.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                    </div>
                    <div style="font-size:1.15rem; font-weight:800; color:#92400e; margin-bottom:0.5rem;">Applicant Information Missing</div>
                    <div style="color:#b45309; font-size:0.9rem; margin-bottom:1.5rem; max-width:400px; margin-left:auto; margin-right:auto;">This user has registered but has not yet submitted a formal application. Please notify them to complete their profile.</div>
                    <a href="mailto:${__esc(p.email)}?subject=Please%20complete%20your%20application%20profile&body=Dear%20${__esc(p.name || 'User')},%0A%0APlease%20log%20in%20and%20complete%20your%20application%20profile.%0A%0AThank%20you." class="adm-btn" style="background:linear-gradient(135deg, #d97706, #b45309); color:white; border:none; padding:0.6rem 1.5rem; box-shadow:0 4px 12px rgba(217,119,6,0.25); text-decoration:none; display:inline-flex; align-items:center; gap:8px;">
                        <span class="extracted-svg" style="width:16px;height:16px; display:inline-block; -webkit-mask-image:url(/assets/icons/mail.svg); mask-image:url(/assets/icons/mail.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                        Send Email Reminder
                    </a>
                </div>`;
            }
        } else {
            // Fetch ALL applications for this user
            const appsRes = await authFetch(`${BASE_URL}/api/auth/admin/applications?user_id=${userId}`);
            let appIds = [latestAppId];
            if (appsRes.ok) {
                const appsData = await appsRes.json();
                if (appsData.applications && appsData.applications.length > 0) {
                    appIds = appsData.applications.map(app => app.id);
                }
            }

            // Fetch trackers for ALL appIds concurrently
            const trackers = await Promise.all(appIds.map(async id => {
                const res = await authFetch(`${BASE_URL}/api/auth/admin/applications/${id}/tracker`);
                if (res.ok) {
                    const data = await res.json();
                    return data.application;
                }
                return null;
            }));

            const validTrackers = trackers.filter(t => t !== null);
            if (validTrackers.length === 0) throw new Error('Failed to fetch application data');

            let sliderHtml = '';
            validTrackers.forEach((a, i) => {
                const rows = [
                    ['Application ID', `<span style="font-family:monospace;font-weight:700;color:#6366f1;background:#eef2ff;padding:0.15rem 0.4rem;border-radius:0.3rem;">${__esc(a.application_id || a.id)}</span>`],
                    ['Applicant', __esc(a.applicant_name)],
                    ['Email', __esc(a.applicant_email)],
                    ['Institute', __esc(a.institute_name)],
                    ['Category', __esc(a.category_name)],
                    ['Workflow', __esc(a.workflow_name)],
                    ['Request Type', __esc(a.request_name)],
                    ['Current Status', __esc(a.current_status)],
                    ['LIGO Member', __esc(a.ligo_member)],
                    ['Duration', __esc(a.duration)],
                    ['Submitted', a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-GB') : '—'],
                    ['Approved By', __esc(a.approved_by_name)],
                    ['Approved At', a.approved_at ? new Date(a.approved_at).toLocaleDateString('en-GB') : '—'],
                ].filter(([, v]) => v && v !== '—');

                const trkHtml = `
                    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                        <div style="width:48px;height:48px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#6366f1;">
                            ${__esc((a.applicant_name || '?')[0].toUpperCase())}
                        </div>
                        <div>
                            <div style="font-weight:700;font-size:1.1rem;color:#0f172a;">${__esc(a.applicant_name || '—')}</div>
                            <div style="color:#64748b;font-size:0.85rem;">${__esc(a.applicant_email || '')}</div>
                        </div>
                        ${(() => {
                        const sc = {
                            'active': { bg: '#dcfce7', color: '#166534' },
                            'submitted': { bg: '#fef3c7', color: '#92400e' },
                            'under_review': { bg: '#dbeafe', color: '#1e40af' },
                            'approved': { bg: '#dcfce7', color: '#166534' },
                            'expired': { bg: '#f1f5f9', color: '#475569' },
                            'onboarding': { bg: '#f3e8ff', color: '#6b21a8' },
                            'blocked': { bg: '#fee2e2', color: '#991b1b' },
                            'deactivated': { bg: '#f1f5f9', color: '#475569' },
                            'declined': { bg: '#fee2e2', color: '#991b1b' }
                        }[a.status] || { bg: '#f1f5f9', color: '#475569' };
                        const lbl = a.status === 'under_review' ? 'Under Review' : (a.status ? a.status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '');
                        return `<span style="margin-left:auto; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; padding:0.25rem 0.6rem; border-radius:12px; background:${sc.bg}; color:${sc.color};">${__esc(lbl)}</span>`;
                    })()}
                    </div>
                    <dl style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem 1.5rem;">
                    ${rows.map(([label, value]) => `
                        <div>
                            <dt style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;">${__esc(label)}</dt>
                            <dd style="font-size:0.9rem;color:#334155;margin:0.2rem 0 0;">${value}</dd>
                        </div>`).join('')}
                    </dl>

                    ${(a.past_reviewers && a.past_reviewers.length > 0) ? `
                    <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px dashed #cbd5e1;">
                        <h4 style="margin:0 0 1rem 0; font-size:0.95rem; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em;">Approvals So Far</h4>
                        <div style="display:flex; flex-direction:column; gap:0.75rem;">
                            ${a.past_reviewers.map(pr => `
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">${__esc(pr.name)} <span style="font-size:0.75rem; color:#64748b; font-weight:600; background:#e2e8f0; padding:0.1rem 0.4rem; border-radius:4px; margin-left:0.5rem;">${__esc(pr.role)}</span></div>
                                        <div style="font-size:0.8rem; color:#10b981; font-weight:700; margin-top:0.25rem;">✓ ${__esc(pr.action)}</div>
                                    </div>
                                    <div style="font-size:0.75rem; color:#64748b; font-weight:600;">
                                        ${pr.date ? new Date(pr.date).toLocaleDateString('en-GB') : '—'}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}

                    ${a.id_card_path ? `
                    <div style="margin-top:2rem;padding:1.25rem;background:#f8fafc;border-radius:0.75rem;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
                        <div style="display:flex;align-items:center;gap:0.75rem;color:#475569;">
                            <div style="width:40px;height:40px;border-radius:50%;background:#e0f2fe;display:flex;align-items:center;justify-content:center;color:#0ea5e9;">
                                <span class="extracted-svg" style="width:20px;height:20px; display: inline-block; -webkit-mask-image: url(/assets/icons/file-text.svg); mask-image: url(/assets/icons/file-text.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:0.9rem;color:#0f172a;">Identity Document</div>
                                <div style="font-size:0.75rem;color:#64748b;">Verification required for approval</div>
                            </div>
                        </div>
                        <button class="adm-btn adm-btn-primary adm-check-identity-btn" data-uid="${a.applicant_user_id || a.user_id}">
                            <span class="extracted-svg" style="width:16px;height:16px;margin-right:0.4rem; display: inline-block; -webkit-mask-image: url(/assets/icons/eye.svg); mask-image: url(/assets/icons/eye.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                            Check Identity
                        </button>
                    </div>` : ''}
                `;
                sliderHtml += `<div class="adm-app-slide" style="display:${i === 0 ? 'block' : 'none'}; width:100%;" data-slide-index="${i}">${trkHtml}</div>`;
            });

            if (validTrackers.length > 1) {
                contentHtml = `
                <div style="position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:1rem; border-bottom:2px solid #eef2ff;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:#0f172a;">Applications (${validTrackers.length})</h4>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick="window._admCarouselPrev(this)" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.4rem 0.6rem; cursor:pointer; color:#64748b; font-weight:600; font-size:0.8rem; display:flex; align-items:center; outline:none; box-shadow:none;">
                                <span class="extracted-svg" style="width:14px;height:14px; margin-right:4px; display:inline-block; -webkit-mask-image:url(/assets/icons/chevron-left.svg); mask-image:url(/assets/icons/chevron-left.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span> Prev
                            </button>
                            <button onclick="window._admCarouselNext(this)" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.4rem 0.6rem; cursor:pointer; color:#64748b; font-weight:600; font-size:0.8rem; display:flex; align-items:center; outline:none; box-shadow:none;">
                                Next <span class="extracted-svg" style="width:14px;height:14px; margin-left:4px; display:inline-block; -webkit-mask-image:url(/assets/icons/chevron-right.svg); mask-image:url(/assets/icons/chevron-right.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                            </button>
                        </div>
                    </div>
                    <div class="adm-app-carousel">
                        ${sliderHtml}
                    </div>
                </div>
                `;
            } else {
                contentHtml = sliderHtml;
            }
        }



        const mc = document.createElement('div');
        mc.innerHTML = `
            <div style="position:fixed; inset:0; z-index:9500; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; animation: admFadeIn 0.2s ease;">
                <div style="background:#fff; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); width:${applicantHtml ? '1000px' : '600px'}; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; animation:admSlideUp 0.3s cubic-bezier(0.16,1,0.3,1); overflow:hidden;">
                    
                    <div style="padding:1.5rem; background:linear-gradient(to right, #f8fafc, #fff); border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between;">
                        <h3 style="margin:0; font-size:1.15rem; color:#0f172a; font-weight:800; display:flex; align-items:center; gap:10px;">
                            <span class="extracted-svg" style="width:20px;height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/user.svg); mask-image:url(/assets/icons/user.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:#6366f1;"></span>
                            User Profile
                        </h3>
                        <button class="adm-btn prof-close-btn" style="background:transparent; color:#94a3b8; border:none; cursor:pointer; padding:4px;">
                            <span class="extracted-svg" style="width:20px;height:20px; display:inline-block; -webkit-mask-image:url(/assets/icons/x.svg); mask-image:url(/assets/icons/x.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                        </button>
                    </div>

                    <div style="flex:1; overflow-y:auto; padding:1.5rem;">
                        ${applicantHtml ? `
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
                                <div>${contentHtml}</div>
                                <div>${applicantHtml}</div>
                            </div>
                        ` : contentHtml}
                    </div>
                </div>
            </div>`;

        document.body.appendChild(mc);
        const close = () => { mc.firstElementChild.style.opacity = '0'; setTimeout(() => mc.remove(), 200); };
        mc.querySelector('.prof-close-btn').onclick = close;
        mc.onclick = (e) => { if (e.target === mc.firstElementChild) close(); };

        const idBtn = mc.querySelector('.adm-check-identity-btn');
        if (idBtn) {
            idBtn.addEventListener('click', () => {
                if (window._handleViewIdentityProfile) {
                    window._handleViewIdentityProfile(idBtn.dataset.uid);
                }
            });
        }
    } catch (err) {
        _showToast(err.message, 'error');
    }
};

