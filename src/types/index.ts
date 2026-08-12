import { Request } from 'express';
import { Document, Types } from 'mongoose';

export enum UserRole {
  STUDENT = 'student',
  VERIFIED_STUDENT = 'verified_student',
  INSTITUTION_ADMIN = 'institution_admin',
  SUPER_ADMIN = 'super_admin',
}

export enum PostStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum PostVisibility {
  PUBLIC = 'public',
  ANONYMOUS = 'anonymous',
}

export enum ProfileVisibility {
  PUBLIC = 'public',
  INSTITUTION_ONLY = 'institution_only',
  PRIVATE = 'private',
}

export enum MarketplaceStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  RESERVED = 'reserved',
  EXPIRED = 'expired',
}

export enum NotificationType {
  POST_LIKE = 'post_like',
  POST_COMMENT = 'post_comment',
  FOLLOW = 'follow',
  EVENT_REMINDER = 'event_reminder',
  MESSAGE = 'message',
  ANONYMOUS_POST_APPROVED = 'anonymous_post_approved',
  ANONYMOUS_POST_REJECTED = 'anonymous_post_rejected',
  VERIFICATION_APPROVED = 'verification_approved',
  SYSTEM = 'system',
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  role: UserRole;
  institution: Types.ObjectId;
  department?: string;
  level?: string;
  matricNumber?: string;
  profileVisibility: ProfileVisibility;
  isEmailVerified: boolean;
  isVerifiedStudent: boolean;
  verificationDocuments?: string[];
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  refreshTokens: { token: string; expiresAt: Date }[];
  followers: Types.ObjectId[];
  following: Types.ObjectId[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string;
}

export interface IInstitution extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  location?: string;
  website?: string;
  emailDomain?: string;
  isActive: boolean;
  adminCount: number;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPost extends Document {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  institution: Types.ObjectId;
  content: string;
  images?: string[];
  visibility: PostVisibility;
  status: PostStatus;
  isAnonymous: boolean;
  likes: Types.ObjectId[];
  comments: IComment[];
  tags?: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComment {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  institution: Types.ObjectId;
  organizer: Types.ObjectId;
  coverImage?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  isOnline: boolean;
  meetingLink?: string;
  category?: string;
  attendees: Types.ObjectId[];
  maxAttendees?: number;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMarketplaceItem extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  condition: string;
  institution: Types.ObjectId;
  seller: Types.ObjectId;
  status: MarketplaceStatus;
  isPremium: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommunity extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  institution: Types.ObjectId;
  coverImage?: string;
  icon?: string;
  creator: Types.ObjectId;
  members: Types.ObjectId[];
  moderators: Types.ObjectId[];
  isPrivate: boolean;
  tags?: string[];
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  content: string;
  isAnonymous: boolean;
  isRead: boolean;
  createdAt: Date;
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  token?: string;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  institutionId?: string;
}
