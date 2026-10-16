import { api } from './client.js';

export const getRecords = async () => (await api.get('/records')).data.data;
export const exportRecords = async () =>
  (await api.get('/records/export', { responseType: 'blob' })).data;
export const getMessages = async (id) =>
  (await api.get(`/chat/${id}/messages`)).data.data;
export const sendMessage = async ({ id, text }) =>
  (await api.post(`/chat/${id}/messages`, { text })).data.data;
export const sendFeedback = async (body) =>
  (await api.post('/feedback', body)).data.data;
export const getConsents = async () => (await api.get('/consents')).data.data;
export const setConsent = async (body) =>
  (await api.put('/consents', body)).data.data;
export const getAccessHistory = async () =>
  (await api.get('/access-history')).data.data;
export const getNotifications = async () =>
  (await api.get('/notifications')).data.data;
export const markNotificationRead = async (id) =>
  (await api.post(`/notifications/${id}/read`, {})).data.data;
export const reschedule = async ({ id, slotStart }) =>
  (await api.post(`/appointments/${id}/reschedule`, { slotStart })).data.data;
