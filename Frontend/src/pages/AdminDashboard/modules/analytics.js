import { authFetch } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';

export function renderTabAnalytics(container) {
    container.innerHTML = `<div class="db-tracker-card"><div class="db-loading-inline"><div class="spinner"></div></div></div>`;

    // Load Chart.js dynamically if not present
    if (!window.Chart) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => renderAnalyticsUI(container);
        script.onerror = () => container.innerHTML = `<div class="db-error-msg">Failed to load Chart.js library.</div>`;
        document.head.appendChild(script);
    } else {
        renderAnalyticsUI(container);
    }
}

function loadAnalyticsData(container, range = 'daily', start = '', end = '') {
    let url = API.ADMIN_ANALYTICS + '?range=' + range;
    if (range === 'custom') {
        url += '&start_date=' + start + '&end_date=' + end;
    }

    const grid = container.querySelector('#analytics-charts-grid');
    const emptyState = container.querySelector('#analytics-empty-state');
    
    if (grid) grid.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = '<div class="db-loading-inline"><div class="spinner"></div></div>';
    }

    authFetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            renderChart(container, data, range);
        }).catch(err => {
            const emptyState = container.querySelector('#analytics-empty-state');
            if (emptyState) {
                emptyState.innerHTML = `<div class="db-error-msg">${err.message}</div>`;
                emptyState.style.display = 'block';
            }
        });
}

function renderAnalyticsUI(container) {
    let html = `
    <div class="db-tracker-card" style="padding: 2.5rem; max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="background: #e0e7ff; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #4f46e5;">
                    <span class="extracted-svg" style="-webkit-mask: url(/assets/icons/pie-chart.svg) no-repeat center; mask: url(/assets/icons/pie-chart.svg) no-repeat center; -webkit-mask-size: contain; mask-size: contain; background-color: currentColor; width: 24px; height: 24px; display: inline-block;"></span>
                </div>
                <div>
                    <h2 style="margin: 0; font-size: 1.5rem; font-weight: 800; color: #0f172a;">Reports & Analytics</h2>
                    <p style="margin: 0.25rem 0 0; color: #64748b; font-size: 0.9rem;">Analyze application proportions across timeframes.</p>
                </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; background: #f8fafc; padding: 0.25rem; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap;">
                <button class="analytics-tab-btn active" data-range="daily" style="padding: 0.5rem 1rem; border: none; background: #fff; border-radius: 6px; font-weight: 600; font-size: 0.85rem; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; transition: all 0.2s;">Daily</button>
                <button class="analytics-tab-btn" data-range="weekly" style="padding: 0.5rem 1rem; border: none; background: transparent; border-radius: 6px; font-weight: 600; font-size: 0.85rem; color: #64748b; cursor: pointer; transition: all 0.2s;">Weekly</button>
                <button class="analytics-tab-btn" data-range="monthly" style="padding: 0.5rem 1rem; border: none; background: transparent; border-radius: 6px; font-weight: 600; font-size: 0.85rem; color: #64748b; cursor: pointer; transition: all 0.2s;">Monthly</button>
                <button class="analytics-tab-btn" data-range="yearly" style="padding: 0.5rem 1rem; border: none; background: transparent; border-radius: 6px; font-weight: 600; font-size: 0.85rem; color: #64748b; cursor: pointer; transition: all 0.2s;">Yearly</button>
                <button class="analytics-tab-btn" data-range="custom" style="padding: 0.5rem 1rem; border: none; background: transparent; border-radius: 6px; font-weight: 600; font-size: 0.85rem; color: #64748b; cursor: pointer; transition: all 0.2s;">Custom</button>
            </div>
        </div>

        <div id="analytics-custom-dates" style="display: none; background: #f8fafc; padding: 1.5rem; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 2rem; display: flex; gap: 1rem; align-items: flex-end;">
            <div style="flex: 1;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem;">From Date</label>
                <input type="date" id="analytics-start-date" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
            </div>
            <div style="flex: 1;">
                <label style="display: block; font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem;">To Date</label>
                <input type="date" id="analytics-end-date" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
            </div>
            <div>
                <button id="analytics-apply-btn" style="padding: 0.6rem 1.5rem; background: #4f46e5; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s;">Apply</button>
            </div>
        </div>

        <div id="analytics-empty-state" style="display: none; padding: 3rem; text-align: center; color: #64748b; font-weight: 600; font-size: 1.1rem; background: #f8fafc; border-radius: 12px;">
            No applications found for this time period.
        </div>

        <div id="analytics-charts-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; margin-bottom: 2rem;">
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f172a;">Application Status</h3>
                <div style="position: relative; height: 250px;">
                    <canvas id="statusChart"></canvas>
                </div>
            </div>
            
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem;">
                <h3 id="inst-act-title" style="margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f172a;">Institutes (Account Activation)</h3>
                <div style="position: relative; height: 250px;">
                    <canvas id="institutesActivationChart"></canvas>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem;">
                <h3 id="inst-mod-title" style="margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f172a;">Institutes (Modify Affiliation)</h3>
                <div style="position: relative; height: 250px;">
                    <canvas id="institutesModifyChart"></canvas>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: #0f172a;">Request Types</h3>
                <div style="position: relative; height: 250px;">
                    <canvas id="requestsChart"></canvas>
                </div>
            </div>
        </div>
    </div>
    `;

    container.innerHTML = html;
    container.querySelector('#analytics-custom-dates').style.display = 'none'; // hide initially
    if (window.feather) window.feather.replace();

    // Initial render
    loadAnalyticsData(container, 'daily');

    // Wire up tabs
    const btns = container.querySelectorAll('.analytics-tab-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            btns.forEach(b => {
                b.style.background = 'transparent';
                b.style.color = '#64748b';
                b.style.boxShadow = 'none';
                b.classList.remove('active');
            });
            const target = e.currentTarget;
            target.style.background = '#fff';
            target.style.color = '#0f172a';
            target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            target.classList.add('active');
            
            const range = target.getAttribute('data-range');
            const customDatesDiv = container.querySelector('#analytics-custom-dates');
            
            if (range === 'custom') {
                customDatesDiv.style.display = 'flex';
                // Don't auto-load, wait for Apply
            } else {
                customDatesDiv.style.display = 'none';
                loadAnalyticsData(container, range);
            }
        });
    });

    container.querySelector('#analytics-apply-btn').addEventListener('click', () => {
        const start = container.querySelector('#analytics-start-date').value;
        const end = container.querySelector('#analytics-end-date').value;
        loadAnalyticsData(container, 'custom', start, end);
    });
}

