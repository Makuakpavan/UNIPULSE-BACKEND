import { Router } from 'express';
import {
  getUserProfile, updateProfile, followUser, getFollowers,
  getFollowing, getInstitutions, requestVerification, requestInstitution,
} from '../controllers/userController';
import { authenticate, optionalAuth } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { institutionRequestLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  paginationValidator, objectIdValidator, requestVerificationValidator,
  requestInstitutionValidator,
} from '../utils/validators';

const router = Router();

router.get('/institutions', paginationValidator, validate, getInstitutions);
// Public: reached from the registration form before the student has an account.
// `optionalAuth` only records the submitter when one happens to be signed in.
router.post(
  '/institutions',
  institutionRequestLimiter,
  optionalAuth,
  requestInstitutionValidator,
  validate,
  requestInstitution
);
router.get('/profile/:userId', authenticate, objectIdValidator('userId'), validate, getUserProfile);
router.patch('/profile', authenticate, uploadSingle, updateProfile);
router.post('/follow/:userId', authenticate, objectIdValidator('userId'), validate, followUser);
router.get('/followers/:userId', authenticate, objectIdValidator('userId'), paginationValidator, validate, getFollowers);
router.get('/following/:userId', authenticate, objectIdValidator('userId'), paginationValidator, validate, getFollowing);
router.post('/verify', authenticate, requestVerificationValidator, validate, requestVerification);

export default router;
