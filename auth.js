(function () {
  const API_URL_AUTH = 'http://localhost:3000/api';
  const SESSION_TTL_MS = 60 * 60 * 1000; // 60 минут

  function saveToken(token, user) {
    localStorage.setItem('avabid_token', token);
    localStorage.setItem('avabid_user', JSON.stringify(user));
    localStorage.setItem('avabid_expiresAt', Date.now() + SESSION_TTL_MS);
  }

  function getToken() {
    const token = localStorage.getItem('avabid_token');
    const expiresAt = localStorage.getItem('avabid_expiresAt');
    if (!token || !expiresAt) return null;
    if (Date.now() > parseInt(expiresAt)) {
      logout();
      return null;
    }
    localStorage.setItem('avabid_expiresAt', Date.now() + SESSION_TTL_MS);
    return token;
  }

  function getUser() {
    const user = localStorage.getItem('avabid_user');
    return user ? JSON.parse(user) : null;
  }

  function logout() {
    localStorage.removeItem('avabid_token');
    localStorage.removeItem('avabid_user');
    localStorage.removeItem('avabid_expiresAt');
    const basePath = window.location.pathname.includes('/pages/') ? '' : 'pages/';
    window.location.href = basePath + 'login.html';
  }

  function isAuthenticated() {
    return !!getToken();
  }

  async function register(name, email, password) {
    const response = await fetch(`${API_URL_AUTH}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка регистрации');
    saveToken(data.token, data.user);
    return data;
  }

  async function login(email, password) {
    const response = await fetch(`${API_URL_AUTH}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка входа');
    saveToken(data.token, data.user);
    return data;
  }

  async function fetchCurrentUser() {
    const token = getToken();
    if (!token) throw new Error('Нет токена');

    const response = await fetch(`${API_URL_AUTH}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) logout();
      throw new Error('Не удалось загрузить профиль');
    }

    const user = await response.json();
    localStorage.setItem('avabid_user', JSON.stringify(user));
    return user;
  }

  // Экспортируем функции в глобальную область, чтобы использовать их в HTML
  window.saveToken = saveToken;
  window.getToken = getToken;
  window.getUser = getUser;
  window.logout = logout;
  window.isAuthenticated = isAuthenticated;
  window.register = register;
  window.login = login;
  window.fetchCurrentUser = fetchCurrentUser;
})();