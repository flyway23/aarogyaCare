import { api } from './client.js';

export const getMyProfile = async () =>
  (await api.get('/patients/me/profile')).data.data;
export const updateMyProfile = async (values) =>
  (await api.put('/patients/me/profile', values)).data.data;
