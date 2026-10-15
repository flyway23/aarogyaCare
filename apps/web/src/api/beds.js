import { api } from './client.js';

export const getBeds = async () => (await api.get('/beds')).data.data;
export const reserveBed = async (id) =>
  (await api.post(`/beds/${id}/reserve`, {})).data.data;
export const assignBed = async (id, input) =>
  (await api.post(`/beds/${id}/assign`, input)).data.data;
export const releaseBed = async (id) =>
  (await api.post(`/beds/${id}/release`, {})).data.data;
export const setBedStatus = async (id, status) =>
  (await api.post(`/beds/${id}/status`, { status })).data.data;
