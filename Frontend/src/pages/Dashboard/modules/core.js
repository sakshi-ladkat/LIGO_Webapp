import { authFetch, getAccessToken, logout } from '../../../utils/auth.js';
import { API } from '../../../config/api.js';

export const state = {
    me: {},
    roles: [],
    permSet: new Set(),
    meData: {},
    myAppData: null,
    servicesData: null,
    titlesData: null,
    allApps: []
};

export function updateState(key, value) {
    state[key] = value;
}
