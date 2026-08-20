import { Router } from 'express';
import {
  getUserProfile, updateProfile, followUser, getFollowers,
  getFollowing, getInstitutions, requestVerification,
} from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { paginationValidator, objectIdValidator, requestVerificationValidator } from '../utils/validators';

const router = Router();

router.get('/institutions', paginationValidator, validate, getInstitutions);
router.get('/profile/:userId', authenticate, objectIdValidator('userId'), validate, getUserProfile);
router.patch('/profile', authenticate, uploadSingle, updateProfile);
router.post('/follow/:userId', authenticate, objectIdValidator('userId'), validate, followUser);
router.get('/followers/:userId', authenticate, objectIdValidator('userId'), paginationValidator, validate, getFollowers);
router.get('/following/:userId', authenticate, objectIdValidator('userId'), paginationValidator, validate, getFollowing);
router.post('/verify', authenticate, requestVerificationValidator, validate, requestVerification);

export default router;
