import { Router } from 'express';
import {
  createItem, getItems, getItem, updateItem, deleteItem, markAsSold,
} from '../controllers/marketplaceController';
import { authenticate } from '../middleware/auth';
import { uploadMultiple } from '../middleware/upload';
import { createMarketplaceItemValidator } from '../utils/validators';

const router = Router();

router.post('/', authenticate, uploadMultiple, createMarketplaceItemValidator, createItem);
router.get('/', authenticate, getItems);
router.get('/:itemId', authenticate, getItem);
router.patch('/:itemId', authenticate, uploadMultiple, updateItem);
router.delete('/:itemId', authenticate, deleteItem);
router.post('/:itemId/sold', authenticate, markAsSold);

export default router;
