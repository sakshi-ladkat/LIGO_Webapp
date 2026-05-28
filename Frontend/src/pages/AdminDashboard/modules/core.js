/**
 * MODULE: Core State
 * 
 * Contains the shared global state object and the root DOM container reference.
 * Modules import this to access current permissions, search queries, and the parent DOM node.
 */

export const _state = {
    applications: [],
    currentFilter: 'all',
    searchQuery: '',
    cachedInstitutesList: null,
    cachedRolesList: null,
    permissions: [],
};

export let _app = null;

export function setApp(container) {
    _app = container;
}
