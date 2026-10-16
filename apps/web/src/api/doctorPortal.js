import { api } from './client.js';

export const getDoctorToday = async () =>
  (await api.get('/doctor/today')).data.data;
export const getDoctorPatients = async () =>
  (await api.get('/doctor/patients')).data.data;
export const getDoctorPatientRecords = async (id) =>
  (await api.get(`/doctor/patients/${id}/records`)).data.data;
export const setDoctorStatus = async (status) =>
  (await api.put('/doctors/me/status', { status })).data.data;
export const startConsultation = async (id) =>
  (await api.post(`/consultations/${id}/start`, {})).data.data;
export const endConsultation = async (id) =>
  (await api.post(`/consultations/${id}/end`, {})).data.data;
export const createConsultationReport = async ({ id, ...body }) =>
  (await api.post(`/consultations/${id}/report`, body)).data.data;
