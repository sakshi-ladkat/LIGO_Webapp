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
    { key: 'users_roles', label: 'Users', fullLabel: 'Users & Roles', desc: 'Manage system users and assign roles', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/users_roles.svg); mask-image: url(/public/assets/icons/users_roles.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'categories', label: 'Categories', fullLabel: 'Category Management', desc: 'Define new academic or organizational groups', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/categories.svg); mask-image: url(/public/assets/icons/categories.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'services', label: 'Services', fullLabel: 'Services Management', desc: 'Manage system services and their details', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/services.svg); mask-image: url(/public/assets/icons/services.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'systems', label: 'Systems', fullLabel: 'Systems Management', desc: 'Manage systems and their configurations', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/systems.svg); mask-image: url(/public/assets/icons/systems.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'requests', label: 'Requests', fullLabel: 'Request Types', desc: 'Configure application request types', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/requests.svg); mask-image: url(/public/assets/icons/requests.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'titles', label: 'Salutations', fullLabel: 'Salutations', desc: 'Manage available user salutations', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/titles.svg); mask-image: url(/public/assets/icons/titles.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
    { key: 'durations', label: 'Durations', fullLabel: 'Duration Settings', desc: 'Configure system-wide duration options', icon: '<span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/durations.svg); mask-image: url(/public/assets/icons/durations.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span>' },
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
                <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/arrow-left.svg); mask-image: url(/public/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
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
                <div class="adm-inst-section-title"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/list.svg); mask-image: url(/public/assets/icons/list.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Existing Records</div>
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
            <span class="adm-data-card-icon"><span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/users_roles.svg); mask-image: url(/public/assets/icons/users_roles.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span></span>
            <div class="adm-data-card-title">Create Role</div>
        </div>
        `;
    }

    if (hasAssignRole) {
        columns++;
        cardsHtml += `
        <!-- Assign Role Card -->
        <div class="adm-data-card" id="adm-card-assign-role" style="cursor: pointer;">
            <span class="adm-data-card-icon"><span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/Assign_user.svg); mask-image: url(/public/assets/icons/Assign_user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 48px; height: 48px; display: inline-block;"></span></span>
            <div class="adm-data-card-title">Assign Role</div>
        </div>
        `;
    }

    const gridColumnsStyle = columns === 1
        ? 'grid-template-columns: minmax(180px, 220px);'
        : 'grid-template-columns: repeat(2, minmax(180px, 220px));';

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
            <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/arrow-left.svg); mask-image: url(/public/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 14px; height: 14px; display: inline-block; vertical-align: text-bottom;"></span> Back to Menu
        </button>
    </div>

    <!-- Master Role Creator (Accordion) -->
    <div class="adm-accordion open" id="role-creator-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1.15rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/shield.svg); mask-image: url(/public/assets/icons/shield.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/public/assets/icons/chevron-down.svg); mask-image: url(/public/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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
                        <span class="extracted-svg" style="width:16px; height:16px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/public/assets/icons/lock.svg); mask-image: url(/public/assets/icons/lock.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        <span style="font-size:0.85rem; font-weight:700; color:#1e293b;">SELECT ROLE PERMISSIONS</span>
                    </div>
                    <span class="extracted-svg" style="width:16px; height:16px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/public/assets/icons/chevron-down.svg); mask-image: url(/public/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/list.svg); mask-image: url(/public/assets/icons/list.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">EXISTING ROLES DIRECTORY</h4>
                <span id="roles-list-count" style="margin-left:auto; background:#6366f1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>
            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; margin-left: 10px; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/chevron-down.svg); mask-image: url(/public/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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
            <span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/arrow-left.svg); mask-image: url(/public/assets/icons/arrow-left.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width: 14px; height: 14px; display: inline-block; vertical-align: text-bottom;"></span> Back to Menu
        </button>
    </div>

    <!-- Assign Role & Affiliation (Accordion) -->
    <div class="adm-accordion open" id="assign-role-editor-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; font-family: 'Inter', sans-serif;">
        <div class="adm-accordion-header" style="padding:1.15rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/edit-3.svg); mask-image: url(/public/assets/icons/edit-3.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">ASSIGN ROLE & AFFILIATION</h4>
                    <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">MANAGE USER ASSIGNMENTS IN REAL-TIME</p>
                </div>
            </div>
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/public/assets/icons/chevron-down.svg); mask-image: url(/public/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <!-- Placeholder prompt when no user is loaded -->
            <div id="adm-assign-placeholder" style="padding: 2.5rem; text-align: center; border: 1.5px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; color: #64748b; font-size: 0.85rem; font-weight: 600;">
                <span class="extracted-svg" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 6px; color: #6366f1; -webkit-mask-image: url(/public/assets/icons/info.svg); mask-image: url(/public/assets/icons/info.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; align-items: flex-end;">
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
                        <span class="extracted-svg" style="width: 14px; height: 14px; color: #d97706; display: inline-block; -webkit-mask-image: url(/public/assets/icons/alert-triangle.svg); mask-image: url(/public/assets/icons/alert-triangle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        <strong style="color: #92400e;">Warning</strong>
                    </div>
                    Assigning a new LI-Coordinator will deactivate the current active coordinator for this institute.
                </div>

                <div id="adm-editor-error" style="display: none; color: #ef4444; font-size: 0.75rem; font-weight: 700; font-family: 'Inter', sans-serif;"></div>
            </div>
        </div>
    </div>

    <!-- Users Directory (Accordion) -->
    <div class="adm-accordion open" id="users-list-accordion" style="margin-top:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; font-family: 'Inter', sans-serif;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/users.svg); mask-image: url(/public/assets/icons/users.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">USERS DIRECTORY</h4>
                <span id="users-list-count" style="background:#6366f1; color:#fff; padding:2px 8.5px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>

            <!-- Search Input on Header -->
            <div style="flex:1; max-width:300px; position:relative; margin-left:auto; margin-right:12px;" onclick="event.stopPropagation();">
                <span class="extracted-svg" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:#94a3b8; pointer-events:none; display: inline-block; -webkit-mask-image: url(/public/assets/icons/search.svg); mask-image: url(/public/assets/icons/search.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                <input type="text" id="adm-users-search-input" class="adm-search-input" placeholder="Search users by name or email…" style="height:34px; padding-left:2.25rem; font-size:0.75rem; border-color:#dcd7ff; background:#fff; margin:0;" />
            </div>

            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/public/assets/icons/chevron-down.svg); mask-image: url(/public/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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
                                        ${!isSuper ? `<button class="adm-btn adm-btn-secondary edit-role-btn" data-role='${__esc(JSON.stringify(r))}' style="padding: 4px 8px; font-size: 0.7rem; display:inline-flex; align-items:center; gap:4px;"><span class="extracted-svg" style="-webkit-mask-image: url(/public/assets/icons/edit-2.svg); mask-image: url(/public/assets/icons/edit-2.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor; width:12px; height:12px;"></span>Edit</button>` : ''}
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
                    if(modeRadios.length > 1) modeRadios[1].checked = true;
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
                                        <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/public/assets/icons/edit-3.svg); mask-image: url(/public/assets/icons/edit-3.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Manage
                                    </button>
                                    <button class="adm-btn" style="font-size:0.7rem; height:34px; padding:0 12px; border-radius:8px; font-weight:700; color:${isBlocked ? '#10b981' : '#dc2626'}; border:1px solid ${isBlocked ? '#a7f3d0' : '#fecaca'}; background:${isBlocked ? '#ecfdf5' : '#fef2f2'}; display:flex; align-items:center; gap:4px; cursor:pointer;" onclick="_toggleBlockUser('${u.id}', ${isBlocked})">
                                        <span class="extracted-svg" style="width:12px; height:12px; display: inline-block; -webkit-mask-image: url(/public/assets/icons/${isBlocked ? 'unlock' : 'shield-off'}.svg); mask-image: url(/public/assets/icons/${isBlocked ? 'unlock' : 'shield-off'}.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> ${isBlocked ? 'Unblock' : 'Block'}
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
            cachedUsers = res.ok ? await res.json() : [];

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
                            <span class="extracted-svg" style="width: 18px; height: 18px; display: inline-block; -webkit-mask-image: url(/public/assets/icons/shield-off.svg); mask-image: url(/public/assets/icons/shield-off.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
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

            // Setup LI-Coordinator Warning alert toggling
            const warningEl = container.querySelector('#adm-editor-warning');
            const checkRoleWarning = () => {
                if (!editorRoleSelect || !warningEl) return;
                const selectedOption = editorRoleSelect.options[editorRoleSelect.selectedIndex];
                const selectedText = selectedOption ? selectedOption.textContent.trim() : '';
                if (selectedText === 'LI-Coordinator') {
                    warningEl.style.display = 'block';
                } else {
                    warningEl.style.display = 'none';
                }
            };
            editorRoleSelect.onchange = checkRoleWarning;
            checkRoleWarning();

            // Clear errors
            const errorDiv = container.querySelector('#adm-editor-error');
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
            const submitBtn = container.querySelector('#adm-editor-submit-btn');

            cancelBtn.onclick = () => {
                if (form) form.style.display = 'none';
                if (placeholder) placeholder.style.display = 'block';
                if (warningEl) warningEl.style.display = 'none';
            };

            submitBtn.onclick = async () => {
                const selectedRoleId = editorRoleSelect.value;
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

                try {
                    const postRes = await authFetch(`${BASE_URL}/api/auth/admin/users/assign-role`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: data.email,
                            role_id: selectedRoleId
                        })
                    });

                    if (postRes.ok) {
                        _showToast('Role assigned successfully!', 'success');
                        if (form) form.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'block';
                        if (warningEl) warningEl.style.display = 'none';
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

