import { UserRole } from '../types';

/**
 * Tenancy rules shared by every institution-scoped resource.
 *
 * A super admin is global. An institution admin is NOT: their elevated role
 * applies only inside their own institution. Several controllers previously
 * checked `role === INSTITUTION_ADMIN` on its own, which let any institution
 * admin edit or delete another institution's content.
 */

export const isSuperAdmin = (user: any): boolean => user?.role === UserRole.SUPER_ADMIN;

export const isOwner = (ownerId: unknown, user: any): boolean =>
  !!ownerId && ownerId.toString() === user._id.toString();

/** True for a super admin, or an institution admin acting inside their own tenant. */
export const isAdminOfInstitution = (institutionId: unknown, user: any): boolean => {
  if (isSuperAdmin(user)) return true;
  if (user?.role !== UserRole.INSTITUTION_ADMIN) return false;
  return !!institutionId && institutionId.toString() === user.institution?.toString();
};

/** Read access to an institution-scoped resource. */
export const canAccessInstitution = (institutionId: unknown, user: any): boolean =>
  isSuperAdmin(user) ||
  (!!institutionId && institutionId.toString() === user.institution?.toString());

/** Write/delete access: the owner, or an admin of the resource's own institution. */
export const canManage = (
  resource: { owner: unknown; institution: unknown },
  user: any
): boolean => isOwner(resource.owner, user) || isAdminOfInstitution(resource.institution, user);
