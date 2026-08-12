import { Router } from 'express';
import {
  createPost, getFeed, getPost, likePost, commentOnPost,
  deletePost, getPendingAnonymousPosts, moderatePost,
} from '../controllers/postController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { postRateLimiter } from '../middleware/rateLimiter';
import { uploadMultiple } from '../middleware/upload';
import { createPostValidator } from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.post('/', authenticate, postRateLimiter, uploadMultiple, createPostValidator, createPost);
router.get('/feed', authenticate, getFeed);
router.get('/pending', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), getPendingAnonymousPosts);
router.get('/:postId', authenticate, getPost);
router.post('/:postId/like', authenticate, likePost);
router.post('/:postId/comment', authenticate, commentOnPost);
router.patch('/:postId/moderate', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), moderatePost);
router.delete('/:postId', authenticate, deletePost);

export default router;
