import mongoose, { Schema } from 'mongoose';
import { IInstitution, InstitutionStatus } from '../types';

const InstitutionSchema = new Schema<IInstitution>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    logo: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },
    website: {
      type: String,
      default: null,
    },
    emailDomain: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /**
     * Defaults to APPROVED so seeded and admin-created institutions need no
     * extra handling; the student-submission route sets PENDING explicitly.
     * Documents written before this field existed have no `status` at all,
     * which is why the public query excludes pending/rejected rather than
     * requiring an equality match on 'approved'.
     */
    status: {
      type: String,
      enum: Object.values(InstitutionStatus),
      default: InstitutionStatus.APPROVED,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    adminCount: {
      type: Number,
      default: 0,
    },
    studentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

InstitutionSchema.index({ isActive: 1 });
InstitutionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IInstitution>('Institution', InstitutionSchema);
