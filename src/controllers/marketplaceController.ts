import { Request, Response } from 'express';
import MarketplaceItem from '../models/MarketplaceItem';
import { formatResponse, buildPagination } from '../utils/helpers';
import { respondServerError } from '../middleware/errorHandler';
import { cacheGet, cacheSet, cacheDeletePattern } from '../config/redis';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { MarketplaceStatus, UserRole } from '../types';
import fs from 'fs';

export const createItem = async (req: any, res: Response): Promise<void> => {
  try {
    const itemData = {
      ...req.body,
      seller: req.user._id,
      institution: req.user.institution,
    };

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file: any) =>
        uploadToCloudinary(file.path, 'unipulse/marketplace')
      );
      const uploads = await Promise.all(uploadPromises);
      itemData.images = uploads.map((u) => u.url);

      req.files.forEach((file: any) => {
        try { fs.unlinkSync(file.path); } catch {}
      });
    }

    const item = await MarketplaceItem.create(itemData);
    await item.populate('seller', 'firstName lastName username avatar');

    await cacheDeletePattern(`marketplace:${req.user.institution}:*`);

    res.status(201).json(formatResponse(true, 'Item listed successfully', { item }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getItems = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const condition = req.query.condition as string;
    const search = req.query.search as string;
    const { skip } = buildPagination(page, limit);

    const cacheKey = `marketplace:${req.user.institution}:${page}:${limit}:${category || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(formatResponse(true, 'Items retrieved', JSON.parse(cached)));
      return;
    }

    const query: any = {
      institution: req.user.institution,
      status: MarketplaceStatus.ACTIVE,
    };

    if (category) query.category = category;
    if (condition) query.condition = condition;
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      MarketplaceItem.find(query)
        .populate('seller', 'firstName lastName username avatar')
        .sort({ isPremium: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketplaceItem.countDocuments(query),
    ]);

    const result = {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await cacheSet(cacheKey, JSON.stringify(result), 300);
    res.status(200).json(formatResponse(true, 'Items retrieved', result));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getItem = async (req: any, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;

    const item = await MarketplaceItem.findById(itemId)
      .populate('seller', 'firstName lastName username avatar');

    if (!item) {
      res.status(404).json(formatResponse(false, 'Item not found'));
      return;
    }

    if (
      item.institution?.toString() !== req.user.institution?.toString() &&
      req.user.role !== UserRole.SUPER_ADMIN
    ) {
      res.status(403).json(formatResponse(false, 'Access denied'));
      return;
    }

    // Increment views
    await MarketplaceItem.findByIdAndUpdate(itemId, { $inc: { views: 1 } });

    res.status(200).json(formatResponse(true, 'Item retrieved', { item }));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const updateItem = async (req: any, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await MarketplaceItem.findById(itemId);

    if (!item) {
      res.status(404).json(formatResponse(false, 'Item not found'));
      return;
    }

    if (item.seller?.toString() !== req.user._id.toString()) {
      res.status(403).json(formatResponse(false, 'Permission denied'));
      return;
    }

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file: any) =>
        uploadToCloudinary(file.path, 'unipulse/marketplace')
      );
      const uploads = await Promise.all(uploadPromises);
      req.body.images = [...(item.images || []), ...uploads.map((u) => u.url)];

      req.files.forEach((file: any) => {
        try { fs.unlinkSync(file.path); } catch {}
      });
    }

    const updated = await MarketplaceItem.findByIdAndUpdate(itemId, req.body, { new: true })
      .populate('seller', 'firstName lastName username avatar');

    await cacheDeletePattern(`marketplace:${item.institution}:*`);

    res.status(200).json(formatResponse(true, 'Item updated', { item: updated }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const deleteItem = async (req: any, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await MarketplaceItem.findById(itemId);

    if (!item) {
      res.status(404).json(formatResponse(false, 'Item not found'));
      return;
    }

    if (
      item.seller?.toString() !== req.user._id.toString() &&
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.role !== UserRole.INSTITUTION_ADMIN
    ) {
      res.status(403).json(formatResponse(false, 'Permission denied'));
      return;
    }

    // Delete images
    if (item.images && item.images.length > 0) {
      for (const imageUrl of item.images) {
        try {
          const publicId = imageUrl.split('/').pop()?.split('.')[0];
          if (publicId) await deleteFromCloudinary(`unipulse/marketplace/${publicId}`);
        } catch {}
      }
    }

    await MarketplaceItem.findByIdAndDelete(itemId);
    await cacheDeletePattern(`marketplace:${item.institution}:*`);

    res.status(200).json(formatResponse(true, 'Item deleted'));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const markAsSold = async (req: any, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const item = await MarketplaceItem.findById(itemId);

    if (!item) {
      res.status(404).json(formatResponse(false, 'Item not found'));
      return;
    }

    if (item.seller?.toString() !== req.user._id.toString()) {
      res.status(403).json(formatResponse(false, 'Permission denied'));
      return;
    }

    item.status = MarketplaceStatus.SOLD;
    await item.save();

    res.status(200).json(formatResponse(true, 'Item marked as sold'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};
