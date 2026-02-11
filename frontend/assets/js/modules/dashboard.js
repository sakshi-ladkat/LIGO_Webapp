let currentUser = null;

async function loadDashboard() {
    try {
        currentUser = await api('/api/me');

        document.getElementById('dashboardTitle').textContent = `Welcome, ${currentUser.username}`;
        document.getElementById('dashboardSubtitle').textContent = currentUser.email;

        setupTabs();
        loadOverview();
        loadPermissions();
        loadRoles();
        loadRequests();
        loadSettings();

    } catch (e) {
        console.error(e);
        toastr.error('Failed to load dashboard');
    }
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
        };
    });
}

async function loadPermissions() {
    const permissions = await api('/api/permissions');

    const container = document.getElementById('permissionsTab');

    container.innerHTML = Object.entries(permissions).map(([category, items]) => `
        <div class="card">
            <h4>${category}</h4>
            ${items.map(p => `
                <div>
                    <code>${p.slug}</code>
                    <small>${p.name}</small>
                </div>
            `).join('')}
        </div>
    `).join('');
}

async function loadRoles() {
    const roles = await api('/api/roles');
    document.getElementById('rolesTab').innerHTML = `
        <div class="card">
            ${roles.map(r => `<p><b>${r.name}</b> (${r.slug})</p>`).join('')}
        </div>
    `;
}

async function loadRequests() {
    const requests = await api('/api/requests');

    document.getElementById('requestsTab').innerHTML = `
        <div class="card">
            ${requests.length ? requests.map(r => `
                <p>#REQ-${r.id} - ${r.type} - ${r.status}</p>
            `).join('') : '<p>No requests found.</p>'}
        </div>
    `;
}

function loadOverview() {
    document.getElementById('overviewTab').innerHTML = `
        <div class="card">
            <h3>Quick Overview</h3>
            <p>Roles: ${currentUser.roles.map(r => r.name).join(', ')}</p>
        </div>
    `;
}

function loadSettings() {
    document.getElementById('settingsTab').innerHTML = `
        <div class="card">
            <h3>Account Settings</h3>
            <p><b>Email:</b> ${currentUser.email}</p>
        </div>
    `;
}