let statusChart = null;
let instChart = null;
let reqChart = null;

function renderChart(container, data, range) {
    const emptyState = container.querySelector('#analytics-empty-state');
    const chartsGrid = container.querySelector('#analytics-charts-grid');
    
    if (data.total === 0) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = 'No applications found for this time period.';
        chartsGrid.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    chartsGrid.style.display = 'grid';

    const ctxStatus = container.querySelector('#statusChart').getContext('2d');
    const ctxInstAct = container.querySelector('#institutesActivationChart').getContext('2d');
    const ctxInstMod = container.querySelector('#institutesModifyChart').getContext('2d');
    const ctxReq = container.querySelector('#requestsChart').getContext('2d');
    
    if (statusChart) statusChart.destroy();
    if (window.instActChart) window.instActChart.destroy();
    if (window.instModChart) window.instModChart.destroy();
    if (reqChart) reqChart.destroy();

    // 1. Status Doughnut Chart
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Pending', 'Declined'],
            datasets: [{
                data: [data.approved, data.pending, data.declined],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: `Total Applications: ${data.total}` },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.parsed !== null) {
                                let value = context.parsed;
                                let percentage = data.total > 0 ? ((value * 100) / data.total).toFixed(1) + '%' : '0%';
                                label += value + ' (' + percentage + ')';
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });

    // 2. Institutes Chart (Account Activation)
    const instActLabels = (data.by_institute_activation || []).map(i => i.name.substring(0, 30) + (i.name.length > 30 ? '...' : ''));
    const instActData = (data.by_institute_activation || []).map(i => i.count);
    const instActTotal = instActData.reduce((a, b) => a + b, 0);
    
    document.getElementById('inst-act-title').innerText = `Institutes (Account Activation) - Total: ${instActTotal}`;

    if (instActData.length === 0) {
        ctxInstAct.canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.9rem;">No data available for this period.</div>';
    } else {
        window.instActChart = new Chart(ctxInstAct, {
            type: 'doughnut',
            data: {
                labels: instActLabels,
                datasets: [{
                    data: instActData,
                    backgroundColor: [
                        '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', 
                        '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7',
                        '#06b6d4', '#eab308', '#ef4444', '#3b82f6', '#d946ef'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    let value = context.parsed;
                                    let percentage = instActTotal > 0 ? ((value * 100) / instActTotal).toFixed(1) + '%' : '0%';
                                    label += value + ' (' + percentage + ')';
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // 2.5 Institutes Chart (Modify Affiliation)
    const instModLabels = (data.by_institute_modify || []).map(i => i.name.substring(0, 30) + (i.name.length > 30 ? '...' : ''));
    const instModData = (data.by_institute_modify || []).map(i => i.count);
    const instModTotal = instModData.reduce((a, b) => a + b, 0);

    document.getElementById('inst-mod-title').innerText = `Institutes (Modify Affiliation) - Total: ${instModTotal}`;

    if (instModData.length === 0) {
        ctxInstMod.canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.9rem;">No data available for this period.</div>';
    } else {
        window.instModChart = new Chart(ctxInstMod, {
            type: 'doughnut',
            data: {
                labels: instModLabels,
                datasets: [{
                    data: instModData,
                    backgroundColor: [
                        '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', 
                        '#d946ef', '#3b82f6', '#ef4444', '#eab308', '#06b6d4'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    let value = context.parsed;
                                    let percentage = instModTotal > 0 ? ((value * 100) / instModTotal).toFixed(1) + '%' : '0%';
                                    label += value + ' (' + percentage + ')';
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // 3. Requests Bar Chart (Horizontal)
    const reqLabels = (data.by_request || []).map(r => r.name);
    const reqData = (data.by_request || []).map(r => r.count);

    if (reqData.length === 0) {
        ctxReq.canvas.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:0.9rem;">No data available for this period.</div>';
    } else {
        reqChart = new Chart(ctxReq, {
            type: 'bar',
            data: {
                labels: reqLabels,
                datasets: [{
                    label: 'Requests',
                    data: reqData,
                    backgroundColor: '#0ea5e9',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    }
}
