import { HttpError } from '../lib/httpError.js';

/** @param {import('zod').ZodType} schema @param {'body'|'query'|'params'} [target] @returns {import('express').RequestHandler} */
export const validate =
  (schema, target = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(
        new HttpError(
          400,
          result.error.issues.map((issue) => issue.message).join(', '),
        ),
      );
    }
    req[target] = result.data;
    return next();
  };
