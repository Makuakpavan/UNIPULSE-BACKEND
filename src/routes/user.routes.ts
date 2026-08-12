import { Router } from 'express';
import {
  getUserProfile, updateProfile, followUser, getFollowers,
  getFollowing, getInstitutions, requestVerification,
} from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';

const router = Router();

router.get('/institutions', getInstitutions);
router.get('/profile/:userId', authenticate, getUserProfile);
router.patch('/profile', authenticate, uploadSingle, updateProfile);
router.post('/follow/:userId', authenticate, followUser);
router.get('/followers/:userId', authenticate, getFollowers);
router.get('/following/:userId', authenticate, getFollowing);
router.post('/verify', authenticate, requestVerification);

export default router;
