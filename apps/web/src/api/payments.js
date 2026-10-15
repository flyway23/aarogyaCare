import { api } from './client.js';

export const createPaymentOrder = async (appointmentId) =>
  (await api.post('/payments/create-order', { appointmentId })).data.data;
export const verifyPayment = async (payload) =>
  (await api.post('/payments/verify', payload)).data.data;
export const recordOfflinePayment = async (appointmentId, method) =>
  (await api.post('/payments/offline', { appointmentId, method })).data.data;
export const openReceipt = async (id) => {
  const tab = window.open('', '_blank');
  try {
    const response = await api.get(`/payments/${id}/receipt`, {
      responseType: 'text',
    });
    if (tab) tab.document.write(response.data);
    tab?.document.close();
  } catch (error) {
    tab?.close();
    throw error;
  }
};
