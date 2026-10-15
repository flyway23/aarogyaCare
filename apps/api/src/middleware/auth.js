import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';

/** @param {import('express').Request} req @param {import('express').Response} _res @param {import('express').NextFunction} next @returns {void} */
export const auth = (req, _res, next) => {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token)
    return next(new HttpError(401, 'Authentication required'));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (
      payload.type !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return next(new HttpError(401, 'Invalid access token'));
    }
    req.user = { id: payload.sub, role: payload.role.toLowerCase() };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token'));
  }
};
