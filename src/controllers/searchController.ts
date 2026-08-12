import { Request, Response } from 'express';
import User from '../models/User';
import Post from '../models/Post';
import Event from '../models/Event';
import Community from '../models/Community';
import MarketplaceItem from '../models/MarketplaceItem';
import { formatResponse, buildPagination } from '../utils/helpers';
import { PostStatus } from '../types';

export const globalSearch = async (req: any, res: Response): Promise<void> => {
  try {
    const { q, type } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    if (!q || typeof q !== 'string') { res.status(400).json(formatResponse(false, 'Search query is required')); return; }

    const searchRegex = new RegExp(q, 'i');
    const institution = req.user.institution;
    let results: any = {};
    const searchType = type || 'all';

    if (searchType === 'all' || searchType === 'users') {
      const [users, userTotal] = await Promise.all([
        User.find({ institution, isActive: true, $or: [{ firstName: searchRegex }, { lastName: searchRegex }, { username: searchRegex }, { department: searchRegex }] }).select('firstName lastName username avatar department level').skip(skip).limit(limit).lean(),
        User.countDocuments({ institution, isActive: true, $or: [{ firstName: searchRegex }, { lastName: searchRegex }, { username: searchRegex }] }),
      ]);
      results.users = { data: users, total: userTotal };
    }

    if (searchType === 'all' || searchType === 'posts') {
      const [posts, postTotal] = await Promise.all([
        Post.find({ institution, status: PostStatus.APPROVED, $or: [{ content: searchRegex }, { tags: { $in: [searchRegex] } }] }).populate('author', 'firstName lastName username avatar').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Post.countDocuments({ institution, status: PostStatus.APPROVED, $or: [{ content: searchRegex }, { tags: { $in: [searchRegex] } }] }),
      ]);
      results.posts = { data: posts, total: postTotal };
    }

    if (searchType === 'all' || searchType === 'events') {
      const [events, eventTotal] = await Promise.all([
        Event.find({ institution, isApproved: true, $or: [{ title: searchRegex }, { description: searchRegex }, { category: searchRegex }] }).populate('organizer', 'firstName lastName username avatar').sort({ startDate: 1 }).skip(skip).limit(limit).lean(),
        Event.countDocuments({ institution, isApproved: true, $or: [{ title: searchRegex }, { description: searchRegex }] }),
      ]);
      results.events = { data: events, total: eventTotal };
    }

    if (searchType === 'all' || searchType === 'communities') {
      const [communities, communityTotal] = await Promise.all([
        Community.find({ institution, $or: [{ name: searchRegex }, { description: searchRegex }, { tags: { $in: [searchRegex] } }] }).populate('creator', 'firstName lastName username avatar').skip(skip).limit(limit).lean(),
        Community.countDocuments({ institution, $or: [{ name: searchRegex }, { description: searchRegex }] }),
      ]);
      results.communities = { data: communities, total: communityTotal };
    }

    if (searchType === 'all' || searchType === 'marketplace') {
      const [items, itemTotal] = await Promise.all([
        MarketplaceItem.find({ institution, status: 'active', $or: [{ title: searchRegex }, { description: searchRegex }, { category: searchRegex }] }).populate('seller', 'firstName lastName username avatar').skip(skip).limit(limit).lean(),
        MarketplaceItem.countDocuments({ institution, status: 'active', $or: [{ title: searchRegex }, { description: searchRegex }] }),
      ]);
      results.marketplace = { data: items, total: itemTotal };
    }

    res.status(200).json(formatResponse(true, 'Search results', results));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};
