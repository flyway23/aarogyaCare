import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  emptyBodySchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './schema.js';
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
} from './controller.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 100 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Try again later.',
  },
});
const allRoles = ['patient', 'doctor', 'operator', 'admin'];

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(emptyBodySchema), refresh);
router.post('/logout', validate(emptyBodySchema), logout);
router.get('/me', auth, requireRole(...allRoles), me);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);

export default router;
