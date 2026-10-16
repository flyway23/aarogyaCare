import { api } from './client.js';

export const getAdminOverview = async () =>
  (await api.get('/admin/overview')).data.data;
export const getAdminMeta = async () =>
  (await api.get('/admin/meta')).data.data;
export const getAdminResource = async (resource, params) =>
  (await api.get(`/admin/${resource}`, { params })).data.data;
export const createAdminItem = async ({ resource, body }) =>
  (await api.post(`/admin/${resource}`, body)).data.data;
export const updateAdminItem = async ({ resource, id, body }) =>
  (await api.put(`/admin/${resource}/${id}`, body)).data.data;
export const deleteAdminItem = async ({ resource, id }) =>
  (await api.delete(`/admin/${resource}/${id}`)).data.data;
export const restoreAdminItem = async ({ resource, id }) =>
  (await api.post(`/admin/${resource}/${id}/restore`, {})).data.data;
export const exportAdminCsv = async (resource) =>
  (await api.get(`/admin/${resource}/export.csv`, { responseType: 'blob' }))
    .data;
export const getFailedDocuments = async () =>
  (await api.get('/admin/documents/failed')).data.data;
export const retryFailedDocument = async (id) =>
  (await api.post(`/admin/documents/${id}/retry`, {})).data.data;
