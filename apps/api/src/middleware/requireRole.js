import { HttpError } from '../lib/httpError.js';

/** @param {...string} roles @returns {import('express').RequestHandler} */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new HttpError(
          403,
          'You do not have permission to access this resource',
        ),
      );
    }
    return next();
  };
