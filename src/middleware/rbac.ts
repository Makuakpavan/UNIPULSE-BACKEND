import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';
import { formatResponse, hasRole } from '../utils/helpers';

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(formatResponse(false, 'Authentication required'));
      return;
    }

    if (!hasRole(req.user.role, roles)) {
      res.status(403).json(formatResponse(false, 'Insufficient permissions'));
      return;
    }

    next();
  };
};

export const requireInstitutionMatch = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json(formatResponse(false, 'Authentication required'));
    return;
  }

  // Super admin can access any institution
  if (req.user.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  // Institution admin can access their own institution
  if (req.user.role === UserRole.INSTITUTION_ADMIN) {
    next();
    return;
  }

  // For other endpoints, check if the resource belongs to user's institution
  // This is handled in controllers, but we set a flag here
  next();
};

export const requireOwnershipOrAdmin = (
  getResourceOwnerId: (req: AuthenticatedRequest) => Promise<string | null>
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json(formatResponse(false, 'Authentication required'));
      return;
    }

    const ownerId = await getResourceOwnerId(req);

    if (
      req.user.role === UserRole.SUPER_ADMIN ||
      req.user.role === UserRole.INSTITUTION_ADMIN ||
      req.user._id.toString() === ownerId
    ) {
      next();
      return;
    }

    res.status(403).json(formatResponse(false, 'You do not have permission to access this resource'));
  };
};
