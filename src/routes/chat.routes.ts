import { Router } from 'express';
import { sendMessage, getConversations, getMessages, getUnreadCount } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';
import { sendMessageValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, sendMessageValidator, sendMessage);
router.get('/conversations', authenticate, getConversations);
router.get('/unread', authenticate, getUnreadCount);
router.get('/:userId', authenticate, getMessages);

export default router;
