import { body, param, query } from 'express-validator';

export const registerValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric and underscores only'),
  body('institution').isMongoId().withMessage('Valid institution ID is required'),
  body('department').optional().trim(),
  body('level').optional().trim(),
  body('matricNumber').optional().trim(),
];

export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const createPostValidator = [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
  body('visibility').optional().isIn(['public', 'anonymous']).withMessage('Visibility must be public or anonymous'),
  body('tags').optional().isArray({ max: 5 }).withMessage('Maximum 5 tags allowed'),
];

export const createEventValidator = [
  body('title').trim().notEmpty().withMessage('Event title is required'),
  body('description').trim().notEmpty().withMessage('Event description is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('location').optional().trim(),
  body('isOnline').optional().isBoolean(),
  body('category').optional().trim(),
];

export const createMarketplaceItemValidator = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().trim().isLength({ min: 1, max: 3 }),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('condition').trim().notEmpty().withMessage('Condition is required'),
];

export const createCommunityValidator = [
  body('name').trim().notEmpty().withMessage('Community name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('isPrivate').optional().isBoolean(),
  body('tags').optional().isArray({ max: 10 }),
];

export const sendMessageValidator = [
  body('receiverId').isMongoId().withMessage('Valid receiver ID is required'),
  body('content').trim().notEmpty().withMessage('Message content is required'),
  body('isAnonymous').optional().isBoolean(),
];

export const paginationValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
];

export const objectIdValidator = (field: string) => [
  param(field).isMongoId().withMessage(`Valid ${field} is required`),
];
