import { getCurrentUser } from '../auth/service.js';

/** @param {string} userId @returns {Promise<object>} */
export const getAdminSession = async (userId) => getCurrentUser(userId);
