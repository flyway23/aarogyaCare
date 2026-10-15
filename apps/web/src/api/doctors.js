import { api } from './client.js';

export const getSpecialties = async () =>
  (await api.get('/specialties')).data.data;
export const getDoctors = async (specialtyId) =>
  (await api.get('/doctors', { params: specialtyId ? { specialtyId } : {} }))
    .data.data;
export const getDoctorSlots = async (doctorId, date) =>
  (await api.get(`/doctors/${doctorId}/slots`, { params: { date } })).data.data;
export const getQueueInfo = async (doctorId, date, slotStart) =>
  (
    await api.get(`/doctors/${doctorId}/queue-info`, {
      params: { date, slotStart },
    })
  ).data.data;
