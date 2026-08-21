import { Request, Response } from 'express';
import User from '../models/User';
import Post from '../models/Post';
import Event from '../models/Event';
import MarketplaceItem from '../models/MarketplaceItem';
import AuditLog from '../models/AuditLog';
import Institution from '../models/Institution';
import { EmailService } from '../services/emailService';
import { formatResponse, buildPagination } from '../utils/helpers';
import { respondServerError } from '../middleware/errorHandler';
import { InstitutionStatus, UserRole } from '../types';

export const getDashboardStats = async (req: any, res: Response): Promise<void> => {
  try {
    const institutionFilter: any = {};
    if (req.user.role === UserRole.INSTITUTION_ADMIN) {
      institutionFilter.institution = req.user.institution;
    }

    // AuditLog has no `institution` field — it is scoped through the acting
    // user, the same way getAuditLogs does it.
    const auditFilter: any = {};
    if (req.user.role === UserRole.INSTITUTION_ADMIN) {
      const usersInInstitution = await User.find({ institution: req.user.institution }).select('_id');
      auditFilter.user = { $in: usersInInstitution.map((u) => u._id) };
    }

    // Institutions are not institution-scoped, so the pending count is only
    // meaningful — and only visible — to a super admin, who is the only role
    // that can act on it.
    const isSuperAdmin = req.user.role === UserRole.SUPER_ADMIN;

    const [totalUsers, totalPosts, totalEvents, totalItems, pendingVerifications, pendingAnonymousPosts, pendingInstitutions, recentAuditLogs] = await Promise.all([
      User.countDocuments({ ...institutionFilter, isActive: true }),
      Post.countDocuments({ ...institutionFilter }),
      Event.countDocuments({ ...institutionFilter }),
      MarketplaceItem.countDocuments({ ...institutionFilter }),
      User.countDocuments({ ...institutionFilter, isVerifiedStudent: false, verificationDocuments: { $exists: true, $ne: [] } }),
      Post.countDocuments({ ...institutionFilter, status: 'pending', isAnonymous: true }),
      isSuperAdmin ? Institution.countDocuments({ status: InstitutionStatus.PENDING }) : Promise.resolve(0),
      AuditLog.find(auditFilter).populate('user', 'firstName lastName username').sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    res.status(200).json(
      formatResponse(true, 'Dashboard stats retrieved', {
        stats: { totalUsers, totalPosts, totalEvents, totalItems, pendingVerifications, pendingAnonymousPosts, pendingInstitutions },
        recentActivity: recentAuditLogs,
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getPendingVerifications = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const query: any = { isVerifiedStudent: false, verificationDocuments: { $exists: true, $ne: [] } };
    if (req.user.role === UserRole.INSTITUTION_ADMIN) query.institution = req.user.institution;

    const [users, total] = await Promise.all([
      User.find(query).populate('institution', 'name slug').select('-password -refreshTokens -twoFactorSecret').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    res.status(200).json(
      formatResponse(true, 'Pending verifications retrieved', { users, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const verifyStudent = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json(formatResponse(false, 'User not found')); return; }

    if (req.user.role === UserRole.INSTITUTION_ADMIN && user.institution?.toString() !== req.user.institution?.toString()) {
      res.status(403).json(formatResponse(false, 'Cannot verify users from other institutions')); return;
    }

    if (status === 'approved') {
      user.isVerifiedStudent = true;
      user.role = UserRole.VERIFIED_STUDENT;
      await user.save();
      EmailService.sendVerificationApproved(user.email, user.firstName).catch(() => {});
      res.status(200).json(formatResponse(true, 'Student verified successfully'));
    } else {
      user.verificationDocuments = [];
      await user.save();
      res.status(200).json(formatResponse(true, 'Verification rejected'));
    }
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getAuditLogs = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const { skip } = buildPagination(page, limit);

    const query: any = {};
    if (req.user.role === UserRole.INSTITUTION_ADMIN) {
      const usersInInstitution = await User.find({ institution: req.user.institution }).select('_id');
      query.user = { $in: usersInInstitution.map((u) => u._id) };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).populate('user', 'firstName lastName username').sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json(
      formatResponse(true, 'Audit logs retrieved', { logs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const manageUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive, role } = req.body;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json(formatResponse(false, 'User not found')); return; }

    if (req.user.role === UserRole.INSTITUTION_ADMIN && user.institution?.toString() !== req.user.institution?.toString()) {
      res.status(403).json(formatResponse(false, 'Cannot manage users from other institutions')); return;
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (role && req.user.role === UserRole.SUPER_ADMIN) user.role = role;
    await user.save();

    res.status(200).json(formatResponse(true, 'User updated successfully'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

/**
 * The review queue for universities students proposed at registration. Each
 * entry carries the number of accounts already sitting in it, which is the
 * signal that tells a real submission apart from a typo — a legitimate
 * university accumulates registrations while it waits.
 */
export const getPendingInstitutions = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const query = { status: InstitutionStatus.PENDING };

    const [institutions, total] = await Promise.all([
      Institution.find(query)
        .populate('submittedBy', 'firstName lastName username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Institution.countDocuments(query),
    ]);

    const withCounts = await Promise.all(
      institutions.map(async (institution: any) => ({
        ...institution,
        registeredUsers: await User.countDocuments({ institution: institution._id }),
      }))
    );

    res.status(200).json(
      formatResponse(true, 'Pending institutions retrieved', {
        institutions: withCounts,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

/**
 * Approve or decline a student-submitted university. Approving publishes it to
 * the registration list; declining hides it. Neither touches the accounts that
 * already registered into it — deactivating real students because an admin
 * mistyped a decision is not a recoverable action, so it is left explicit.
 */
export const reviewInstitution = async (req: any, res: Response): Promise<void> => {
  try {
    const { institutionId } = req.params;
    const { status, rejectionReason } = req.body;

    const institution = await Institution.findById(institutionId);
    if (!institution) {
      res.status(404).json(formatResponse(false, 'Institution not found'));
      return;
    }

    if (institution.status !== InstitutionStatus.PENDING) {
      res.status(400).json(
        formatResponse(false, `This institution has already been ${institution.status}`)
      );
      return;
    }

    const approved = status === 'approved';
    institution.status = approved ? InstitutionStatus.APPROVED : InstitutionStatus.REJECTED;
    institution.isActive = approved;
    institution.rejectionReason = approved ? undefined : rejectionReason || undefined;
    institution.reviewedBy = req.user._id;
    institution.reviewedAt = new Date();
    await institution.save();

    const registeredUsers = await User.countDocuments({ institution: institution._id });

    res.status(200).json(
      formatResponse(true, `Institution ${institution.status}`, {
        institution,
        registeredUsers,
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const createInstitution = async (req: any, res: Response): Promise<void> => {
  try {
    if (req.user.role !== UserRole.SUPER_ADMIN) { res.status(403).json(formatResponse(false, 'Super admin only')); return; }
    const institution = await Institution.create(req.body);
    res.status(201).json(formatResponse(true, 'Institution created', { institution }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const updateInstitution = async (req: any, res: Response): Promise<void> => {
  try {
    const { institutionId } = req.params;
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.institution?.toString() !== institutionId) {
      res.status(403).json(formatResponse(false, 'Permission denied')); return;
    }
    const institution = await Institution.findByIdAndUpdate(institutionId, req.body, { new: true });
    res.status(200).json(formatResponse(true, 'Institution updated', { institution }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};
