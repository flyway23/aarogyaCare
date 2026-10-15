import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { sendEmail } from '../../lib/mailer.js';

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isActive: true,
  deletedAt: true,
};
const refreshTtlSeconds = 7 * 24 * 60 * 60;

/** @param {Record<string, unknown>} user @returns {{id:string,email:string,name:string,phone:string|null,role:string}} */
const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  phone: user.phone,
  role: user.role.toLowerCase(),
});

/** @param {{id:string,role:string}} user @returns {{accessToken:string,refreshToken:string}} */
const createSessionTokens = (user) => ({
  accessToken: jwt.sign(
    { type: 'access', role: user.role.toLowerCase() },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: '15m',
    },
  ),
  refreshToken: jwt.sign({ type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    subject: user.id,
    jwtid: randomUUID(),
    expiresIn: '7d',
  }),
});

/** @param {{name:string,email:string,password:string,phone?:string|null}} input @returns {Promise<{user:object,accessToken:string,refreshToken:string}>} */
export const registerPatient = async (input) => {
  const email = input.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email,
        passwordHash,
        phone: input.phone ?? null,
        role: 'PATIENT',
        patientProfile: { create: {} },
      },
      select: userSelect,
    });
    return { user: toPublicUser(user), ...createSessionTokens(user) };
  } catch (error) {
    if (error.code === 'P2002')
      throw new HttpError(409, 'An account with this email already exists');
    throw error;
  }
};

/** @param {{email:string,password:string}} input @returns {Promise<{user:object,accessToken:string,refreshToken:string}>} */
export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (
    !user ||
    !user.isActive ||
    user.deletedAt ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  return { user: toPublicUser(user), ...createSessionTokens(user) };
};

/** @param {string} token @returns {Promise<{user:object,accessToken:string,refreshToken:string}>} */
export const refreshSession = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new HttpError(401, 'Invalid or expired refresh token');
  }
  if (
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new HttpError(401, 'Invalid refresh token');
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: userSelect,
  });
  if (!user || !user.isActive || user.deletedAt)
    throw new HttpError(401, 'Account is unavailable');
  const accepted = await redis.set(`revoked-refresh:${payload.jti}`, '1', {
    EX: refreshTtlSeconds,
    NX: true,
  });
  if (!accepted) throw new HttpError(401, 'Refresh token has been revoked');
  return { user: toPublicUser(user), ...createSessionTokens(user) };
};

/** @param {string|undefined} token @returns {Promise<void>} */
export const revokeRefreshToken = async (token) => {
  if (!token) return;
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (payload.type === 'refresh' && typeof payload.jti === 'string') {
      await redis.set(`revoked-refresh:${payload.jti}`, '1', {
        EX: refreshTtlSeconds,
      });
    }
  } catch {
    // Clearing an absent or expired cookie is still a successful logout.
  }
};

/** @param {string} email @returns {Promise<void>} */
export const sendPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || !user.isActive || user.deletedAt) return;
  const token = jwt.sign({ type: 'password-reset' }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    jwtid: randomUUID(),
    expiresIn: '15m',
  });
  await sendEmail({
    to: user.email,
    subject: 'AarogyaCare password reset',
    text: `Use this one-time password reset token within 15 minutes: ${token}`,
  });
};

/** @param {{token:string,password:string}} input @returns {Promise<void>} */
export const resetUserPassword = async ({ token, password }) => {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    throw new HttpError(400, 'Reset token is invalid or expired');
  }
  if (
    payload.type !== 'password-reset' ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new HttpError(400, 'Reset token is invalid');
  }
  const key = `used-password-reset:${payload.jti}`;
  const accepted = await redis.set(key, '1', { EX: 15 * 60, NX: true });
  if (!accepted) throw new HttpError(400, 'Reset token has already been used');
  await prisma.user.update({
    where: { id: payload.sub },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });
};

/** @param {string} id @returns {Promise<object>} */
export const getCurrentUser = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
  if (!user || !user.isActive || user.deletedAt)
    throw new HttpError(401, 'Account is unavailable');
  return toPublicUser(user);
};
