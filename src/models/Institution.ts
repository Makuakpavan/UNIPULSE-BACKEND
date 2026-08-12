import mongoose, { Schema } from 'mongoose';
import { IInstitution } from '../types';

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

export default mongoose.model<IInstitution>('Institution', InstitutionSchema);
