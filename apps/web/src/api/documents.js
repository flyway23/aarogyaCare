import { api } from './client.js';

export const getDocuments = async () => (await api.get('/documents')).data.data;
export const uploadDocument = async ({ file, appointmentId }) => {
  const body = new FormData();
  body.append('file', file);
  if (appointmentId) body.append('appointmentId', appointmentId);
  return (await api.post('/documents', body)).data.data;
};
export const getDocumentFile = async (id) => {
  const response = await api.get(`/documents/${id}/file`, {
    responseType: 'blob',
  });
  return response.data;
};
