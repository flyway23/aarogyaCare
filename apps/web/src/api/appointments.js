import { api } from './client.js';

export const createAppointment = async (payload) =>
  (await api.post('/appointments', payload)).data.data;
export const getMyAppointments = async () =>
  (await api.get('/appointments/me')).data.data;
export const cancelAppointment = async (id) =>
  (await api.post(`/appointments/${id}/cancel`, {})).data.data;
export const getDoctorAppointments = async (doctorId, date) =>
  (await api.get('/appointments', { params: { doctorId, date } })).data.data;
export const confirmAppointment = async (id) =>
  (await api.post(`/appointments/${id}/confirm`, {})).data.data;
export const checkInAppointment = async (id) =>
  (await api.post(`/appointments/${id}/check-in`, {})).data.data;
export const getQueue = async (doctorId, date) =>
  (await api.get('/queue', { params: { doctorId, date } })).data.data;
export const updateQueue = async (id, action, payload = {}) =>
  (await api.post(`/queue/${id}/${action}`, payload)).data.data;
