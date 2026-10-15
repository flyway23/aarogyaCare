import { io } from 'socket.io-client';
import { getAccessToken } from './client.js';

export const connectStaffSocket = () =>
  io(window.location.origin, {
    path: '/socket.io',
    auth: { token: getAccessToken() },
    reconnection: true,
  });
