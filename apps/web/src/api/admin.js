import { api } from './client.js';

export const getAdminOverview = async () =>
  (await api.get('/admin/overview')).data.data;
