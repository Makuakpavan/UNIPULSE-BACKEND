import { Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthenticatedRequest } from '../types';

interface AuditOptions {
  action: string;
  entityType: string;
  getEntityId?: (req: AuthenticatedRequest) => string | undefined;
  getDetails?: (req: AuthenticatedRequest) => any;
}

export const auditLog = (options: AuditOptions) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Store original json method to capture response
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only log on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const logEntry = new AuditLog({
          user: req.user._id,
          action: options.action,
          entityType: options.entityType,
          entityId: options.getEntityId ? options.getEntityId(req) : undefined,
          details: options.getDetails ? options.getDetails(req) : undefined,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        logEntry.save().catch(() => {
          // Fail silently - audit logging should not break the app
        });
      }

      return originalJson(body);
    };

    next();
  };
};
