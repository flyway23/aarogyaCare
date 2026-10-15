import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { respond } from '../../lib/respond.js';
import {
  getCurrentUser,
  loginUser,
  refreshSession,
  registerPatient,
  resetUserPassword,
  revokeRefreshToken,
  sendPasswordReset,
} from './service.js';

const cookieName = 'aarogyacare_refresh';
const cookieBase = `HttpOnly; SameSite=Lax; Path=/api/auth${env.NODE_ENV === 'production' ? '; Secure' : ''}`;

/** @param {import('express').Response} res @param {string} token @returns {void} */
const setRefreshCookie = (res, token) =>
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(token)}; ${cookieBase}; Max-Age=604800`,
  );

/** @param {import('express').Request} req @returns {string|undefined} */
const readRefreshCookie = (req) => {
  const item = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return item
    ? decodeURIComponent(item.slice(cookieName.length + 1))
    : undefined;
};

/** @param {import('express').Response} res @returns {void} */
const clearRefreshCookie = (res) =>
  res.setHeader('Set-Cookie', `${cookieName}=; ${cookieBase}; Max-Age=0`);

export const register = asyncHandler(async (req, res) => {
  const result = await registerPatient(req.body);
  setRefreshCookie(res, result.refreshToken);
  res.status(201);
  respond(res, { accessToken: result.accessToken, user: result.user });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  setRefreshCookie(res, result.refreshToken);
  respond(res, { accessToken: result.accessToken, user: result.user });
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await refreshSession(readRefreshCookie(req));
  setRefreshCookie(res, result.refreshToken);
  respond(res, { accessToken: result.accessToken, user: result.user });
});

export const logout = asyncHandler(async (req, res) => {
  await revokeRefreshToken(readRefreshCookie(req));
  clearRefreshCookie(res);
  respond(res, { message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  respond(res, await getCurrentUser(req.user.id));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await sendPasswordReset(req.body.email);
  respond(res, {
    message:
      'If the account exists, password reset instructions have been sent',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await resetUserPassword(req.body);
  respond(res, { message: 'Password has been reset' });
});
