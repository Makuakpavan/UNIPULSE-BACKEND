import { Router } from 'express';
import {
  createCommunity, getCommunities, getCommunity, joinCommunity,
  leaveCommunity, getCommunityPosts,
} from '../controllers/communityController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { createCommunityValidator, paginationValidator, objectIdValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, uploadSingle, createCommunityValidator, validate, createCommunity);
router.get('/', authenticate, paginationValidator, validate, getCommunities);
router.get('/:communityId', authenticate, objectIdValidator('communityId'), validate, getCommunity);
router.post('/:communityId/join', authenticate, objectIdValidator('communityId'), validate, joinCommunity);
router.post('/:communityId/leave', authenticate, objectIdValidator('communityId'), validate, leaveCommunity);
router.get('/:communityId/posts', authenticate, objectIdValidator('communityId'), paginationValidator, validate, getCommunityPosts);

export default router;
