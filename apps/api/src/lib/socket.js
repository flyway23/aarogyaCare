import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';

let io;

/** @param {import('node:http').Server} httpServer @returns {Server} */
export const attachSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      if (
        payload.type !== 'access' ||
        !['operator', 'doctor', 'admin'].includes(
          String(payload.role).toLowerCase(),
        )
      ) {
        return next(new Error('Staff access required'));
      }
      socket.data.user = {
        id: payload.sub,
        role: String(payload.role).toLowerCase(),
      };
      return next();
    } catch {
      return next(new Error('Invalid access token'));
    }
  });
  io.on('connection', (socket) => socket.join('staff'));
  return io;
};

/** @returns {Server | undefined} */
export const getSocketServer = () => io;

/** @returns {Promise<void>} */
export const closeSocketServer = async () => {
  if (!io) return;
  const current = io;
  io = undefined;
  await new Promise((resolve) => current.close(resolve));
};
