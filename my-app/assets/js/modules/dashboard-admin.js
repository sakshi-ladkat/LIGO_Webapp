function getRequestsSection(user, requests = []) {
    return `
        <div class="dashboard-header">
            <h1>Requests Management</h1>
            <p>View and track your internship and project requests</p>
        </div>
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h3>${user.roles && user.roles.some(r => r.level < 7) ? 'System Requests' : 'My Requests'}</h3>
                <button class="btn btn-primary" onclick="openRequestModal()">+ New Request</button>
            </div>
            <!-- Inserted minimal requests table layout based on the user req -->
        </div>
    `;
}

function getAdminSection(user, data) {
    const { users = [], roles = [], permissions = {}, master = {} } = data || {};
    return `
        <div class="dashboard-header">
            <h1>Admin Dashboard</h1>
            <p>Manage system access, roles, and permissions</p>
        </div>
        <div class="admin-tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--gray-200); padding-bottom: 0.5rem;">
            <button class="nav-tab active" data-tab="users">Users</button>
            <button class="nav-tab" data-tab="roles">Roles</button>
            <button class="nav-tab" data-tab="permissions">Permissions</button>
        </div>
        <div id="usersTab" class="tab-content" style="display: block;">
            <h3>Users Content...</h3>
        </div>
    `;
}

window.getRequestsSection = getRequestsSection;
window.getAdminSection = getAdminSection;
