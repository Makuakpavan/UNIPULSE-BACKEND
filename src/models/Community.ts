import mongoose, { Schema } from 'mongoose';
import { ICommunity } from '../types';

const CommunitySchema = new Schema<ICommunity>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    coverImage: {
      type: String,
      default: null,
    },
    icon: {
      type: String,
      default: null,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    moderators: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    memberCount: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

CommunitySchema.index({ institution: 1, isPrivate: 1 });
CommunitySchema.index({ tags: 1 });

export default mongoose.model<ICommunity>('Community', CommunitySchema);
