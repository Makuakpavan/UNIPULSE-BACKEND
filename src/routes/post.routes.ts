import { Router } from 'express';
import {
  createPost, getFeed, getPost, likePost, commentOnPost,
  deletePost, getPendingAnonymousPosts, moderatePost,
} from '../controllers/postController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { postRateLimiter } from '../middleware/rateLimiter';
import { uploadMultiple } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  createPostValidator, commentValidator, moderatePostValidator,
  paginationValidator, objectIdValidator,
} from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

router.post('/', authenticate, postRateLimiter, uploadMultiple, createPostValidator, validate, createPost);
router.get('/feed', authenticate, paginationValidator, validate, getFeed);
router.get('/pending', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), paginationValidator, validate, getPendingAnonymousPosts);
router.get('/:postId', authenticate, objectIdValidator('postId'), validate, getPost);
router.post('/:postId/like', authenticate, objectIdValidator('postId'), validate, likePost);
router.post('/:postId/comment', authenticate, objectIdValidator('postId'), commentValidator, validate, commentOnPost);
router.patch('/:postId/moderate', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), objectIdValidator('postId'), moderatePostValidator, validate, moderatePost);
router.delete('/:postId', authenticate, objectIdValidator('postId'), validate, deletePost);

export default router;
