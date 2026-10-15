import axios from 'axios';

const accessTokenKey = 'aarogyacare_access_token';
export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(accessTokenKey);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      ['/auth/refresh', '/auth/login', '/auth/register'].some((path) =>
        originalRequest?.url?.includes(path),
      )
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const response = await api.post('/auth/refresh', {});
      const token = response.data.data.accessToken;
      localStorage.setItem(accessTokenKey, token);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      window.dispatchEvent(new Event('aarogyacare:session-refreshed'));
      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem(accessTokenKey);
      window.dispatchEvent(new Event('aarogyacare:session-expired'));
      return Promise.reject(refreshError);
    }
  },
);

export const setAccessToken = (token) =>
  localStorage.setItem(accessTokenKey, token);
export const clearAccessToken = () => localStorage.removeItem(accessTokenKey);
export const getAccessToken = () => localStorage.getItem(accessTokenKey);
