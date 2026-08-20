import { Router } from 'express';
import { sendMessage, getConversations, getMessages, getUnreadCount } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendMessageValidator, paginationValidator, objectIdValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, sendMessageValidator, validate, sendMessage);
router.get('/conversations', authenticate, getConversations);
router.get('/unread', authenticate, getUnreadCount);
router.get('/:userId', authenticate, objectIdValidator('userId'), paginationValidator, validate, getMessages);

export default router;
