import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { profileSchema } from './schema.js';
import { getMyProfile, putMyProfile } from './controller.js';

const router = Router();
router.use(auth, requireRole('patient'));
router.get('/me/profile', getMyProfile);
router.put('/me/profile', validate(profileSchema), putMyProfile);

export default router;
