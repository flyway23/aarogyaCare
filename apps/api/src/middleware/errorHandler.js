import { HttpError } from '../lib/httpError.js';

/** @param {Error} error @param {import('express').Request} req @param {import('express').Response} res @param {import('express').NextFunction} _next @returns {void} */
export const errorHandler = (error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = status === 500 ? 'Internal server error' : error.message;
  if (status === 500) console.error(error);
  res.status(status).json({ success: false, message });
};
