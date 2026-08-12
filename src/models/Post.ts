import mongoose, { Schema } from 'mongoose';
import { IPost, PostStatus, PostVisibility } from '../types';

const CommentSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PostSchema = new Schema<IPost>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    images: [{
      type: String,
    }],
    visibility: {
      type: String,
      enum: Object.values(PostVisibility),
      default: PostVisibility.PUBLIC,
    },
    status: {
      type: String,
      enum: Object.values(PostStatus),
      default: PostStatus.APPROVED,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [CommentSchema],
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for feed queries
PostSchema.index({ institution: 1, status: 1, createdAt: -1 });
PostSchema.index({ institution: 1, isAnonymous: 1, status: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ author: 1, createdAt: -1 });

export default mongoose.model<IPost>('Post', PostSchema);
