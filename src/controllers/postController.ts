import { Request, Response } from 'express';
import Post from '../models/Post';
import User from '../models/User';
import Notification from '../models/Notification';
import { formatResponse, buildPagination, sanitizeContent } from '../utils/helpers';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../config/redis';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { PostStatus, PostVisibility, UserRole } from '../types';
import fs from 'fs';
import logger from '../utils/logger';

export const createPost = async (req: any, res: Response): Promise<void> => {
  try {
    const { content, visibility = 'public', tags } = req.body;
    const isAnonymous = visibility === 'anonymous';

    const postData: any = {
      author: req.user._id,
      institution: req.user.institution,
      content: sanitizeContent(content),
      visibility: isAnonymous ? PostVisibility.ANONYMOUS : PostVisibility.PUBLIC,
      isAnonymous,
      status: isAnonymous ? PostStatus.PENDING : PostStatus.APPROVED,
      tags: tags?.map((t: string) => t.toLowerCase().trim()) || [],
    };

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file: any) =>
        uploadToCloudinary(file.path, 'unipulse/posts')
      );
      const uploads = await Promise.all(uploadPromises);
      postData.images = uploads.map((u) => u.url);

      // Clean up temp files
      req.files.forEach((file: any) => {
        try { fs.unlinkSync(file.path); } catch {}
      });
    }

    const post = await Post.create(postData);
    await post.populate('author', 'firstName lastName username avatar');

    // Invalidate feed cache
    await cacheDeletePattern(`feed:${req.user.institution}:*`);

    res.status(201).json(
      formatResponse(true, isAnonymous ? 'Post submitted for approval' : 'Post created successfully', { post })
    );
  } catch (error: any) {
    logger.error('Create post error:', error);
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getFeed = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const cacheKey = `feed:${req.user.institution}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(formatResponse(true, 'Feed retrieved', JSON.parse(cached)));
      return;
    }

    const query: any = {
      institution: req.user.institution,
      status: PostStatus.APPROVED,
    };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'firstName lastName username avatar')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(query),
    ]);

    // Anonymize posts
    const sanitizedPosts = posts.map((post: any) => {
      if (post.isAnonymous) {
        post.author = null;
      }
      return post;
    });

    const result = {
      posts: sanitizedPosts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await cacheSet(cacheKey, JSON.stringify(result), 120);
    res.status(200).json(formatResponse(true, 'Feed retrieved', result));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

export const getPost = async (req: any, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('author', 'firstName lastName username avatar')
      .populate('comments.author', 'firstName lastName username avatar');

    if (!post) {
      res.status(404).json(formatResponse(false, 'Post not found'));
      return;
    }

    // Check institution access
    if (
      post.institution?.toString() !== req.user.institution?.toString() &&
      req.user.role !== UserRole.SUPER_ADMIN
    ) {
      res.status(403).json(formatResponse(false, 'You do not have access to this post'));
      return;
    }

    const postObj: any = post.toObject();
    if (postObj.isAnonymous) {
      postObj.author = null;
    }

    res.status(200).json(formatResponse(true, 'Post retrieved', { post: postObj }));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

export const likePost = async (req: any, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const userId = req.user._id.toString();

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json(formatResponse(false, 'Post not found'));
      return;
    }

    const hasLiked = post.likes?.includes(userId);

    if (hasLiked) {
      await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
      res.status(200).json(formatResponse(true, 'Post unliked'));
    } else {
      await Post.findByIdAndUpdate(postId, { $addToSet: { likes: userId } });

      // Create notification (don't notify for anonymous posts or self-likes)
      if (!post.isAnonymous && post.author?.toString() !== userId) {
        await Notification.create({
          recipient: post.author,
          type: 'post_like',
          title: 'New Like',
          message: `${req.user.firstName} ${req.user.lastName} liked your post`,
          data: { postId, userId },
        });
      }

      res.status(200).json(formatResponse(true, 'Post liked'));
    }
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const commentOnPost = async (req: any, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { content, isAnonymous = false } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json(formatResponse(false, 'Post not found'));
      return;
    }

    const comment = {
      author: req.user._id,
      content: sanitizeContent(content),
      isAnonymous,
      createdAt: new Date(),
    };

    post.comments.push(comment as any);
    await post.save();

    // Create notification
    if (!post.isAnonymous && post.author?.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        type: 'post_comment',
        title: 'New Comment',
        message: `${req.user.firstName} ${req.user.lastName} commented on your post`,
        data: { postId, userId: req.user._id },
      });
    }

    await cacheDeletePattern(`feed:${req.user.institution}:*`);

    res.status(201).json(formatResponse(true, 'Comment added successfully', { comment }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const deletePost = async (req: any, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json(formatResponse(false, 'Post not found'));
      return;
    }

    // Check ownership or admin
    if (
      post.author?.toString() !== req.user._id.toString() &&
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.role !== UserRole.INSTITUTION_ADMIN
    ) {
      res.status(403).json(formatResponse(false, 'You do not have permission to delete this post'));
      return;
    }

    // Delete images from Cloudinary
    if (post.images && post.images.length > 0) {
      for (const imageUrl of post.images) {
        try {
          const publicId = imageUrl.split('/').pop()?.split('.')[0];
          if (publicId) await deleteFromCloudinary(`unipulse/posts/${publicId}`);
        } catch {}
      }
    }

    await Post.findByIdAndDelete(postId);
    await cacheDeletePattern(`feed:${req.user.institution}:*`);

    res.status(200).json(formatResponse(true, 'Post deleted successfully'));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

export const getPendingAnonymousPosts = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const query: any = {
      status: PostStatus.PENDING,
      isAnonymous: true,
    };

    // Institution admin only sees their institution
    if (req.user.role === UserRole.INSTITUTION_ADMIN) {
      query.institution = req.user.institution;
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(query),
    ]);

    res.status(200).json(
      formatResponse(true, 'Pending posts retrieved', {
        posts,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};

export const moderatePost = async (req: any, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    const post = await Post.findById(postId).populate('author', 'email firstName');
    if (!post) {
      res.status(404).json(formatResponse(false, 'Post not found'));
      return;
    }

    // Check permissions
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.role !== UserRole.INSTITUTION_ADMIN
    ) {
      res.status(403).json(formatResponse(false, 'Insufficient permissions'));
      return;
    }

    post.status = status;
    await post.save();

    // Send email notification to author
    if (post.isAnonymous && post.author) {
      const { EmailService } = await import('../services/emailService.js');
      EmailService.sendAnonymousPostStatus(
        (post.author as any).email,
        status as 'approved' | 'rejected',
        post.content
      ).catch(() => {});
    }

    await cacheDeletePattern(`feed:${post.institution}:*`);

    res.status(200).json(formatResponse(true, `Post ${status} successfully`, { post }));
  } catch (error: any) {
    res.status(500).json(formatResponse(false, error.message));
  }
};
