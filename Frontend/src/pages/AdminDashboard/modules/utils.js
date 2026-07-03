/**
 * MODULE: Utilities & Modals
 * 
 * A shared library of generic UI helpers, formatting functions, 
 * and modal initialization routines. Functions here are used across all other modules.
 */

import { authFetch } from '../../../utils/auth.js';
import { API, BASE_URL } from '../../../config/api.js';
import { _app, _state } from './core.js';
import { __esc } from '../../../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════════════════
//  MODALS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
export function _initModals() {
    const ids = ['adm-app-modal', 'adm-wf-modal', 'adm-modify-modal'];
    ids.forEach(id => {
        const overlay = _app.querySelector(`#${id}`);
        overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    });
    ['adm-app-modal-close', 'adm-wf-modal-close', 'adm-modify-modal-close'].forEach(btnId => {
        _app.querySelector(`#${btnId}`)?.addEventListener('click', () =>
            _app.querySelectorAll('.adm-modal-overlay').forEach(m => m.classList.remove('open'))
        );
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') _app.querySelectorAll('.adm-modal-overlay.open').forEach(m => m.classList.remove('open'));
    });
}

export function _showToast(msg, type = 'info') {
    if (window.showToast) {
        window.showToast(msg, type);
    } else {
        console.warn('[AdminDashboard] showToast not found, falling back to local fallback');
        // Minimal fallback if global utils not loaded
        const c = document.getElementById('adm-toast-container');
        if (!c) return;
        const t = document.createElement('div');
        t.className = `adm-toast ${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.remove(), 3500);
    }
}



export async function _buildCategoriesPageHtml() {
    let parentOptions = '<option value="">None (Top Level Category)</option>';
    try {
        const res = await authFetch(API.ADMIN_DATA('categories'));
        if (res.ok) {
            const cats = await res.json();
            parentOptions += cats.filter(c => !c.parent_id).map(c => `<option value="${c.id}">${__esc(c.name)}</option>`).join('');
        }
    } catch (_) { }

    return `
    <!-- Category Creation (Accordion) -->
    <div class="adm-accordion" id="cat-register-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/plus-circle.svg); mask-image: url(/assets/icons/plus-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">CREATE NEW CATEGORY</h4>
                    <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">DEFINE NEW ACADEMIC OR ORGANIZATIONAL GROUPS</p>
                </div>
            </div>
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div class="adm-form" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:1.25rem;">
                <div class="adm-form-group">
                    <label class="adm-label">Parent Category? (Leave none for top-level)</label>
                    <select id="cat-parent-id" class="adm-select">${parentOptions}</select>
                </div>
                <div class="adm-form-group">
                    <label class="adm-label">Category Name</label>
                    <input type="text" id="cat-name" placeholder="e.g. Science, Undergraduate" />
                </div>
                <div class="adm-form-group">
                    <label class="adm-label">URL Slug (Technical)</label>
                    <input type="text" id="cat-slug" placeholder="e.g. science-sub" />
                </div>
            </div>
            <div id="cat-create-fb" style="min-height:1.2rem; font-size:0.85rem; margin:1rem 0;"></div>
            <button id="cat-create-btn" class="adm-btn adm-btn-primary" style="width:auto; padding:0.75rem 2.5rem; background:#6366f1;">Save Category</button>
        </div>
    </div>

    <!-- List Section (Accordion) -->
    <div class="adm-accordion" id="cat-list-accordion" style="margin-bottom:2rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex:1;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/tag.svg) no-repeat center; mask: url(/assets/icons/tag.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">EXISTING CATEGORIES HIERARCHY</h4>
                <span id="cat-list-count" style="margin-left:auto; background:#6366f1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>
            <span class="adm-accordion-chevron extracted-svg" style="-webkit-mask: url(/assets/icons/chevron-down.svg) no-repeat center; mask: url(/assets/icons/chevron-down.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: #64748b; width: 18px; height: 18px; display: inline-block; margin-left: 10px;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div id="cat-list-container" class="adm-table-wrap">
                <div class="adm-spinner"></div>
            </div>
        </div>
    </div>
    `;
}

export function _wireCategoriesPage(container) {
    const listAccordion = container.querySelector('#cat-list-accordion');
    if (listAccordion) {
        listAccordion.querySelector('.adm-accordion-header').onclick = () => listAccordion.classList.toggle('open');
    }
    const regAccordion = container.querySelector('#cat-register-accordion');
    if (regAccordion) {
        regAccordion.querySelector('.adm-accordion-header').onclick = () => regAccordion.classList.toggle('open');
    }

    const btn = container.querySelector('#cat-create-btn');
    const fb = container.querySelector('#cat-create-fb');
    const listView = container.querySelector('#cat-list-container');

    const loadList = async () => {
        const openIds = Array.from(listView.querySelectorAll('.adm-accordion.open')).map(el => el.dataset.catId);
        try {
            const res = await authFetch(API.ADMIN_DATA('categories'));
            if (!res.ok) throw new Error();
            const rows = await res.json();

            const countBadge = container.querySelector('#cat-list-count');
            if (countBadge) {
                countBadge.textContent = rows.length;
                countBadge.style.display = 'inline-block';
            }

            const parents = rows.filter(r => !r.parent_id);
            const children = rows.filter(r => r.parent_id);

            listView.innerHTML = parents.length ? parents.map(p => {
                const subCats = children.filter(c => c.parent_id === p.id);
                return `
                <div class="adm-accordion" data-cat-id="${p.id}">
                    <div class="adm-accordion-header">
                        <div style="display:flex; align-items:center; gap:1.25rem;">
                            <div class="adm-accordion-icon-wrap" style="color:#6366f1;"><span class="extracted-svg" style="-webkit-mask: url(/assets/icons/tag.svg) no-repeat center; mask: url(/assets/icons/tag.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 20px; height: 20px; display: inline-block;"></span></div>
                            <div style="display:flex; flex-direction:column;">
                                <strong>${__esc(p.name)}</strong>
                                <div style="display:flex; align-items:center; gap:0.75rem; margin-top:0.25rem;">
                                    <code style="font-size:0.7rem; color:#6366f1; background:#eef2ff; padding:2px 6px; border-radius:4px;">${__esc(p.slug)}</code>
                                    <span class="adm-pill ${p.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}" style="font-size:0.65rem;">
                                        ${p.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:1.25rem;">
                            <label class="adm-switch">
                                <input type="checkbox" class="cat-toggle-switch" data-id="${p.id}" ${p.is_active ? 'checked' : ''}>
                                <span class="adm-switch-slider"></span>
                            </label>
                            <span style="font-size:0.75rem; color:#94a3b8; width:85px; text-align:right;">${subCats.length} items</span>
                            <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/chevron-down.svg) no-repeat center; mask: url(/assets/icons/chevron-down.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: #64748b; width: 16px; height: 16px; display: inline-block;"></span>
                        </div>
                    </div>
                    <div class="adm-accordion-content">
                        <div class="adm-table-wrap" style="border:none; border-top:1px solid #f1f5f9; border-radius:0;">
                            <table class="adm-table" style="margin-bottom:0;">
                                <thead style="background:#fdfdfe;">
                                    <tr>
                                        <th style="padding-left:3.5rem;">Sub-Category Name</th>
                                        <th>Slug</th>
                                        <th>Status</th>
                                        <th style="text-align:right;">Toggle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${subCats.length ? subCats.map(c => `
                                        <tr>
                                            <td style="padding-left:3.5rem;">
                                                <div style="display:flex; align-items:center; gap:0.75rem;">
                                                    <div style="width:6px; height:6px; border-radius:50%; background:#cbd5e1;"></div>
                                                    <span>${__esc(c.name)}</span>
                                                </div>
                                            </td>
                                            <td><code style="font-size:0.75rem; color:#475569;">${__esc(c.slug)}</code></td>
                                            <td>
                                                <span class="adm-pill ${c.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}">
                                                    ${c.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style="text-align:right;">
                                                <label class="adm-switch">
                                                    <input type="checkbox" class="cat-toggle-switch" data-id="${c.id}" ${c.is_active ? 'checked' : ''}>
                                                    <span class="adm-switch-slider"></span>
                                                </label>
                                            </td>
                                        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:2.5rem;">No nested categories found.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            }).join('') : '<div class="adm-empty">No categories found.</div>';

            if (openIds.length) {
                listView.querySelectorAll('.adm-accordion').forEach(el => {
                    if (openIds.includes(el.dataset.catId)) el.classList.add('open');
                });
            }


            // Wire accordion toggles
            listView.querySelectorAll('.adm-accordion-header').forEach(header => {
                header.onclick = (e) => {
                    if (e.target.closest('.cat-toggle-btn')) return;
                    header.parentElement.classList.toggle('open');
                };
            });

            // Wire status toggles
            listView.querySelectorAll('.cat-toggle-switch').forEach(sw => {
                sw.onchange = async (e) => {
                    e.stopPropagation();
                    try {
                        const tRes = await authFetch(`${BASE_URL}/api/auth/admin/categories/${sw.dataset.id}/toggle`, { method: 'PATCH' });
                        if (tRes.ok) {
                            _showToast('Status updated successfully', 'success');
                            loadList();
                        } else {
                            _showToast('Failed to update status', 'error');
                            sw.checked = !sw.checked;
                        }
                    } catch (_) {
                        _showToast('Failed to update status', 'error');
                        sw.checked = !sw.checked;
                    }
                };
            });
        } catch (err) { console.error('CATEGORIES ERROR:', err); listView.innerHTML = 'Error loading categories.'; }
    };

    btn.onclick = async () => {
        const name = container.querySelector('#cat-name').value.trim();
        const parent_id = container.querySelector('#cat-parent-id').value;
        const slug = container.querySelector('#cat-slug').value.trim();

        if (!name || !slug) { fb.style.color = '#ef4444'; fb.textContent = 'Name and Slug are required.'; return; }

        btn.disabled = true; fb.style.color = '#6366f1'; fb.textContent = 'Saving…';
        try {
            const res = await authFetch(`${BASE_URL}/api/auth/admin/categories`, {
                method: 'POST',
                body: JSON.stringify({ name, parent_id, slug })
            });
            if (res.ok) {
                fb.style.color = '#10b981'; fb.textContent = '✓ Category created.';
                container.querySelector('#cat-name').value = '';
                container.querySelector('#cat-slug').value = '';
                loadList();
            } else {
                const data = await res.json();
                throw new Error(data.message || 'Error');
            }
        } catch (err) { fb.style.color = '#ef4444'; fb.textContent = err.message; }
        finally { btn.disabled = false; }
    };

    loadList();
}

export async function _buildHierarchicalPageHtml(entity) {
    let label = entity === 'services' ? 'Service' : (entity === 'workflows' ? 'Workflow' : 'System');
    let subLabel = entity === 'services' ? 'Sub-Service' : (entity === 'workflows' ? 'Step' : 'Sub-System');
    let icon = entity === 'services' ? 'box' : (entity === 'workflows' ? 'activity' : 'grid');

    return `
    <!-- Creation (Accordion) -->
    <div class="adm-accordion" id="hier-create-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/plus-circle.svg); mask-image: url(/assets/icons/plus-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div style="flex:1">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-right:1rem;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div>
                                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">REGISTER NEW ${label.toUpperCase()}/${subLabel.toUpperCase()}</h4>
                                <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">SELECT TYPE AND DEFINE DETAILS</p>
                            </div>
                        </div>
                        <div class="adm-radio-group" style="margin:0; background:#f1f5f9; padding:3px; border-radius:8px;" onclick="event.stopPropagation()">
                            <label class="adm-radio-label" style="margin:0;">
                                <input type="radio" name="hier-mode" value="parent" checked>
                                <span class="adm-radio-chip" style="padding:6px 12px; font-size:0.75rem;">${entity === 'workflows' ? 'Add New' : 'Add ' + label}</span>
                            </label>
                            <label class="adm-radio-label" style="margin:0;">
                                <input type="radio" name="hier-mode" value="child">
                                <span class="adm-radio-chip" style="padding:6px 12px; font-size:0.75rem;">${entity === 'workflows' ? 'Modify Existing' : 'Add ' + subLabel}</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content">
            <!-- Form for Parent (Service, System, or Workflow) -->
            <div id="form-hier-parent" class="adm-form" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.25rem;">
                ${entity === 'services' ? `
                    <div class="adm-form-group">
                        <label class="adm-label">Select Subsystem to add Service</label>
                        <select id="p-svc-subsystem" class="adm-select"><option>Loading...</option></select>
                    </div>
                ` : (entity === 'workflows' ? '' : `
                    <div class="adm-form-group">
                        <label class="adm-label">Select Affiliation Institute to add System</label>
                        <select id="p-sys-institute" class="adm-select"><option>Loading...</option></select>
                    </div>
                `)}
                <div class="adm-form-group" style="${entity === 'workflows' ? 'grid-column: span 2;' : ''}">
                    <label class="adm-label">${label} Name</label>
                    <input type="text" id="p-name" placeholder="e.g. My ${label}" />
                </div>
                ${entity !== 'workflows' ? `
                    <div class="adm-form-group">
                        <label class="adm-label">${label} Code</label>
                        <input type="text" id="p-code" placeholder="e.g. ${entity === 'services' ? 'SVC' : 'SYS'}_001" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">Type</label>
                        <input type="text" id="p-type" value="${entity === 'services' ? 'service' : 'system'}" />
                    </div>
                ` : ''}
                ${entity === 'systems' ? `
                    <div class="adm-form-group">
                        <label class="adm-label">System Lead</label>
                        <select id="p-sys-lead" class="adm-select"><option>Loading...</option></select>
                    </div>
                ` : ''}
                <div class="adm-form-group" style="grid-column: span 2;">
                    <label class="adm-label">Description (Optional)</label>
                    <textarea id="p-desc" rows="2" style="width:100%; padding:0.75rem; border:1px solid #e2e8f0; border-radius:8px;"></textarea>
                </div>
                ${entity === 'services' ? `
                <div class="adm-form-group" style="grid-column: span 2; display: flex; flex-direction: column; gap: 1rem; margin-top: -0.5rem; background:#f8fafc; padding:1.25rem; border-radius:12px; border:1px solid #e2e8f0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                        <div>
                            <span style="display:block; font-size: 0.9rem; font-weight: 700; color: #1e293b; margin-bottom: 0.25rem;">Is LIGO Service? <span style="color:#ef4444;">*</span></span>
                            <span style="font-size: 0.75rem; color: #64748b;">Specify if this service requires LIGO membership.</span>
                        </div>
                        <div class="adm-radio-group" style="margin:0; background:#e2e8f0; padding:4px; border-radius:10px; min-width: 140px; display:flex;">
                            <label class="adm-radio-label" style="margin:0; flex:1;">
                                <input type="radio" name="p-svc-is-ligo" value="1">
                                <span class="adm-radio-chip" style="padding:8px 16px; font-size:0.8rem; text-align:center; width:100%; border-radius:8px;">Yes</span>
                            </label>
                            <label class="adm-radio-label" style="margin:0; flex:1;">
                                <input type="radio" name="p-svc-is-ligo" value="0">
                                <span class="adm-radio-chip" style="padding:8px 16px; font-size:0.8rem; text-align:center; width:100%; border-radius:8px;">No</span>
                            </label>
                        </div>
                    </div>
                    <div style="height:1px; background:#e2e8f0; width:100%;"></div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                        <div>
                            <span style="display:block; font-size: 0.9rem; font-weight: 700; color: #1e293b; margin-bottom: 0.25rem;">Is Computing Service? <span style="color:#ef4444;">*</span></span>
                            <span style="font-size: 0.75rem; color: #64748b;">Specify if this is an IT/Computing related service.</span>
                        </div>
                        <div class="adm-radio-group" style="margin:0; background:#e2e8f0; padding:4px; border-radius:10px; min-width: 140px; display:flex;">
                            <label class="adm-radio-label" style="margin:0; flex:1;">
                                <input type="radio" name="p-svc-is-computing" value="1">
                                <span class="adm-radio-chip" style="padding:8px 16px; font-size:0.8rem; text-align:center; width:100%; border-radius:8px;">Yes</span>
                            </label>
                            <label class="adm-radio-label" style="margin:0; flex:1;">
                                <input type="radio" name="p-svc-is-computing" value="0">
                                <span class="adm-radio-chip" style="padding:8px 16px; font-size:0.8rem; text-align:center; width:100%; border-radius:8px;">No</span>
                            </label>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Form for Child (Sub-service, Sub-system, or Step) -->
            <div id="form-hier-child" class="adm-form" style="display:none; grid-template-columns:repeat(2, 1fr); gap:1.25rem;">
                <div class="adm-form-group" style="grid-column: span 2;">
                    <label class="adm-label">Select ${label} to add ${subLabel}</label>
                    <select id="c-parent-id" class="adm-select"><option>Loading...</option></select>
                </div>
                ${entity === 'workflows' ? `
                    <div class="adm-form-group" style="grid-column: span 2; background: #f5f3ff; padding: 1.25rem; border-radius: 12px; border: 1px dashed #c084fc; margin-bottom: 0.75rem;">
                        <label class="adm-label" style="color: #6d28d9; font-weight: 800;">How many steps do you want to define for this workflow?</label>
                        <div style="display: flex; gap: 12px; align-items: center; margin-top: 0.5rem;">
                            <input type="number" id="c-wf-step-count" value="1" min="0" max="10" class="adm-input" style="width: 80px; font-weight: 700; border-color: #c084fc;" />
                            <span style="font-size: 0.85rem; color: #4f46e5; font-weight: 700;">Defining multiple steps will generate multiple rows below.</span>
                        </div>
                    </div>
                    <div id="c-wf-steps-container" style="grid-column: span 2; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="adm-wf-step-row" style="display: grid; grid-template-columns: 70px 1.2fr 1fr 1fr 1.5fr; gap: 10px; align-items: end; background: white; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <div class="adm-form-group" style="margin:0;">
                                <label class="adm-label">Step ID</label>
                                <input type="number" class="adm-input wf-step-no" value="1" />
                            </div>
                            <div class="adm-form-group" style="margin:0;">
                                <label class="adm-label">Role</label>
                                <select class="adm-select wf-step-role"><option>Loading roles...</option></select>
                            </div>
                            <div class="adm-form-group" style="margin:0;">
                                <label class="adm-label">Actions <span style="font-size:0.7rem;color:#94a3b8;font-weight:400;">(Select multiple)</span></label>
                                <div class="adm-select wf-step-action" style="font-size:0.85rem; min-height:72px; max-height: 120px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; background: white; border: 1px solid #e2e8f0; border-radius: 6px;">
                                    <div style="color: #94a3b8; font-style: italic; padding: 4px;">Loading actions...</div>
                                </div>
                            </div>
                            <div class="adm-form-group" style="margin:0;">
                                <label class="adm-label">Status Name</label>
                                <input type="text" class="adm-input wf-step-status" placeholder="e.g. Awaiting..." />
                            </div>
                            <div class="adm-form-group" style="margin:0;">
                                <label class="adm-label">Description</label>
                                <input type="text" class="adm-input wf-step-desc" placeholder="Optional" />
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${entity !== 'workflows' ? `
                    <div class="adm-form-group" style="grid-column: span 2;">
                        <label class="adm-label">${subLabel + ' Name'}</label>
                        <input type="text" id="c-name" placeholder="e.g. Sub ${label}" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">${subLabel} Code</label>
                        <input type="text" id="c-code" placeholder="e.g. SUB_${entity === 'services' ? 'SVC' : 'SYS'}_001" />
                    </div>
                    <div class="adm-form-group">
                        <label class="adm-label">Type</label>
                        <input type="text" id="c-type" value="${entity === 'services' ? 'subservice' : 'subsystem'}" />
                    </div>
                    ${entity === 'systems' ? `
                        <div class="adm-form-group">
                            <label class="adm-label">Sub-System Lead</label>
                            <select id="c-sys-lead" class="adm-select"><option>Loading...</option></select>
                        </div>
                    ` : ''}
                    <div class="adm-form-group" style="grid-column: span 2;">
                        <label class="adm-label">Description (Optional)</label>
                        <textarea id="c-desc" rows="2" style="width:100%; padding:0.75rem; border:1px solid #e2e8f0; border-radius:8px;"></textarea>
                    </div>
                ` : ''}
            </div>

            <div id="hier-create-fb" style="min-height:1.2rem; font-size:0.85rem; margin:1rem 0;"></div>
            <button id="hier-create-btn" class="adm-btn adm-btn-primary" style="width:auto; padding:0.75rem 2.5rem; background:#6366f1;">Save ${label}</button>
        </div>
    </div>

    <!-- List Section -->
    <div class="adm-accordion" id="hier-list-accordion" style="margin-bottom:2rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/grid.svg); mask-image: url(/assets/icons/grid.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">EXISTING ${label.toUpperCase()}S & ${subLabel.toUpperCase()}S</h4>
                <span id="hier-list-count" style="margin-left:auto; background:#6366f1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;"></span>
            </div>
            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; margin-left: 10px; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div id="hier-list-container">
                <div class="adm-loading"><div class="adm-spinner"></div> Loading records...</div>
            </div>
        </div>
    </div>

    ${entity === 'workflows' ? `
    <!-- Map Workflow Modal -->
    <div id="map-workflow-modal" class="adm-modal" style="display:none; position:fixed; inset:0; z-index:1000; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px); background:rgba(15,23,42,0.4);">
        <div class="adm-modal-content" style="background:#fff; border-radius:16px; width:100%; max-width:500px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="padding:1.5rem 2rem; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                <h3 style="margin:0; font-size:1.25rem; color:#0f172a; font-weight:700; display:flex; align-items:center; gap:8px;">
                    <span class="extracted-svg" style="color:#6366f1; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/link.svg); mask-image: url(/assets/icons/link.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Map Workflow
                </h3>
                <button type="button" id="map-workflow-close" style="background:none; border:none; color:#64748b; cursor:pointer; padding:4px; border-radius:6px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/x.svg); mask-image: url(/assets/icons/x.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </button>
            </div>
            <div style="padding:2rem;">
                <p style="margin-top:0; margin-bottom:1.5rem; color:#64748b; font-size:0.95rem; line-height:1.5;">
                    Your workflow steps have been saved! To make this workflow active, you must map it to a specific Request Type and Applicant Category.
                </p>
                <input type="hidden" id="map-wfid" value="">
                
                <div class="adm-form-group" style="margin-bottom:1.5rem;">
                    <label class="adm-label" style="font-weight:600; color:#334155; margin-bottom:0.5rem; display:block;">Request Type <span style="color:#ef4444;">*</span></label>
                    <select id="map-request" style="width:100%; padding:0.75rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95rem; color:#1e293b; background:#fff; transition:border-color 0.2s;"></select>
                </div>

                <div class="adm-form-group" style="margin-bottom:2rem;">
                    <label class="adm-label" style="font-weight:600; color:#334155; margin-bottom:0.5rem; display:block;">Applicant Categories <span style="color:#ef4444;">*</span></label>
                    <div id="map-category-container" style="width:100%; max-height:200px; overflow-y:auto; padding:0.75rem; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc;">
                        <!-- Checkboxes will be injected here -->
                    </div>
                </div>

                <div id="map-fb" style="min-height:1.2rem; font-size:0.85rem; margin-bottom:1rem;"></div>
                
                <div style="display:flex; justify-content:flex-end; gap:12px;">
                    <button type="button" id="map-workflow-save" class="adm-btn adm-btn-primary" style="background:#6366f1; font-weight:600; padding:0.6rem 2rem; box-shadow:0 4px 6px -1px rgba(99,102,241,0.2);">Save Mapping</button>
                </div>
            </div>
        </div>
    </div>
    ` : ''}
    `;
}

export function _wireHierarchicalPage(container, entity) {
    let openMapModal = null;
    
    // Workflow specific logic
    if (entity === 'workflows') {
        const stepCountInput = container.querySelector('#c-wf-step-count');
        const stepsContainer = container.querySelector('#c-wf-steps-container');

        if (stepCountInput && stepsContainer) {
            stepCountInput.onchange = async () => {
                const parsed = parseInt(stepCountInput.value);
                const count = isNaN(parsed) ? 1 : parsed;
                const rolesRes = await authFetch(API.ADMIN_ROLES);
                const roles = rolesRes.ok ? await rolesRes.json() : [];
                const rolesHtml = roles.map(r => `<option value="${r.id}">${__esc(r.name)}</option>`).join('');

                const actionsRes = await authFetch(API.ADMIN_DATA('workflow-actions'));
                const actions = actionsRes.ok ? await actionsRes.json() : [];
                const actionsHtml = actions.map(a => `<option value="${a.slug}">${__esc(a.name)}</option>`).join('');

                let html = '';
                for (let i = 1; i <= count; i++) {
                    html += `
                    <div class="adm-wf-step-row" style="display: grid; grid-template-columns: 70px 1.2fr 1fr 1fr 1.5fr; gap: 10px; align-items: end; background: white; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div class="adm-form-group" style="margin:0;">
                            <label class="adm-label">Step ID</label>
                            <input type="number" class="adm-input wf-step-no" value="${i}" />
                        </div>
                        <div class="adm-form-group" style="margin:0;">
                            <label class="adm-label">Role</label>
                            <select class="adm-select wf-step-role">${rolesHtml}</select>
                        </div>
                        <div class="adm-form-group" style="margin:0;">
                            <label class="adm-label">Actions <span style="font-size:0.7rem;color:#94a3b8;font-weight:400;">(Select multiple)</span></label>
                            <div class="adm-select wf-step-action" style="font-size:0.85rem; min-height:72px; max-height: 120px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; background: white; border: 1px solid #e2e8f0; border-radius: 6px;">
                                ${actionsHtml}
                            </div>
                        </div>
                        <div class="adm-form-group" style="margin:0;">
                            <label class="adm-label">Status Name</label>
                            <input type="text" class="adm-input wf-step-status" placeholder="e.g. Awaiting..." />
                        </div>
                        <div class="adm-form-group" style="margin:0;">
                            <label class="adm-label">Description</label>
                            <input type="text" class="adm-input wf-step-desc" placeholder="Optional" />
                        </div>
                    </div>`;
                }
                stepsContainer.innerHTML = html;
            };
        }

        // Map Modal Listeners
        const mapModal = container.querySelector('#map-workflow-modal');
        openMapModal = async (workflowId) => {
            if (!mapModal) return;
            document.getElementById('map-wfid').value = workflowId;
            document.getElementById('map-fb').textContent = 'Loading mapping data...';
            document.getElementById('map-workflow-save').disabled = true;
            mapModal.style.display = 'flex';

            try {
                const [reqsRes, catsRes, mapRes] = await Promise.all([
                    authFetch(API.ADMIN_DATA('requests')),
                    authFetch(API.ADMIN_DATA('categories')),
                    authFetch(`${BASE_URL}/api/auth/admin/workflows/${workflowId}/mappings`)
                ]);
                
                const reqs = await reqsRes.json();
                const cats = await catsRes.json();
                const existingMappings = mapRes.ok ? await mapRes.json() : [];
                
                const mappedCategoryIds = new Set(existingMappings.map(m => String(m.category_id)));
                const mappedRequestId = existingMappings.length > 0 ? String(existingMappings[0].request_id) : '';

                const rSel = document.getElementById('map-request');
                rSel.innerHTML = '<option value="">-- Select Request Type --</option>' +
                    reqs.map(r => `<option value="${r.id}" ${String(r.id) === mappedRequestId ? 'selected' : ''}>${__esc(r.name)}</option>`).join('');

                const cContainer = document.getElementById('map-category-container');

                // Find root categories
                const rootCats = cats.filter(c => !c.parent_id);
                
                let cHtml = '';
                rootCats.forEach(root => {
                    const children = cats.filter(c => String(c.parent_id) === String(root.id));
                    const allChildrenMapped = children.length > 0 && children.every(c => mappedCategoryIds.has(String(c.id)));
                    
                    cHtml += `<div style="margin-bottom:1rem; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">`;
                    cHtml += `  <label style="display:flex; align-items:center; padding:0.75rem 1rem; background:#f1f5f9; font-weight:700; font-size:0.9rem; color:#334155; cursor:pointer; border-bottom:1px solid #e2e8f0;">
                                  <input type="checkbox" class="map-root-cb" value="${root.id}" style="margin-right:10px; width:16px; height:16px; accent-color:#6366f1;" ${allChildrenMapped ? 'checked' : ''}> ${__esc(root.name)}
                                </label>`;
                    cHtml += `  <div class="map-child-container" style="padding:0.75rem 1rem 0.25rem; display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">`;
                    children.forEach(c => {
                        const isChecked = mappedCategoryIds.has(String(c.id)) ? 'checked' : '';
                        cHtml += `    <label style="display:flex; align-items:center; font-size:0.85rem; color:#475569; cursor:pointer;">
                                        <input type="checkbox" name="map-category-cb" class="map-child-cb" value="${c.id}" style="margin-right:8px; width:14px; height:14px; accent-color:#6366f1;" ${isChecked}> ${__esc(c.name)}
                                      </label>`;
                    });
                    cHtml += `  </div>`;
                    cHtml += `</div>`;
                });
                
                cContainer.innerHTML = cHtml;

                // Wire up root checkbox logic
                cContainer.querySelectorAll('.map-root-cb').forEach(rootCb => {
                    rootCb.onchange = (e) => {
                        const childContainer = e.target.closest('div').querySelector('.map-child-container');
                        if (childContainer) {
                            childContainer.querySelectorAll('.map-child-cb').forEach(childCb => {
                                childCb.checked = e.target.checked;
                            });
                        }
                    };
                });
                
                // Wire up child checkbox logic to update root checkbox state
                cContainer.querySelectorAll('.map-child-cb').forEach(childCb => {
                    childCb.onchange = (e) => {
                        const wrapper = e.target.closest('div');
                        const rootCb = wrapper.querySelector('.map-root-cb');
                        const allChildren = wrapper.querySelectorAll('.map-child-cb');
                        if (allChildren.length > 0) {
                            const allChecked = Array.from(allChildren).every(cb => cb.checked);
                            if (rootCb) rootCb.checked = allChecked;
                        }
                    };
                });

                document.getElementById('map-fb').textContent = '';
                document.getElementById('map-workflow-save').disabled = false;
            } catch (err) {
                document.getElementById('map-fb').style.color = '#ef4444';
                document.getElementById('map-fb').textContent = 'Error loading mapping options.';
            }
        };

        if (mapModal) {
            const closeModal = () => mapModal.style.display = 'none';
            container.querySelector('#map-workflow-close').onclick = closeModal;

            container.querySelector('#map-workflow-save').onclick = async () => {
                const wfid = container.querySelector('#map-wfid').value;
                const reqId = container.querySelector('#map-request').value;
                const catIds = Array.from(container.querySelectorAll('input[name="map-category-cb"]:checked')).map(cb => cb.value);
                const fb = container.querySelector('#map-fb');
                const saveBtn = container.querySelector('#map-workflow-save');

                if (!reqId || catIds.length === 0) {
                    fb.style.color = '#ef4444';
                    fb.textContent = 'Please select a Request Type and at least one Applicant Category.';
                    return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                try {
                    const res = await authFetch(`${BASE_URL}/api/auth/admin/workflows/${wfid}/map`, {
                        method: 'POST',
                        body: JSON.stringify({ request_id: reqId, category_ids: catIds })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to map workflow');

                    fb.style.color = '#10b981';
                    fb.textContent = '✓ Workflow mapped successfully!';
                    setTimeout(() => closeModal(), 1500);
                } catch (e) {
                    fb.style.color = '#ef4444';
                    fb.textContent = e.message;
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Mapping';
                }
            };
        }
    }
    const listAccordion = container.querySelector('#hier-list-accordion');
    if (listAccordion) {
        listAccordion.querySelector('.adm-accordion-header').onclick = () => listAccordion.classList.toggle('open');
    }

    const listView = container.querySelector('#hier-list-container');
    const label = entity === 'services' ? 'Service' : (entity === 'workflows' ? 'Workflow' : 'System');
    const subLabel = entity === 'services' ? 'Sub-Service' : (entity === 'workflows' ? 'Step' : 'Sub-System');

    // ── Creation Logic ──
    const modeRadios = container.querySelectorAll('input[name="hier-mode"]');
    const formParent = container.querySelector('#form-hier-parent');
    const formChild = container.querySelector('#form-hier-child');
    const createBtn = container.querySelector('#hier-create-btn');
    const fb = container.querySelector('#hier-create-fb');

    // Force initial state
    if (entity === 'workflows') {
        formParent.style.display = 'none';
        formChild.style.display = 'grid';
        modeRadios.forEach(r => {
            if (r.value === 'child') r.checked = true;
            else r.checked = false;
        });
    } else {
        formParent.style.display = 'grid';
        formChild.style.display = 'none';
    }

    const hierAccordion = container.querySelector('#hier-create-accordion');
    if (hierAccordion) {
        hierAccordion.querySelector('.adm-accordion-header').addEventListener('click', (e) => {
            if (!e.target.closest('.adm-radio-group')) {
                hierAccordion.classList.toggle('open');
            }
        });
    }

    modeRadios.forEach(r => r.onclick = () => {
        const isChild = r.value === 'child';
        formParent.style.display = isChild ? 'none' : 'grid';
        formChild.style.display = isChild ? 'grid' : 'none';

        // Update accordion header subtitle for clarity
        const subHeader = container.querySelector('.adm-accordion-header p');
        if (subHeader) {
            subHeader.textContent = isChild ? `DEFINE ${subLabel.toUpperCase()} DETAILS` : `DEFINE ${label.toUpperCase()} DETAILS`;
        }

        createBtn.textContent = isChild ? `Save ${subLabel}` : `Save ${label}`;
    });

    const loadDropdowns = async () => {
        try {
            const lookups = [authFetch(API.ADMIN_DATA(entity))]; // Get parents
            if (entity === 'services') lookups.push(authFetch(API.ADMIN_DATA('subsystems')));
            else {
                lookups.push(authFetch(API.ADMIN_DATA('institutes')));
                // Initially load all users for leads, but we'll re-filter on change
                lookups.push(authFetch(API.ADMIN_DATA('users')));
            }

            const results = await Promise.all(lookups);
            const parentData = await results[0].json();
            const childParentSelect = container.querySelector('#c-parent-id');
            if (childParentSelect) {
                let filteredData = parentData;
                if (entity === 'workflows') {
                    // Only show the latest version of each workflow in the dropdown to avoid branching off old versions
                    filteredData = parentData.filter(p => p.is_latest == 1);
                }
                const opts = filteredData.map(p => `<option value="${p.id}" data-inst-id="${p.institute_id || ''}">${__esc(p.name)}</option>`).join('');
                childParentSelect.innerHTML = opts ? `<option value="">— Select ${label} —</option>` + opts : `<option value="">No ${label}s found</option>`;
            }

            if (entity === 'services') {
                const subSysRes = await results[1].json();
                const sel = container.querySelector('#p-svc-subsystem');
                if (sel) {
                    const opts = subSysRes.map(s => `<option value="${s.id}">${__esc(s.name)}</option>`).join('');
                    sel.innerHTML = opts ? `<option value="">— Select Subsystem —</option>` + opts : '<option value="">No subsystems found</option>';
                }
            } else if (entity === 'workflows') {
                const roleRes = await authFetch(API.ADMIN_ROLES);
                const roleData = roleRes.ok ? await roleRes.json() : [];
                const roleHtml = Array.isArray(roleData) ? roleData.map(r => `<option value="${r.id}">${__esc(r.name)}</option>`).join('') : '<option value="">Error loading roles</option>';
                container.querySelectorAll('.wf-step-role').forEach(sel => sel.innerHTML = roleHtml);

                const actRes = await authFetch(API.ADMIN_DATA('workflow-actions'));
                const actData = actRes.ok ? await actRes.json() : [];
                const actHtml = Array.isArray(actData) ? actData.map(a => `
                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 4px; border-radius: 4px; background: #f8fafc; border: 1px solid #f1f5f9; white-space: nowrap;">
                        <input type="checkbox" value="${a.slug}" class="wf-action-cb">
                        ${__esc(a.name)}
                    </label>
                `).join('') : '<div style="color:red; font-style:italic;">Error loading actions</div>';
                container.querySelectorAll('.wf-step-action').forEach(sel => sel.innerHTML = actHtml);
            } else {
                const instData = await results[1].json();
                const userData = await results[2].json();

                const selInst = container.querySelector('#p-sys-institute');
                const selPLead = container.querySelector('#p-sys-lead');
                const selCLead = container.querySelector('#c-sys-lead');

                const populateLead = (selectEl, instId) => {
                    if (!instId) {
                        selectEl.innerHTML = '<option value="">— Select Parent First —</option>';
                        return;
                    }
                    const filtered = userData.filter(u => !instId || String(u.institute_id) === String(instId) || u.institute_name?.includes(instData.find(i => i.id == instId)?.name));
                    // Note: Since userData from API might not have institute_id (it has institute_name), 
                    // we might need to fetch fresh if filtering fails or rely on by-institute endpoint.
                    // For now, let's use the by-institute endpoint for accuracy.
                    _fetchAndPopulateLeads(selectEl, instId);
                };

                if (selInst) {
                    const opts = instData.map(i => `<option value="${i.id}">${__esc(i.name)}</option>`).join('');
                    selInst.innerHTML = opts ? `<option value="">— Select Institute —</option>` + opts : '<option value="">No institutes found</option>';
                    selInst.onchange = () => _fetchAndPopulateLeads(selPLead, selInst.value);
                }

                if (childParentSelect && entity === 'systems') {
                    childParentSelect.onchange = () => {
                        const opt = childParentSelect.options[childParentSelect.selectedIndex];
                        const instId = opt?.dataset.instId;
                        _fetchAndPopulateLeads(selCLead, instId);
                    };
                }

                // Initial population if values exist
                if (selInst?.value) _fetchAndPopulateLeads(selPLead, selInst.value);
            }
        } catch (_) { }
    };

    const _fetchAndPopulateLeads = async (selectEl, instId) => {
        if (!selectEl) return;
        if (!instId) {
            selectEl.innerHTML = '<option value="">— Select Parent First —</option>';
            return;
        }
        selectEl.innerHTML = '<option value="">Loading users...</option>';
        try {
            const res = await authFetch(`${API.ADMIN_DATA('users')}?institute_id=${instId}`);
            const users = await res.json();
            const opts = users.map(u => `<option value="${u.id}">${__esc(u.name)} (${u.role_name || 'User'})</option>`).join('');
            selectEl.innerHTML = opts ? `<option value="">— Select Lead —</option>` + opts : '<option value="">No users found in this institute</option>';
        } catch (e) {
            selectEl.innerHTML = '<option value="">Error loading users</option>';
        }
    };
    loadDropdowns();

    // Tracks if we're editing an existing record (manage mode)
    let _manageState = null;

    createBtn.onclick = async () => {
        const mode = container.querySelector('input[name="hier-mode"]:checked').value;
        fb.style.color = '#6366f1'; fb.textContent = 'Saving...';
        createBtn.disabled = true;

        try {
            let url, body;
            if (mode === 'parent') {
                url = `${BASE_URL}/api/auth/admin/${entity === 'workflows' ? 'workflows' : entity}`;
                body = {
                    name: container.querySelector('#p-name').value.trim(),
                    description: container.querySelector('#p-desc').value.trim()
                };
                if (entity !== 'workflows') {
                    body.code = container.querySelector('#p-code').value.trim();
                    body.type = container.querySelector('#p-type').value.trim();
                    if (entity === 'services') {
                        body.subsystem_id = container.querySelector('#p-svc-subsystem').value;
                        if (!body.subsystem_id) throw new Error('Please select a Subsystem.');
                        
                        const ligoChecked = container.querySelector('input[name="p-svc-is-ligo"]:checked');
                        const computingChecked = container.querySelector('input[name="p-svc-is-computing"]:checked');
                        if (!ligoChecked) throw new Error('Please indicate if this is a LIGO Service.');
                        if (!computingChecked) throw new Error('Please indicate if this is a Computing Service.');
                        
                        body.is_ligo = ligoChecked.value === '1';
                        body.is_computing = computingChecked.value === '1';
                    }
                    else {
                        body.institute_id = container.querySelector('#p-sys-institute').value;
                        if (!body.institute_id) throw new Error('Please select an Institute.');
                        body.lead_id = container.querySelector('#p-sys-lead').value;
                        if (!body.lead_id) throw new Error('Please select a System Lead.');
                    }
                }
            } else {
                const childEntity = entity === 'services' ? 'subservices' : (entity === 'workflows' ? 'workflows/bulk-steps' : 'subsystems');
                url = `${BASE_URL}/api/auth/admin/${childEntity}`;
                if (entity !== 'workflows') {
                    body = {
                        name: container.querySelector('#c-name').value.trim(),
                        description: container.querySelector('#c-desc')?.value.trim() || ''
                    };
                }
                if (entity === 'workflows') {
                    const workflowId = container.querySelector('#c-parent-id').value;
                    if (!workflowId) throw new Error('Please select a Workflow.');

                    const stepRows = container.querySelectorAll('.adm-wf-step-row');
                    const steps = [];
                    stepRows.forEach(row => {
                        const actionContainer = row.querySelector('.wf-step-action');
                        const actionIds = Array.from(actionContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                        steps.push({
                            workflow_id: workflowId,
                            step_no: row.querySelector('.wf-step-no').value,
                            role_id: row.querySelector('.wf-step-role').value,
                            action_id: actionIds,
                            status_name: row.querySelector('.wf-step-status').value.trim() || 'Awaiting Review',
                            description: row.querySelector('.wf-step-desc').value.trim() || ''
                        });
                    });

                    // Wrap the steps array in an object so it sends as a single request
                    body = { steps: steps };
                } else {
                    body.code = container.querySelector('#c-code').value.trim();
                    body.type = container.querySelector('#c-type').value.trim();
                    if (entity === 'services') {
                        body.service_id = container.querySelector('#c-parent-id').value;
                        if (!body.service_id) throw new Error('Please select a Service.');
                    }
                    else {
                        body.system_id = container.querySelector('#c-parent-id').value;
                        if (!body.system_id) throw new Error('Please select a System.');
                        body.lead_id = container.querySelector('#c-sys-lead').value;
                        if (!body.lead_id) throw new Error('Please select a Sub-System Lead.');
                    }
                }
            }

            if (Array.isArray(body)) {
                // Bulk create
                for (const item of body) {
                    const res = await authFetch(url, { method: 'POST', body: JSON.stringify(item) });
                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(`Error in step ${item.step_no}: ${data.message || 'Validation error'}`);
                    }
                }
            } else {
                const res = await authFetch(url, { method: 'POST', body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Validation error');
            }

            fb.style.color = '#10b981'; fb.textContent = '✓ Saved successfully.';

            // Manage mode: deactivate the old record now that new one is created
            if (_manageState) {
                try {
                    await authFetch(`${BASE_URL}/api/auth/admin/data/${_manageState.type}/${_manageState.id}/toggle`, { method: 'PATCH' });
                } catch (_) {}
                _manageState = null;
                createBtn.style.background = '';
                createBtn.style.color = '';
                createBtn.textContent = mode === 'parent' ? `Save ${label}` : `Save ${subLabel}`;
            }

            // Reset fields
            if (entity === 'workflows' && mode !== 'parent') {
                const workflowId = container.querySelector('#c-parent-id').value;
                openMapModal(workflowId);

                const stepCountInput = container.querySelector('#c-wf-step-count');
                if (stepCountInput) {
                    stepCountInput.value = 0;
                    stepCountInput.onchange();
                }
                container.querySelectorAll('.wf-step-status, .wf-step-desc').forEach(input => input.value = '');
            } else {
                const fields = mode === 'parent' ? ['#p-name', '#p-code', '#p-desc'] : ['#c-name', '#c-code', '#c-desc'];
                fields.forEach(f => {
                    const el = container.querySelector(f);
                    if (el) el.value = '';
                });
            }

            loadList();
            loadDropdowns();
        } catch (err) {
            fb.style.color = '#ef4444'; fb.textContent = err.message;
        } finally {
            createBtn.disabled = false;
        }
    };

    const loadList = async () => {
        const openIds = Array.from(listView.querySelectorAll('.adm-accordion.open')).map(el => el.dataset.rowId);
        try {
            const res = await authFetch(entity === 'workflows' ? API.ADMIN_WORKFLOWS_FULL : API.ADMIN_DATA(entity));
            const rows = await res.json();
            const countBadge = container.querySelector('#hier-list-count');
            if (countBadge) {
                countBadge.textContent = rows.length;
                countBadge.style.display = 'inline-block';
            }

            listView.innerHTML = rows.map(p => {
                const children = p.children || [];
                return `
                <div class="adm-accordion" data-row-id="${p.id}">
                    <div class="adm-accordion-header" style="padding: 1.25rem; background:#fff; border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex; align-items:center; gap:1.25rem; flex: 1;">
                            <div class="adm-accordion-icon-wrap" style="background:linear-gradient(135deg, #6366f1, #818cf8); color:#fff; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 6px -1px rgba(99, 102, 241, 0.2);"><span class="extracted-svg" style="width:20px; height:20px; display: inline-block; -webkit-mask-image: url(/assets/icons/${entity === 'services' ? 'box' : 'grid'}.svg); mask-image: url(/assets/icons/${entity === 'services' ? 'box' : 'grid'}.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></div>
                            <div style="flex: 1;">
                                <div style="display:flex; flex-direction:column; gap:0.25rem;">
                                    <div style="display:flex; align-items:baseline; gap:0.75rem;">
                                        <strong style="font-size:1.1rem; color:#1e293b;">${__esc(p.name || p.workflow_name)} ${entity === 'workflows' && p.version ? `<span style="font-size:0.8rem; color:#64748b; font-weight:600;">v${p.version}</span>` : ''}</strong>
                                    </div>
                                    ${entity === 'workflows' ? '' : `
                                    <div style="margin-top: 2px;">
                                        <code style="font-size:0.75rem; color:#6366f1; background:#f0f4ff; padding:2px 8px; border-radius:4px; font-weight:600; display:inline-block;">${__esc(p.code || 'N/A')}</code>
                                    </div>
                                    `}
                                </div>
                                ${entity === 'systems' ? `
                                    <div style="margin-top: 8px; display:inline-flex; align-items:center; gap:0.5rem; background:#f1f5f9; padding:4px 10px; border-radius:6px; border-left:4px solid #6366f1; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);">
                                        <span style="font-size:0.7rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.02em;">Current Lead:</span>
                                        <span style="font-size:0.85rem; color:#1e293b; font-weight:600;">${__esc(p.lead_name || 'Unassigned')}</span>
                                    </div>
                                ` : (entity === 'services' ? `
                                    <div style="margin-top: 4px; display:flex; flex-direction:column; gap:2px;">
                                        <div style="font-size:0.75rem; color:#475569;"><span style="font-weight:600;">Subsystem:</span> ${__esc(p.parent_name || 'Unassigned')}</div>
                                        <div style="font-size:0.75rem; color:#64748b; font-style:italic;">${__esc(p.description || 'No description provided.')}</div>
                                    </div>
                                ` : (entity === 'workflows' ? `
                                    <div style="font-size:0.75rem; color:#64748b; margin-top:4px; font-style:italic;">${__esc(p.workflow_description || 'No description')}</div>
                                ` : `<div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">Type: ${__esc(p.type || 'N/A')}</div>`))}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:1.5rem;">
                            ${entity === 'systems' ? `
                                <div class="lead-action-wrap">
                                    <button class="adm-btn adm-btn-secondary change-lead-btn" 
                                        data-type="system" 
                                        data-id="${p.id}" 
                                        data-inst-id="${p.institute_id}"
                                        style="padding:6px 14px; font-size:0.75rem; height:auto; border-radius:8px; background:#fff; border:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05); color:#475569; font-weight:600;">
                                        <span class="extracted-svg" style="width:14px; height:14px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/user-plus.svg); mask-image: url(/assets/icons/user-plus.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Modify Lead
                                    </button>
                                </div>
                            ` : (entity === 'workflows' ? `
                                <div class="lead-action-wrap">
                                    <button class="adm-btn adm-btn-secondary map-workflow-btn" 
                                        data-id="${p.id}" 
                                        style="padding:6px 14px; font-size:0.75rem; height:auto; border-radius:8px; background:#fff; border:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05); color:#475569; font-weight:600;">
                                        <span class="extracted-svg" style="width:14px; height:14px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/link.svg); mask-image: url(/assets/icons/link.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Map
                                    </button>
                                </div>
                            ` : '')}
                            <span class="adm-pill ${p.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}">
                                ${p.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <label class="adm-switch">
                                <input type="checkbox" class="hier-toggle-switch" data-type="${entity}" data-id="${p.id}" ${p.is_active ? 'checked' : ''}>
                                <span class="adm-switch-slider"></span>
                            </label>
                            <button class="adm-btn hier-rename-btn" data-type="${entity}" data-id="${p.id}" data-name="${__esc(p.name || p.workflow_name || '')}" title="Rename" style="padding:4px 10px; font-size:0.7rem; height:auto; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; gap:5px; color:#6366f1; font-weight:600; cursor:pointer;">
                                <span class="extracted-svg" style="width:12px; height:12px; display:inline-block; -webkit-mask-image:url(/assets/icons/edit-2.svg); mask-image:url(/assets/icons/edit-2.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                Rename
                            </button>
                            ${entity !== 'workflows' ? `
                            <button class="adm-btn hier-manage-btn" 
                                data-mode="parent" data-id="${p.id}" data-type="${entity}"
                                data-name="${__esc(p.name || '')}" data-code="${__esc(p.code || '')}"
                                data-ptype="${__esc(p.type || '')}" data-desc="${__esc(p.description || '')}"
                                data-subsystem-id="${p.subsystem_id || ''}"
                                data-institute-id="${p.institute_id || ''}" data-lead-id="${p.lead_user_id || ''}"
                                title="Manage — create modified version"
                                style="padding:4px 10px; font-size:0.7rem; height:auto; border-radius:6px; background:#fff7ed; border:1px solid #fed7aa; display:flex; align-items:center; gap:5px; color:#d97706; font-weight:700; cursor:pointer;">
                                <span class="extracted-svg" style="width:12px; height:12px; display:inline-block; -webkit-mask-image:url(/assets/icons/settings.svg); mask-image:url(/assets/icons/settings.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                Manage
                            </button>` : ''}
                            <span style="font-size:0.75rem; color:#94a3b8; width:60px;">${children.length} items</span>
                            <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                        </div>
                    </div>
                    <div class="adm-accordion-content">
                        <div class="adm-table-wrap" style="border:none; border-top:1px solid #f1f5f9; border-radius:0;">
                            <table class="adm-table" style="margin-bottom:0;">
                                <tbody>
                                    ${children.length ? children.map(c => `
                                        <tr>
                                            <td style="padding-left:4rem; padding-top:1.25rem; padding-bottom:1.25rem;">
                                                <div style="display:flex; align-items:center; gap:1.25rem;">
                                                    ${entity === 'workflows' ? `
                                                        <div style="width:28px; height:28px; border-radius:50%; background:#f0f4ff; color:#6366f1; border:1px solid #dcd7ff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.75rem; flex-shrink:0;">${c.step_no}</div>
                                                    ` : `
                                                        <div style="width:10px; height:10px; border-radius:50%; background:#6366f1; box-shadow: 0 0 0 4px #eef2ff; flex-shrink:0;"></div>
                                                    `}
                                                    <div style="flex: 1; min-width:0;">
                                                        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                                                            <span style="font-weight:600; color:#334155; line-height:1.4;">
                                                                ${entity === 'workflows' ? __esc(c.description || 'Step ' + c.step_no) : __esc(c.name)}
                                                            </span>
                                                            ${entity !== 'workflows' ? `<code style="font-size:0.7rem; color:#94a3b8; background:#f8fafc; padding:1px 5px; border-radius:3px; font-weight:600;">${__esc(c.code || 'N/A')}</code>` : ''}
                                                        </div>
                                                        ${entity === 'systems' ? `
                                                            <div style="margin-top:6px; font-size:0.7rem; display:inline-flex; align-items:center; gap:6px; background:#f8fafc; padding:3px 8px; border-radius:4px; border:1px solid #f1f5f9; border-left:3px solid #cbd5e1;">
                                                                <span style="color:#94a3b8; font-weight:600;">Lead:</span> 
                                                                <span style="color:#475569; font-weight:500;">${__esc(c.lead_name || '---')}</span>
                                                            </div>
                                                        ` : (entity === 'workflows' ? `
                                                            <div style="margin-top:6px; font-size:0.7rem; display:flex; gap:8px;">
                                                                <span class="adm-pill" style="background:#f0f4ff; color:#6366f1; border-color:#dcd7ff; font-size:0.6rem;">Role: ${__esc(c.role_name || 'Unknown')}</span>
                                                                <span class="adm-pill" style="background:#fff7ed; color:#ea580c; border-color:#ffedd5; font-size:0.6rem;">Action: ${__esc(c.step_action)}</span>
                                                                <span class="adm-pill" style="background:#ecfdf5; color:#059669; border-color:#d1fae5; font-size:0.6rem;">Status: ${__esc(c.status_name || 'Awaiting...')}</span>
                                                            </div>
                                                        ` : '')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style="vertical-align: middle;">
                                                ${entity === 'systems' ? `
                                                    <div class="lead-action-wrap">
                                                        <button class="adm-btn adm-btn-secondary change-lead-btn" 
                                                            data-type="subsystem" 
                                                            data-id="${c.id}" 
                                                            data-inst-id="${p.institute_id}"
                                                            style="padding:5px 10px; font-size:0.7rem; height:auto; border-radius:6px; background:#fff; border:1px solid #e2e8f0; display:flex; align-items:center; gap:6px; color:#64748b; font-weight:500;">
                                                            <span class="extracted-svg" style="width:12px; height:12px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/user.svg); mask-image: url(/assets/icons/user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span> Modify Lead
                                                        </button>
                                                    </div>
                                                ` : ''}
                                            </td>
                                            <td>
                                                <span class="adm-pill ${c.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}">
                                                    ${c.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style="text-align:right;">
                                                ${entity === 'workflows' ? '' : `
                                                <label class="adm-switch">
                                                    <input type="checkbox" class="hier-toggle-switch" data-type="${entity === 'services' ? 'subservices' : 'subsystems'}" data-id="${c.id}" ${c.is_active ? 'checked' : ''}>
                                                    <span class="adm-switch-slider"></span>
                                                </label>
                                                <button class="adm-btn hier-rename-btn" data-type="${entity === 'services' ? 'subservices' : 'subsystems'}" data-id="${c.id}" data-name="${__esc(c.name || '')}" title="Rename" style="padding:3px 8px; font-size:0.7rem; height:auto; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; gap:4px; color:#6366f1; font-weight:600; cursor:pointer;">
                                                    <span class="extracted-svg" style="width:11px; height:11px; display:inline-block; -webkit-mask-image:url(/assets/icons/edit-2.svg); mask-image:url(/assets/icons/edit-2.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                                    Rename
                                                </button>
                                                <button class="adm-btn hier-manage-btn"
                                                    data-mode="child"
                                                    data-id="${c.id}"
                                                    data-type="${entity === 'services' ? 'subservices' : 'subsystems'}"
                                                    data-name="${__esc(c.name || '')}" data-code="${__esc(c.code || '')}"
                                                    data-ptype="${__esc(c.type || '')}" data-desc="${__esc(c.description || '')}"
                                                    data-parent-id="${c.service_id || c.system_id || ''}"
                                                    data-lead-id="${c.lead_user_id || ''}"
                                                    title="Manage — create modified version"
                                                    style="padding:3px 8px; font-size:0.7rem; height:auto; border-radius:6px; background:#fff7ed; border:1px solid #fed7aa; display:flex; align-items:center; gap:4px; color:#d97706; font-weight:700; cursor:pointer;">
                                                    <span class="extracted-svg" style="width:11px; height:11px; display:inline-block; -webkit-mask-image:url(/assets/icons/settings.svg); mask-image:url(/assets/icons/settings.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                                    Manage
                                                </button>
                                                `}
                                            </td>
                                        </tr>`).join('') : `<tr><td style="text-align:center; color:#94a3b8; padding:2rem;">No items found.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            }).join('');

            if (openIds.length) {
                listView.querySelectorAll('.adm-accordion').forEach(el => {
                    if (openIds.includes(el.dataset.rowId)) el.classList.add('open');
                });
            }

            listView.querySelectorAll('.adm-accordion-header').forEach(h => {
                h.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('label')) h.parentElement.classList.toggle('open'); };
            });

            listView.querySelectorAll('.hier-toggle-switch').forEach(sw => {
                sw.onchange = async () => {
                    const type = sw.dataset.type;
                    const id = sw.dataset.id;
                    try {
                        const res = await authFetch(`${BASE_URL}/api/auth/admin/data/${type}/${id}/toggle`, { method: 'PATCH' });
                        if (res.ok) {
                            _showToast('Status updated successfully', 'success');
                            loadList();
                        } else {
                            _showToast('Failed to update status', 'error');
                            sw.checked = !sw.checked;
                        }
                    } catch (_) {
                        _showToast('Failed to update status', 'error');
                        sw.checked = !sw.checked;
                    }
                };
            });

            listView.querySelectorAll('.hier-rename-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const type = btn.dataset.type;
                    const id = btn.dataset.id;
                    const currentName = btn.dataset.name;

                    const modalHtml = `
                        <div style="position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;">
                            <div style="background:#fff; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); padding:2rem; width:420px; max-width:95vw; animation:admSlideUp 0.25s cubic-bezier(0.16,1,0.3,1);">
                                <div style="display:flex; align-items:center; gap:12px; margin-bottom:1.5rem;">
                                    <div style="width:40px; height:40px; border-radius:10px; background:#eef2ff; display:flex; align-items:center; justify-content:center;">
                                        <span class="extracted-svg" style="width:18px; height:18px; color:#6366f1; display:inline-block; -webkit-mask-image:url(/assets/icons/edit-2.svg); mask-image:url(/assets/icons/edit-2.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                    </div>
                                    <div>
                                        <h3 style="margin:0; font-size:1rem; color:#1e293b; font-weight:800;">Rename ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                                        <p style="margin:0; font-size:0.72rem; color:#64748b;">Current: <em>${__esc(currentName)}</em></p>
                                    </div>
                                </div>
                                <div style="margin-bottom:1.25rem;">
                                    <label style="display:block; font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">New Name</label>
                                    <input id="rename-input" type="text" value="${__esc(currentName)}" placeholder="Enter new name..." style="width:100%; box-sizing:border-box; border:2px solid #e2e8f0; border-radius:8px; padding:10px 14px; font-size:0.95rem; color:#1e293b; outline:none; transition:border-color 0.2s;" />
                                    <div id="rename-fb" style="margin-top:6px; font-size:0.8rem; color:#ef4444;"></div>
                                </div>
                                <div style="display:flex; gap:10px;">
                                    <button id="rename-cancel" style="flex:1; height:42px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; color:#64748b; font-weight:600; cursor:pointer;">Cancel</button>
                                    <button id="rename-save" style="flex:1.5; height:42px; border-radius:10px; background:#6366f1; color:#fff; border:none; font-weight:700; cursor:pointer;">Save Name</button>
                                </div>
                            </div>
                        </div>`;

                    const mc = document.createElement('div');
                    mc.innerHTML = modalHtml;
                    document.body.appendChild(mc);

                    const input = mc.querySelector('#rename-input');
                    const fb = mc.querySelector('#rename-fb');
                    input.focus();
                    input.select();

                    const close = () => mc.remove();
                    mc.querySelector('#rename-cancel').onclick = close;
                    mc.querySelector('#rename-save').onclick = async () => {
                        const newName = input.value.trim();
                        if (!newName) { fb.textContent = 'Name cannot be empty.'; return; }
                        if (newName === currentName) { close(); return; }
                        mc.querySelector('#rename-save').disabled = true;
                        mc.querySelector('#rename-save').textContent = 'Saving...';
                        try {
                            const res = await authFetch(`${BASE_URL}/api/auth/admin/data/${type}/${id}/rename`, {
                                method: 'PATCH',
                                body: JSON.stringify({ name: newName })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed to rename');
                            _showToast('Renamed successfully', 'success');
                            close();
                            loadList();
                        } catch (err) {
                            fb.textContent = err.message;
                            mc.querySelector('#rename-save').disabled = false;
                            mc.querySelector('#rename-save').textContent = 'Save Name';
                        }
                    };
                    // Close on backdrop click
                    mc.querySelector('div').addEventListener('click', (e) => { if (e.target === mc.firstElementChild) close(); });
                };
            });

            listView.querySelectorAll('.hier-manage-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const mode = btn.dataset.mode; // 'parent' or 'child'
                    const id = btn.dataset.id;
                    const type = btn.dataset.type;

                    // Store manage state — used after save to deactivate old record
                    _manageState = { type, id };

                    // Switch to correct form mode
                    const radio = container.querySelector(`input[name="hier-mode"][value="${mode}"]`);
                    if (radio && !radio.checked) { radio.checked = true; radio.click(); }

                    // Open + scroll to create accordion
                    const acc = container.querySelector('#hier-create-accordion');
                    if (acc) {
                        acc.classList.add('open');
                        setTimeout(() => acc.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                    }

                    // Style createBtn as "Manage" mode
                    createBtn.textContent = `Save as Modified ${mode === 'parent' ? label : subLabel}`;
                    createBtn.style.background = '#d97706';
                    createBtn.style.color = '#fff';

                    // Load dropdowns, then pre-fill all fields
                    await loadDropdowns();

                    if (mode === 'parent') {
                        const setVal = (sel, val) => { const el = container.querySelector(sel); if (el) el.value = val; };
                        setVal('#p-name', btn.dataset.name);
                        setVal('#p-code', btn.dataset.code);
                        setVal('#p-type', btn.dataset.ptype);
                        setVal('#p-desc', btn.dataset.desc);

                        if (entity === 'services') {
                            setVal('#p-svc-subsystem', btn.dataset.subsystemId);
                        } else if (entity === 'systems') {
                            const instSel = container.querySelector('#p-sys-institute');
                            if (instSel && btn.dataset.instituteId) {
                                instSel.value = btn.dataset.instituteId;
                                instSel.dispatchEvent(new Event('change'));
                                await new Promise(r => setTimeout(r, 700));
                            }
                            setVal('#p-sys-lead', btn.dataset.leadId);
                        }
                    } else {
                        const setVal = (sel, val) => { const el = container.querySelector(sel); if (el) el.value = val; };
                        setVal('#c-name', btn.dataset.name);
                        setVal('#c-code', btn.dataset.code);
                        setVal('#c-type', btn.dataset.ptype);
                        setVal('#c-desc', btn.dataset.desc);

                        const parentSel = container.querySelector('#c-parent-id');
                        if (parentSel && btn.dataset.parentId) {
                            parentSel.value = btn.dataset.parentId;
                            if (entity === 'systems') {
                                parentSel.dispatchEvent(new Event('change'));
                                await new Promise(r => setTimeout(r, 700));
                                setVal('#c-sys-lead', btn.dataset.leadId);
                            }
                        }
                    }

                    _showToast(`Editing "${btn.dataset.name}" — save the form above to create a modified version`, 'info');
                };
            });

            listView.querySelectorAll('.map-workflow-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const wfid = btn.dataset.id;
                    openMapModal(wfid);
                };
            });

            listView.querySelectorAll('.change-lead-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const type = btn.dataset.type;
                    const id = btn.dataset.id;
                    const instId = btn.dataset.instId;

                    // Highlight the row/accordion
                    const parentItem = btn.closest('.adm-accordion') || btn.closest('tr');
                    if (parentItem) parentItem.classList.add('adm-highlight-lead');

                    // Fetch eligible leads filtered by institute (using new optimized endpoint)
                    try {
                        const loadingModal = `
                            <div class="adm-modal-overlay open" style="z-index:9999;">
                                <div class="adm-modal-card" style="width:300px; padding:2rem; text-align:center; border-radius:12px; background:#fff;">
                                    <div class="adm-spinner" style="margin:0 auto 1rem;"></div>
                                    <div style="font-size:0.9rem; color:#475569; font-weight:600;">Fetching eligible leads...</div>
                                </div>
                            </div>`;
                        const lDiv = document.createElement('div'); lDiv.innerHTML = loadingModal;
                        document.body.appendChild(lDiv);

                        const res = await authFetch(`${BASE_URL}/api/auth/admin/users/by-institute?entity_id=${id}&type=${type}`);
                        lDiv.remove();

                        const eligible = await res.json();
                        if (!res.ok) throw new Error(eligible.error || 'Failed to fetch users');

                        const modalHtml = `
                            <div class="adm-modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999; animation: admFadeIn 0.2s ease;">
                                <div class="adm-modal-card" style="background:#fff; width:450px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; animation: admSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                                    <div style="padding:1.5rem; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between;">
                                        <div style="display:flex; align-items:center; gap:12px;">
                                            <div style="width:40px; height:40px; border-radius:10px; background:#eef2ff; color:#6366f1; display:flex; align-items:center; justify-content:center;">
                                                <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/user-plus.svg); mask-image: url(/assets/icons/user-plus.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                                            </div>
                                            <div>
                                                <h3 style="margin:0; font-size:1.1rem; color:#1e293b;">Modify Lead</h3>
                                                <p style="margin:0; font-size:0.75rem; color:#64748b;">Assigning for ${type}: ${id}</p>
                                            </div>
                                        </div>
                                        <button class="close-modal-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/x.svg); mask-image: url(/assets/icons/x.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span></button>
                                    </div>
                                    <div style="padding:1.5rem;">
                                        <div style="margin-bottom:1.5rem;">
                                            <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;">Select Authorized Lead</label>
                                            <select class="adm-select" id="new-lead-select" style="height:48px; font-size:0.95rem; border-radius:8px; border:2px solid #eef2ff; transition:all 0.2s;" ${eligible.length === 0 ? 'disabled' : ''}>
                                                <option value="">-- Choose Candidate --</option>
                                                ${eligible.map(u => `<option value="${u.id}">${__esc(u.name)} (${__esc(u.email)})</option>`).join('')}
                                            </select>
                                            <p style="margin-top:8px; font-size:0.7rem; color:#94a3b8;">
                                                ${eligible.length === 0 ? '⚠️ No users available for this institute.' : 'Only users affiliated with this institute are listed.'}
                                            </p>
                                        </div>

                                        <!-- User Detail Context Box -->
                                        <div id="lead-user-context" style="margin-bottom:1.5rem; display:none; padding:1rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; animation: admFadeIn 0.3s ease;">
                                            <div id="lead-user-context-loading" style="display:none; text-align:center; padding:0.5rem;">
                                                <div class="adm-spinner" style="width:16px; height:16px; margin:0 auto;"></div>
                                            </div>
                                            <div id="lead-user-context-data"></div>
                                        </div>

                                        <div style="display:flex; gap:12px;">
                                            <button class="adm-btn adm-btn-secondary cancel-modal-btn" style="flex:1; height:44px; border-radius:10px; font-weight:600;">Cancel</button>
                                            <button class="adm-btn adm-btn-primary save-lead-btn" style="flex:1.5; height:44px; border-radius:10px; background:#6366f1; font-weight:600;">Assign Lead</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;

                        const modalContainer = document.createElement('div');
                        modalContainer.id = 'lead-assign-modal';
                        modalContainer.innerHTML = modalHtml;
                        document.body.appendChild(modalContainer);
                        const select = modalContainer.querySelector('#new-lead-select');
                        const contextBox = modalContainer.querySelector('#lead-user-context');
                        const contextData = modalContainer.querySelector('#lead-user-context-data');
                        const contextLoading = modalContainer.querySelector('#lead-user-context-loading');

                        select.onchange = async () => {
                            const email = select.options[select.selectedIndex].text.match(/\(([^)]+)\)/)?.[1];
                            if (!email) {
                                contextBox.style.display = 'none';
                                return;
                            }

                            contextBox.style.display = 'block';
                            contextLoading.style.display = 'block';
                            contextData.innerHTML = '';

                            try {
                                const dRes = await authFetch(`${BASE_URL}/api/auth/admin/users/details?identifier=${encodeURIComponent(email)}`);
                                if (!dRes.ok) throw new Error();
                                const d = await dRes.json();

                                contextLoading.style.display = 'none';
                                contextData.innerHTML = `
                                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:1rem; font-family:'Inter', sans-serif;">
                                        <!-- Card Header -->
                                        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding-bottom:0.75rem;">
                                            <span style="font-size:0.75rem; font-weight:800; color:#6366f1; text-transform:uppercase; letter-spacing:0.05em;">Candidate Profile Card</span>
                                            <span style="font-size:0.7rem; font-weight:600; color:#94a3b8;">ID: ${__esc(d.user_id ? d.user_id.substring(0, 8) : '—')}...</span>
                                        </div>

                                        <!-- Name -->
                                        <div style="display:flex; align-items:flex-start; gap:10px;">
                                            <div style="width:28px; height:28px; border-radius:6px; background:#eef2ff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                                <span class="extracted-svg" style="width:14px; height:14px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/user.svg); mask-image: url(/assets/icons/user.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                                            </div>
                                            <div style="display:flex; flex-direction:column;">
                                                <span style="font-size:0.7rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.02em;">Full Name</span>
                                                <strong style="font-size:0.9rem; color:#1e293b; font-weight:700;">${__esc(d.name || '')}</strong>
                                            </div>
                                        </div>

                                        <!-- Institute -->
                                        <div style="display:flex; align-items:flex-start; gap:10px;">
                                            <div style="width:28px; height:28px; border-radius:6px; background:#eef2ff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                                <span class="extracted-svg" style="width:14px; height:14px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/home.svg); mask-image: url(/assets/icons/home.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                                            </div>
                                            <div style="display:flex; flex-direction:column;">
                                                <span style="font-size:0.7rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.02em;">Affiliated Institute</span>
                                                <span style="font-size:0.85rem; color:#334155; font-weight:600;">${__esc(d.institute_name || d.institutes || '—')}</span>
                                            </div>
                                        </div>

                                        <!-- Category -->
                                        <div style="display:flex; align-items:flex-start; gap:10px;">
                                            <div style="width:28px; height:28px; border-radius:6px; background:#eef2ff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                                <span class="extracted-svg" style="width:14px; height:14px; color:#6366f1; display: inline-block; -webkit-mask-image: url(/assets/icons/tag.svg); mask-image: url(/assets/icons/tag.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                                            </div>
                                            <div style="display:flex; flex-direction:column;">
                                                <span style="font-size:0.7rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.02em;">User Category</span>
                                                <span style="font-size:0.8rem; color:#6366f1; font-weight:800; text-transform:uppercase; letter-spacing:0.02em;">${__esc(d.category_name || d.category || 'N/A')}</span>
                                            </div>
                                        </div>

                                        <!-- Supervisor (Conditional Student Check) -->
                                        ${(d.category_name || '').toLowerCase().includes('student') && d.supervisor_name ? `
                                        <div style="display:flex; align-items:flex-start; gap:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px; margin-top:0.25rem;">
                                            <div style="width:28px; height:28px; border-radius:6px; background:#fef3c7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                                <span class="extracted-svg" style="width:14px; height:14px; color:#d97706; display: inline-block; -webkit-mask-image: url(/assets/icons/users.svg); mask-image: url(/assets/icons/users.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                                            </div>
                                            <div style="display:flex; flex-direction:column;">
                                                <span style="font-size:0.7rem; color:#b45309; font-weight:700; text-transform:uppercase; letter-spacing:0.02em;">Assigned Supervisor</span>
                                                <span style="font-size:0.85rem; color:#92400e; font-weight:800;">${__esc(d.supervisor_name)}</span>
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>
                                `;
                            } catch (_) {
                                contextLoading.style.display = 'none';
                                contextData.innerHTML = '<div style="font-size:0.8rem; color:#ef4444;">No user details available</div>';
                            }
                        };

                        const closeModal = () => {
                            modalContainer.style.opacity = '0';
                            setTimeout(() => modalContainer.remove(), 200);
                        };

                        modalContainer.querySelector('.close-modal-btn').onclick = closeModal;
                        modalContainer.querySelector('.cancel-modal-btn').onclick = closeModal;

                        modalContainer.querySelector('.save-lead-btn').onclick = async () => {
                            const newLeadId = modalContainer.querySelector('select').value;
                            if (!newLeadId) {
                                _showToast('Please select a lead', 'error');
                                return;
                            }

                            try {
                                const saveRes = await authFetch(`${BASE_URL}/api/auth/admin/data/${type}/${id}/change-lead`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ user_id: newLeadId })
                                });
                                if (saveRes.ok) {
                                    _showToast('Lead assigned successfully', 'success');
                                    closeModal();
                                    loadList();
                                } else {
                                    _showToast('Failed to assign lead', 'error');
                                }
                            } catch (_) { _showToast('Error updating lead', 'error'); }
                        };
                    } catch (_) { _showToast('Error loading candidates', 'error'); }
                };
            });
        } catch (_) { listView.innerHTML = 'Error loading data.'; }
    };
    loadList();
}

export async function _buildSimpleListPageHtml(entity) {
    let label = entity.charAt(0).toUpperCase() + entity.slice(1);
    let placeholder = "e.g. New Entry...";

    if (entity === 'titles') {
        label = "Salutation";
        placeholder = "e.g. Mr, Ms, Dr, Prof";
    } else if (entity === 'durations') {
        label = "Duration";
        placeholder = "e.g. 6 Months, 1 Year";
    } else if (entity === 'requests') {
        label = "Request Type";
        placeholder = "e.g. Local IT Access";
    }
    const showCreate = entity !== 'requests';

    return `
    <!-- Add New (Accordion) -->
    ${showCreate ? `
    <div class="adm-accordion" id="simple-create-accordion" style="margin-bottom:1.5rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/plus-circle.svg); mask-image: url(/assets/icons/plus-circle.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">ADD NEW ${label.toUpperCase()}</h4>
                    <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">DEFINE A NEW LABEL FOR THE SYSTEM</p>
                </div>
            </div>
            <span class="extracted-svg" style="width:18px; height:18px; color:#94a3b8; display: inline-block; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div class="adm-form" style="display:flex; gap:1rem; align-items:flex-end;">
                <div class="adm-form-group" style="flex:1;">
                    <label class="adm-label">${label} Name / Label</label>
                    <input type="text" id="simple-name" placeholder="${placeholder}" />
                </div>
                <button id="simple-create-btn" class="adm-btn adm-btn-primary" style="height:46px; background:#6366f1;">Save ${label}</button>
            </div>
            <div id="simple-fb" style="margin-top:0.5rem; font-size:0.85rem;"></div>
        </div>
    </div>
    ` : ''}

    <!-- List Header -->
    <div class="adm-accordion" id="simple-list-accordion" style="margin-bottom:2rem; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden;">
        <div class="adm-accordion-header" style="padding:1rem 1.25rem; background:linear-gradient(to right, #f5f3ff 20%, #fff); border-left:5px solid #6366f1; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <div style="width:36px; height:36px; border-radius:8px; background:#fff; color:#6366f1; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <span class="extracted-svg" style="display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/list.svg); mask-image: url(/assets/icons/list.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:0.95rem; color:#1e293b; font-weight:800;">EXISTING RECORDS</h4>
                    <p style="margin:0; font-size:0.7rem; color:#64748b; font-weight:600;">MANAGE CONFIGURED OPTIONS</p>
                </div>
                <span id="simple-list-count" style="margin-left:auto; background:#6366f1; color:#fff; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; min-width:24px; text-align:center; display:none;">0</span>
            </div>
            <span class="extracted-svg adm-accordion-chevron" style="color:#64748b; margin-left:10px; display: inline-block; width: 18px; height: 18px; -webkit-mask-image: url(/assets/icons/chevron-down.svg); mask-image: url(/assets/icons/chevron-down.svg); -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; background-color: currentColor;"></span>
        </div>
        <div class="adm-accordion-content" style="padding:1.5rem;">
            <div id="simple-list-container">
                <div class="adm-loading"><div class="adm-spinner"></div> Loading records...</div>
            </div>
        </div>
    </div>
    `;
}

export function _wireSimpleListPage(container, entity) {
    const createAccordion = container.querySelector('#simple-create-accordion');
    if (createAccordion) {
        createAccordion.querySelector('.adm-accordion-header').onclick = () => createAccordion.classList.toggle('open');
    }
    const listAccordion = container.querySelector('#simple-list-accordion');
    if (listAccordion) {
        listAccordion.querySelector('.adm-accordion-header').onclick = () => listAccordion.classList.toggle('open');
    }

    const btn = container.querySelector('#simple-create-btn');
    const fb = container.querySelector('#simple-fb');
    const listView = container.querySelector('#simple-list-container');

    const loadList = async () => {
        try {
            const res = await authFetch(API.ADMIN_DATA(entity));
            const rows = await res.json();
            const countBadge = container.querySelector('#simple-list-count');
            if (countBadge) {
                countBadge.textContent = rows.length;
                countBadge.style.display = 'inline-block';
            }
            listView.innerHTML = `
            <table class="adm-table">
                <thead><tr><th>Name</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead>
                <tbody>
                    ${rows.map(r => `
                    <tr>
                        <td><strong>${__esc(r.name)}</strong></td>
                        <td>
                            <span class="adm-pill ${r.is_active ? 'adm-pill-approved' : 'adm-pill-pending'}">
                                ${r.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td style="text-align:right; display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:0.75rem 1rem;">
                            <button class="adm-btn simple-rename-btn" data-id="${r.id}" data-name="${__esc(r.name)}" title="Rename" style="padding:3px 10px; font-size:0.7rem; height:auto; border-radius:6px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; align-items:center; gap:4px; color:#6366f1; font-weight:600; cursor:pointer;">
                                <span class="extracted-svg" style="width:11px; height:11px; display:inline-block; -webkit-mask-image:url(/assets/icons/edit-2.svg); mask-image:url(/assets/icons/edit-2.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                Rename
                            </button>
                            <label class="adm-switch">
                                <input type="checkbox" class="simple-toggle-switch" data-id="${r.id}" ${r.is_active ? 'checked' : ''}>
                                <span class="adm-switch-slider"></span>
                            </label>
                            ${(entity === 'durations' || entity === 'titles') ? `
                            <button class="adm-btn simple-remove-btn" data-id="${r.id}" title="Remove" style="padding:4px; border-radius:6px; background:#fef2f2; border:1px solid #fecaca; display:flex; align-items:center; justify-content:center; color:#ef4444; cursor:pointer; margin-left:4px;">
                                <span class="extracted-svg" style="width:14px; height:14px; display:inline-block; -webkit-mask-image:url(/assets/icons/trash-2.svg); mask-image:url(/assets/icons/trash-2.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                            </button>
                            ` : ''}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

            listView.querySelectorAll('.simple-rename-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const currentName = btn.dataset.name;
                    const mc = document.createElement('div');
                    mc.innerHTML = `
                        <div style="position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,0.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;">
                            <div style="background:#fff; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); padding:2rem; width:400px; max-width:95vw;">
                                <div style="display:flex; align-items:center; gap:12px; margin-bottom:1.5rem;">
                                    <div style="width:36px; height:36px; border-radius:8px; background:#eef2ff; display:flex; align-items:center; justify-content:center;">
                                        <span class="extracted-svg" style="width:16px; height:16px; color:#6366f1; display:inline-block; -webkit-mask-image:url(/assets/icons/edit-2.svg); mask-image:url(/assets/icons/edit-2.svg); -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; -webkit-mask-position:center; mask-position:center; background-color:currentColor;"></span>
                                    </div>
                                    <div>
                                        <h3 style="margin:0; font-size:1rem; color:#1e293b; font-weight:800;">Rename</h3>
                                        <p style="margin:0; font-size:0.72rem; color:#64748b;">Current: <em>${__esc(currentName)}</em></p>
                                    </div>
                                </div>
                                <label style="display:block; font-size:0.72rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">New Name</label>
                                <input id="sr-input" type="text" value="${__esc(currentName)}" style="width:100%; box-sizing:border-box; border:2px solid #e2e8f0; border-radius:8px; padding:10px 14px; font-size:0.95rem; color:#1e293b; outline:none; margin-bottom:6px;" />
                                <div id="sr-fb" style="font-size:0.8rem; color:#ef4444; min-height:18px; margin-bottom:1rem;"></div>
                                <div style="display:flex; gap:10px;">
                                    <button id="sr-cancel" style="flex:1; height:42px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; color:#64748b; font-weight:600; cursor:pointer;">Cancel</button>
                                    <button id="sr-save" style="flex:1.5; height:42px; border-radius:10px; background:#6366f1; color:#fff; border:none; font-weight:700; cursor:pointer;">Save</button>
                                </div>
                            </div>
                        </div>`;
                    document.body.appendChild(mc);
                    const input = mc.querySelector('#sr-input');
                    const fb = mc.querySelector('#sr-fb');
                    input.focus(); input.select();
                    const close = () => mc.remove();
                    mc.querySelector('#sr-cancel').onclick = close;
                    mc.querySelector('#sr-save').onclick = async () => {
                        const newName = input.value.trim();
                        if (!newName) { fb.textContent = 'Name cannot be empty.'; return; }
                        if (newName === currentName) { close(); return; }
                        mc.querySelector('#sr-save').disabled = true;
                        mc.querySelector('#sr-save').textContent = 'Saving...';
                        try {
                            const res = await authFetch(`${BASE_URL}/api/auth/admin/data/${entity}/${id}/rename`, {
                                method: 'PATCH', body: JSON.stringify({ name: newName })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed');
                            _showToast('Renamed successfully', 'success');
                            close(); loadList();
                        } catch (err) {
                            fb.textContent = err.message;
                            mc.querySelector('#sr-save').disabled = false;
                            mc.querySelector('#sr-save').textContent = 'Save';
                        }
                    };
                    mc.querySelector('div').addEventListener('click', (e) => { if (e.target === mc.firstElementChild) close(); });
                };
            });

            listView.querySelectorAll('.simple-toggle-switch').forEach(sw => {
                sw.onchange = async () => {
                    try {
                        const tRes = await authFetch(`${BASE_URL}/api/auth/admin/data/${entity}/${sw.dataset.id}/toggle`, { method: 'PATCH' });
                        if (tRes.ok) {
                            _showToast('Status updated successfully', 'success');
                            loadList();
                        } else {
                            _showToast('Failed to update status', 'error');
                            sw.checked = !sw.checked;
                        }
                    } catch (_) {
                        _showToast('Failed to update status', 'error');
                        sw.checked = !sw.checked;
                    }
                };
            });

            listView.querySelectorAll('.simple-remove-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm('Are you sure you want to permanently remove this item? This action cannot be undone.')) return;
                    
                    const id = btn.dataset.id;
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = '<div class="adm-spinner" style="width:12px;height:12px;"></div>';
                    btn.disabled = true;

                    try {
                        const res = await authFetch(`${BASE_URL}/api/auth/admin/data/${entity}/${id}`, { method: 'DELETE' });
                        if (res.ok) {
                            _showToast('Removed successfully', 'info');
                            loadList();
                        } else {
                            const errData = await res.json();
                            _showToast(errData.error || 'Failed to remove', 'error');
                            btn.innerHTML = originalHtml;
                            btn.disabled = false;
                        }
                    } catch (err) {
                        _showToast(err.message, 'error');
                        btn.innerHTML = originalHtml;
                        btn.disabled = false;
                    }
                };
            });
        } catch (_) { listView.innerHTML = 'Error loading.'; }
    };

    if (btn) {
        btn.onclick = async () => {
            const name = container.querySelector('#simple-name').value.trim();
            if (!name) return;
            btn.disabled = true;
            try {
                const res = await authFetch(`${BASE_URL}/api/auth/admin/data/${entity}`, {
                    method: 'POST',
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    _showToast('Created successfully');
                    container.querySelector('#simple-name').value = '';
                    loadList();
                }
            } finally { btn.disabled = false; }
        };
    }
    loadList();
}
