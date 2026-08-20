import { Router } from 'express';
import {
  getDashboardStats, getPendingVerifications, verifyStudent,
  getAuditLogs, manageUser, createInstitution, updateInstitution,
} from '../controllers/adminController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { auditLog } from '../middleware/auditLog';
import { validate } from '../middleware/validate';
import {
  verifyStudentValidator, manageUserValidator, createInstitutionValidator,
  institutionValidator, paginationValidator, objectIdValidator,
} from '../utils/validators';
import { UserRole } from '../types';

const router = Router();

const adminOnly = [authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN)];
const superAdminOnly = [authenticate, authorize(UserRole.SUPER_ADMIN)];

router.get('/dashboard', adminOnly, getDashboardStats);
router.get('/verifications', adminOnly, paginationValidator, validate, getPendingVerifications);
router.get('/audit-logs', adminOnly, paginationValidator, validate, getAuditLogs);

router.post(
  '/verify/:userId',
  adminOnly,
  objectIdValidator('userId'),
  verifyStudentValidator,
  validate,
  auditLog({
    action: 'verify_student',
    entityType: 'User',
    getEntityId: (req) => req.params.userId,
    getDetails: (req) => ({ status: req.body.status }),
  }),
  verifyStudent
);

router.patch(
  '/users/:userId',
  adminOnly,
  objectIdValidator('userId'),
  manageUserValidator,
  validate,
  auditLog({
    action: 'manage_user',
    entityType: 'User',
    getEntityId: (req) => req.params.userId,
    getDetails: (req) => ({ isActive: req.body.isActive, role: req.body.role }),
  }),
  manageUser
);

router.post(
  '/institutions',
  superAdminOnly,
  createInstitutionValidator,
  validate,
  auditLog({
    action: 'create_institution',
    entityType: 'Institution',
    getDetails: (req) => ({ name: req.body.name, slug: req.body.slug }),
  }),
  createInstitution
);

router.patch(
  '/institutions/:institutionId',
  superAdminOnly,
  objectIdValidator('institutionId'),
  institutionValidator,
  validate,
  auditLog({
    action: 'update_institution',
    entityType: 'Institution',
    getEntityId: (req) => req.params.institutionId,
  }),
  updateInstitution
);

export default router;
