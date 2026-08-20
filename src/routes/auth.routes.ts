import { Router } from 'express';
import {
  register, login, verify2FA, setup2FA, enable2FA, disable2FA,
  refreshToken, logout, logoutAll, getMe,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  registerValidator, loginValidator, verify2FAValidator,
  twoFactorCodeValidator, refreshTokenValidator,
} from '../utils/validators';

const router = Router();

router.post('/register', authRateLimiter, registerValidator, validate, register);
router.post('/login', authRateLimiter, loginValidator, validate, login);
// Unauthenticated and grants a full session on success: throttle like login.
router.post('/2fa/verify', authRateLimiter, verify2FAValidator, validate, verify2FA);
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/enable', authenticate, twoFactorCodeValidator, validate, enable2FA);
router.post('/2fa/disable', authenticate, disable2FA);
router.post('/refresh', authRateLimiter, refreshTokenValidator, validate, refreshToken);
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/me', authenticate, getMe);

export default router;
