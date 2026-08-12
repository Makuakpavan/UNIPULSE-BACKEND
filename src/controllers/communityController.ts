import { Request, Response } from 'express';
import Community from '../models/Community';
import Post from '../models/Post';
import { formatResponse, buildPagination } from '../utils/helpers';
import { cacheGet, cacheSet, cacheDeletePattern } from '../config/redis';
import { uploadToCloudinary } from '../config/cloudinary';
import { UserRole } from '../types';
import fs from 'fs';

export const createCommunity = async (req: any, res: Response): Promise<void> => {
  try {
    const communityData = {
      ...req.body,
      creator: req.user._id,
      institution: req.user.institution,
      members: [req.user._id],
      moderators: [req.user._id],
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.path, 'unipulse/communities');
      communityData.coverImage = uploadResult.url;
      fs.unlinkSync(req.file.path);
    }

    const community = await Community.create(communityData);
    await community.populate('creator', 'firstName lastName username avatar');

    await cacheDeletePattern(`communities:${req.user.institution}:*`);

    res.status(201).json(formatResponse(true, 'Community created', { community }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getCommunities = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const { skip } = buildPagination(page, limit);

    const cacheKey = `communities:${req.user.institution}:${page}:${limit}:${search || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(formatResponse(true, 'Communities retrieved', JSON.parse(cached)));
      return;
    }

    const query: any = {
      institution: req.user.institution,
      $or: [{ isPrivate: false }, { members: req.user._id }],
    };

    if (search) {
      query.$and = [
        query.$or ? { $or: query.$or } : {},
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $in: [new RegExp(search, 'i')] } },
          ],
        },
      ];
      delete query.$or;
    }

    const [communities, total] = await Promise.all([
      Community.find(query)
        .populate('creator', 'firstName lastName username avatar')
        .sort({ memberCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Community.countDocuments(query),
    ]);

    const result = {
      communities,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await cacheSet(cacheKey, JSON.stringify(result), 300);
    res.status(200).json(formatResponse(true, 'Communities retrieved', result));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

export const getCommunity = async (req: any, res: Response): Promise<void> => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId)
      .populate('creator', 'firstName lastName username avatar')
      .populate('members', 'firstName lastName username avatar')
      .populate('moderators', 'firstName lastName username avatar');

    if (!community) {
      res.status(404).json(formatResponse(false, 'Community not found'));
      return;
    }

    if (
      community.institution?.toString() !== req.user.institution?.toString() &&
      req.user.role !== UserRole.SUPER_ADMIN
    ) {
      res.status(403).json(formatResponse(false, 'Access denied'));
      return;
    }

    if (community.isPrivate && !community.members?.includes(req.user._id)) {
      res.status(403).json(formatResponse(false, 'This is a private community'));
      return;
    }

    res.status(200).json(formatResponse(true, 'Community retrieved', { community }));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

export const joinCommunity = async (req: any, res: Response): Promise<void> => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id.toString();

    const community = await Community.findById(communityId);
    if (!community) {
      res.status(404).json(formatResponse(false, 'Community not found'));
      return;
    }

    if (community.members?.includes(userId)) {
      res.status(400).json(formatResponse(false, 'Already a member'));
      return;
    }

    await Community.findByIdAndUpdate(communityId, {
      $addToSet: { members: userId },
      $inc: { memberCount: 1 },
    });

    res.status(200).json(formatResponse(true, 'Joined community'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const leaveCommunity = async (req: any, res: Response): Promise<void> => {
  try {
    const { communityId } = req.params;
    const userId = req.user._id.toString();

    const community = await Community.findById(communityId);
    if (!community) {
      res.status(404).json(formatResponse(false, 'Community not found'));
      return;
    }

    if (community.creator?.toString() === userId) {
      res.status(400).json(formatResponse(false, 'Creator cannot leave community'));
      return;
    }

    await Community.findByIdAndUpdate(communityId, {
      $pull: { members: userId, moderators: userId },
      $inc: { memberCount: -1 },
    });

    res.status(200).json(formatResponse(true, 'Left community'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getCommunityPosts = async (req: any, res: Response): Promise<void> => {
  try {
    const { communityId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const community = await Community.findById(communityId);
    if (!community) {
      res.status(404).json(formatResponse(false, 'Community not found'));
      return;
    }

    if (community.isPrivate && !community.members?.includes(req.user._id)) {
      res.status(403).json(formatResponse(false, 'Private community'));
      return;
    }

    const [posts, total] = await Promise.all([
      Post.find({
        institution: req.user.institution,
        status: 'approved',
        tags: { $in: [`community:${communityId}`] },
      })
        .populate('author', 'firstName lastName username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({
        institution: req.user.institution,
        status: 'approved',
        tags: { $in: [`community:${communityId}`] },
      }),
    ]);

    res.status(200).json(
      formatResponse(true, 'Community posts retrieved', {
        posts,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};
