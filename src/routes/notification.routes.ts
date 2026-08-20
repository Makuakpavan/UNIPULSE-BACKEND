import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paginationValidator, objectIdValidator } from '../utils/validators';

const router = Router();

router.get('/', authenticate, paginationValidator, validate, getNotifications);
router.patch('/read-all', authenticate, markAllAsRead);
router.patch('/:notificationId/read', authenticate, objectIdValidator('notificationId'), validate, markAsRead);
router.delete('/:notificationId', authenticate, objectIdValidator('notificationId'), validate, deleteNotification);

export default router;
