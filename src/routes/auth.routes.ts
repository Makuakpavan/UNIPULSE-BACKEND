import { Router } from 'express';
import {
  register, login, verify2FA, setup2FA, enable2FA, disable2FA,
  refreshToken, logout, logoutAll, getMe,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { registerValidator, loginValidator } from '../utils/validators';

const router = Router();

router.post('/register', registerValidator, register);
router.post('/login', authRateLimiter, loginValidator, login);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/enable', authenticate, enable2FA);
router.post('/2fa/disable', authenticate, disable2FA);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/me', authenticate, getMe);

export default router;
