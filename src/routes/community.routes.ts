import { Router } from 'express';
import {
  createCommunity, getCommunities, getCommunity, joinCommunity,
  leaveCommunity, getCommunityPosts,
} from '../controllers/communityController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { createCommunityValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, uploadSingle, createCommunityValidator, createCommunity);
router.get('/', authenticate, getCommunities);
router.get('/:communityId', authenticate, getCommunity);
router.post('/:communityId/join', authenticate, joinCommunity);
router.post('/:communityId/leave', authenticate, leaveCommunity);
router.get('/:communityId/posts', authenticate, getCommunityPosts);

export default router;
