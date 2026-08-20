import { Router } from 'express';
import {
  createItem, getItems, getItem, updateItem, deleteItem, markAsSold,
} from '../controllers/marketplaceController';
import { authenticate } from '../middleware/auth';
import { uploadMultiple } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { createMarketplaceItemValidator, paginationValidator, objectIdValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, uploadMultiple, createMarketplaceItemValidator, validate, createItem);
router.get('/', authenticate, paginationValidator, validate, getItems);
router.get('/:itemId', authenticate, objectIdValidator('itemId'), validate, getItem);
router.patch('/:itemId', authenticate, uploadMultiple, objectIdValidator('itemId'), validate, updateItem);
router.delete('/:itemId', authenticate, objectIdValidator('itemId'), validate, deleteItem);
router.post('/:itemId/sold', authenticate, objectIdValidator('itemId'), validate, markAsSold);

export default router;
