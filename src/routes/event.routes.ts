import { Router } from 'express';
import {
  createEvent, getEvents, getEvent, attendEvent, updateEvent, deleteEvent,
} from '../controllers/eventController';
import { authenticate } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { createEventValidator, paginationValidator, objectIdValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, uploadSingle, createEventValidator, validate, createEvent);
router.get('/', authenticate, paginationValidator, validate, getEvents);
router.get('/:eventId', authenticate, objectIdValidator('eventId'), validate, getEvent);
router.post('/:eventId/attend', authenticate, objectIdValidator('eventId'), validate, attendEvent);
router.patch('/:eventId', authenticate, uploadSingle, objectIdValidator('eventId'), validate, updateEvent);
router.delete('/:eventId', authenticate, objectIdValidator('eventId'), validate, deleteEvent);

export default router;
