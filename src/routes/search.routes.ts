import { Router } from 'express';
import { globalSearch } from '../controllers/searchController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { searchValidator, paginationValidator } from '../utils/validators';

const router = Router();

router.get('/', authenticate, searchValidator, paginationValidator, validate, globalSearch);

export default router;
