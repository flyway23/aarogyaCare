import { HttpError } from '../lib/httpError.js';

/** @param {Error} error @param {import('express').Request} req @param {import('express').Response} res @param {import('express').NextFunction} _next @returns {void} */
export const errorHandler = (error, _req, res, _next) => {
  const prismaStatus =
    error.code === 'P2002'
      ? 409
      : error.code === 'P2025'
        ? 404
        : error.code === 'P2003'
          ? 409
          : null;
  const status =
    error instanceof HttpError ? error.status : (prismaStatus ?? 500);
  const message =
    status === 500
      ? 'Internal server error'
      : error instanceof HttpError
        ? error.message
        : error.code === 'P2002'
          ? 'A record with these values already exists'
          : error.code === 'P2025'
            ? 'Resource item not found'
            : 'This item is referenced by another record';
  if (status === 500) console.error(error);
  res.status(status).json({ success: false, message });
};
