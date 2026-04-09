export function isLoggedIn() {
  return !!localStorage.getItem('auth_token');
}

export function logout() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '#/login';
}