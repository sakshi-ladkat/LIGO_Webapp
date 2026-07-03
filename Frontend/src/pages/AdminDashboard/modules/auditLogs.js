import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';
import { __esc } from '../../../utils/helpers.js';

export function renderTabAuditLogs(container) {
    container.innerHTML = `<div class="db-tracker-card"><div class="db-loading-inline"><div class="spinner"></div></div></div>`;

    Promise.all([
        authFetch(API.ADMIN_AUDIT_LOG_FILES).then(r => r.json()),
        authFetch(API.ADMIN_AUDIT_LOGS).then(r => r.json())
    ])
    .then(([filesData, logsData]) => {
        if (filesData.error) throw new Error(filesData.error);
        if (logsData.error) throw new Error(logsData.error);

        let html = `
        <div style="max-width: 1000px; margin: 0 auto 2rem auto; display: flex; flex-direction: column; gap: 2rem; animation: fade-in 0.3s ease-out;">
            <style>
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .audit-file-card {
                    display: flex; align-items: center; justify-content: space-between; 
                    padding: 1.25rem 1.5rem; 
                    background: #ffffff; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 12px; 
                    transition: all 0.2s ease;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }
                .audit-file-card:hover {
                    border-color: #cbd5e1; 
                    background: #f8fafc;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    transform: translateY(-2px);
                }
                .audit-download-btn {
                    padding: 0.6rem 1.2rem; 
                    background: #1e293b; 
                    border: none;
                    border-radius: 8px; 
                    font-size: 0.85rem; 
                    font-weight: 600; 
                    color: #ffffff; 
                    text-decoration: none; 
                    display: inline-flex; 
                    align-items: center; 
                    gap: 0.5rem; 
                    transition: all 0.2s;
                }
                .audit-download-btn:hover {
                    background: #0f172a;
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
                }
                .audit-icon-container {
                    background: #f0fdf4; width: 48px; height: 48px; border-radius: 14px; 
                    display: flex; align-items: center; justify-content: center; color: #16a34a;
                    box-shadow: inset 0 0 0 1px rgba(22, 163, 74, 0.1);
                }
            </style>
            <!-- Archives Section -->
            <div class="db-tracker-card" style="padding: 2.5rem; border: 1px solid #f1f5f9; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #f8fafc; padding-bottom: 1.5rem;">
                    <div class="audit-icon-container">
                        <i data-feather="download-cloud" style="width: 24px; height: 24px;"></i>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-size: 1.75rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">Daily Log Archives</h2>
                        <p style="margin: 0.25rem 0 0; color: #64748b; font-size: 0.95rem;">Download full system activity logs containing complete JSON contexts.</p>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
        `;

        if (filesData.length === 0) {
            html += `<div style="padding: 2rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">No daily archives found.</div>`;
        } else {
            filesData.forEach(file => {
                const sizeKB = (file.size / 1024).toFixed(1);
                const dateStr = new Date(file.modified_at * 1000).toLocaleString();
                html += `
                    <div class="audit-file-card">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="width: 40px; height: 40px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b;">
                                <i data-feather="file-text" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 600; color: #0f172a; font-size: 1rem;">${__esc(file.filename)}</span>
                                <span style="color: #64748b; font-size: 0.85rem; margin-top: 0.2rem;">${sizeKB} KB &bull; Last updated: ${dateStr}</span>
                            </div>
                        </div>
                        <a href="${API.ADMIN_AUDIT_LOG_DOWNLOAD(file.filename)}" target="_blank" class="audit-download-btn">
                            <i data-feather="download" style="width: 12px; height: 12px;"></i> Download
                        </a>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        </div>
        `;

        container.innerHTML = html;
        if (window.feather) window.feather.replace();

    }).catch(err => {
        container.innerHTML = `<div class="db-error-msg">${err.message}</div>`;
    });
}
