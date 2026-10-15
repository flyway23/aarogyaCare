import { api } from './client.js';

export const login = async (values) =>
  (await api.post('/auth/login', values)).data.data;
export const register = async (values) =>
  (await api.post('/auth/register', values)).data.data;
export const getMe = async () => (await api.get('/auth/me')).data.data;
export const logout = async () =>
  (await api.post('/auth/logout', {})).data.data;
