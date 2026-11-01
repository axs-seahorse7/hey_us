const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? 'Something went wrong. Please try again.');
  return data;
}

export const authApi = {
  register: (credentials) => request('/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  }),
  login: (credentials) => request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  }),
  getCurrentUser: (token) => request('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }),
};
