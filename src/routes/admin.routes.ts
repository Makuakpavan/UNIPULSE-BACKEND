import { Router } from 'express';
import {
  getDashboardStats, getPendingVerifications, verifyStudent,
  getAuditLogs, manageUser, createInstitution, updateInstitution,
} from '../controllers/adminController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

router.get('/dashboard', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), getDashboardStats);
router.get('/verifications', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), getPendingVerifications);
router.post('/verify/:userId', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), verifyStudent);
router.get('/audit-logs', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), getAuditLogs);
router.patch('/users/:userId', authenticate, authorize(UserRole.INSTITUTION_ADMIN, UserRole.SUPER_ADMIN), manageUser);
router.post('/institutions', authenticate, authorize(UserRole.SUPER_ADMIN), createInstitution);
router.patch('/institutions/:institutionId', authenticate, authorize(UserRole.SUPER_ADMIN), updateInstitution);

export default router;
