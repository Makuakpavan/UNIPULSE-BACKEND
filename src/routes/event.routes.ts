import { Router } from 'express';
import {
  createEvent, getEvents, getEvent, attendEvent, updateEvent, deleteEvent,
} from '../controllers/eventController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { createEventValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, uploadSingle, createEventValidator, createEvent);
router.get('/', authenticate, getEvents);
router.get('/:eventId', authenticate, getEvent);
router.post('/:eventId/attend', authenticate, attendEvent);
router.patch('/:eventId', authenticate, uploadSingle, updateEvent);
router.delete('/:eventId', authenticate, deleteEvent);

export default router;
