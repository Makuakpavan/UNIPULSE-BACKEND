import mongoose, { Schema } from 'mongoose';
import { IMarketplaceItem, MarketplaceStatus } from '../types';

const MarketplaceItemSchema = new Schema<IMarketplaceItem>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    images: [{
      type: String,
    }],
    category: {
      type: String,
      required: true,
      trim: true,
    },
    condition: {
      type: String,
      required: true,
      enum: ['new', 'like_new', 'good', 'fair', 'poor'],
    },
    institution: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(MarketplaceStatus),
      default: MarketplaceStatus.ACTIVE,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

MarketplaceItemSchema.index({ institution: 1, status: 1, createdAt: -1 });
MarketplaceItemSchema.index({ category: 1 });
MarketplaceItemSchema.index({ price: 1 });

export default mongoose.model<IMarketplaceItem>('MarketplaceItem', MarketplaceItemSchema);
