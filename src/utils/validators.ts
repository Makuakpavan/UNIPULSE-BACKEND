import { body, param, query } from 'express-validator';
import { UserRole } from '../types';

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

export const verify2FAValidator = [
  body('challengeToken').isString().notEmpty().withMessage('Challenge token is required'),
  body('token').isString().isLength({ min: 6, max: 6 }).isNumeric().withMessage('A 6-digit code is required'),
];

export const twoFactorCodeValidator = [
  body('token').isString().isLength({ min: 6, max: 6 }).isNumeric().withMessage('A 6-digit code is required'),
];

export const refreshTokenValidator = [
  body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
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
  body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Community name is required'),
  body('description').trim().notEmpty().isLength({ max: 1000 }).withMessage('Description is required'),
  body('isPrivate').optional().isBoolean(),
  body('tags').optional().isArray({ max: 10 }),
];

export const commentValidator = [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Comment must be 1-1000 characters'),
  body('isAnonymous').optional().isBoolean(),
];

export const moderatePostValidator = [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
];

export const searchValidator = [
  query('q').trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be 1-100 characters'),
  query('type').optional().isIn(['all', 'users', 'posts', 'events', 'communities', 'marketplace']),
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

export const verifyStudentValidator = [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
];

export const manageUserValidator = [
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('role').optional().isIn(Object.values(UserRole)).withMessage('Invalid role'),
];

export const institutionValidator = [
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('slug').optional().trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with dashes'),
  body('location').optional().trim(),
  body('website').optional().trim().isURL().withMessage('Website must be a valid URL'),
  body('emailDomain').optional().trim(),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('isActive').optional().isBoolean(),
];

export const createInstitutionValidator = [
  body('name').trim().notEmpty().withMessage('Institution name is required'),
  body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with dashes'),
  ...institutionValidator.slice(2),
];

/**
 * A student proposing a university supplies the name and optional details only.
 * `slug`, `status` and `isActive` are server-owned.
 */
export const requestInstitutionValidator = [
  body('name').trim().isLength({ min: 3, max: 200 }).withMessage('University name must be 3-200 characters'),
  body('location').optional().trim().isLength({ max: 200 }),
  body('website').optional({ values: 'falsy' }).trim().isURL().withMessage('Website must be a valid URL'),
  body('emailDomain')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[a-z0-9.-]+\.[a-z]{2,}$/i)
    .withMessage('Email domain must look like unilag.edu.ng'),
  body('description').optional().trim().isLength({ max: 2000 }),
];

export const reviewInstitutionValidator = [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('rejectionReason').optional().trim().isLength({ max: 500 }),
];

export const requestVerificationValidator = [
  body('documents').isArray({ min: 1, max: 5 }).withMessage('Between 1 and 5 documents are required'),
  body('documents.*').isString().trim().notEmpty().withMessage('Each document must be a non-empty string'),
];
