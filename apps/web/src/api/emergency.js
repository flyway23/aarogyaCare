import { api } from './client.js';

export const raiseEmergency = async (payload) =>
  (await api.post('/emergency', payload)).data.data;
export const getEmergencies = async () =>
  (await api.get('/emergency')).data.data;
export const acceptEmergency = async (id) =>
  (await api.post(`/emergency/${id}/accept`, {})).data.data;
export const reserveEmergencyBed = async (id, bedId) =>
  (await api.post(`/emergency/${id}/reserve-bed`, { bedId })).data.data;
export const closeEmergency = async (id) =>
  (await api.post(`/emergency/${id}/close`, {})).data.data;
export const escalateAppointment = async (id, payload) =>
  (await api.post(`/appointments/${id}/escalate`, payload)).data.data;
