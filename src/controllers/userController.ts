import { Request, Response } from 'express';
import User from '../models/User';
import Institution from '../models/Institution';
import { formatResponse, buildPagination, containsId, escapeRegex, slugify } from '../utils/helpers';
import { cacheGet, cacheSet, cacheDeletePattern } from '../config/redis';
import { AppError, respondServerError } from '../middleware/errorHandler';
import { InstitutionStatus } from '../types';
import { uploadToCloudinary } from '../config/cloudinary';
import fs from 'fs';
import logger from '../utils/logger';
import Notification from '../models/Notification';

export const getUserProfile = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    // The cache key is scoped to the viewer's access class. Keying on the target
    // user alone would let a warmed entry serve a private or institution-only
    // profile to a viewer who fails the checks further down.
    const viewerScope =
      userId === currentUser._id.toString() ? 'self' : `inst:${currentUser.institution}`;
    const cacheKey = `user:profile:${userId}:${viewerScope}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(formatResponse(true, 'User profile retrieved', JSON.parse(cached)));
      return;
    }

    const user = await User.findById(userId)
      .populate('institution', 'name slug logo')
      .select('-password -refreshTokens -twoFactorSecret');

    if (!user || !user.isActive) {
      res.status(404).json(formatResponse(false, 'User not found'));
      return;
    }

    // Check visibility permissions
    const isSelf = user._id.toString() === currentUser._id.toString();

    if (user.profileVisibility === 'private' && !isSelf) {
      res.status(403).json(formatResponse(false, 'This profile is private'));
      return;
    }

    // `institution` is populated above, so compare the id rather than the
    // document — stringifying the populated doc never matches a raw ObjectId.
    const targetInstitutionId = (user.institution as any)?._id?.toString();

    if (
      user.profileVisibility === 'institution_only' &&
      !isSelf &&
      targetInstitutionId !== currentUser.institution?.toString()
    ) {
      res.status(403).json(formatResponse(false, 'This profile is only visible to institution members'));
      return;
    }

    const profile = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      department: user.department,
      level: user.level,
      institution: user.institution,
      role: user.role,
      isVerifiedStudent: user.isVerifiedStudent,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      createdAt: user.createdAt,
    };

    await cacheSet(cacheKey, JSON.stringify(profile), 300);
    res.status(200).json(formatResponse(true, 'User profile retrieved', profile));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const updateProfile = async (req: any, res: Response): Promise<void> => {
  try {
    const allowedUpdates = ['firstName', 'lastName', 'bio', 'phone', 'department', 'level', 'profileVisibility'];
    const updates: any = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle avatar upload
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.path, 'unipulse/avatars');
      updates.avatar = uploadResult.url;
      fs.unlinkSync(req.file.path);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens -twoFactorSecret');

    // Profile entries are keyed per viewer scope, so clear the whole set.
    await cacheDeletePattern(`user:profile:${req.user._id}:*`);

    res.status(200).json(formatResponse(true, 'Profile updated successfully', { user }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const followUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();

    if (userId === currentUserId) {
      res.status(400).json(formatResponse(false, 'Cannot follow yourself'));
      return;
    }

    const targetUser = await User.findById(userId);
    if (!targetUser || !targetUser.isActive) {
      res.status(404).json(formatResponse(false, 'User not found'));
      return;
    }

    const isFollowing = containsId(req.user.following, userId);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(currentUserId, { $pull: { following: userId } });
      await User.findByIdAndUpdate(userId, { $pull: { followers: currentUserId } });
      res.status(200).json(formatResponse(true, 'Unfollowed successfully'));
    } else {
      // Follow
      await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: userId } });
      await User.findByIdAndUpdate(userId, { $addToSet: { followers: currentUserId } });

      // Create notification

        await Notification.create({
          recipient: userId,
          type: 'follow',
          title: 'New Follower',
          message: `${req.user.firstName} ${req.user.lastName} started following you`,
          data: { followerId: currentUserId },
        });

      res.status(200).json(formatResponse(true, 'Followed successfully'));
    }
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getFollowers = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'firstName lastName username avatar',
        options: { skip, limit },
      })
      .select('followers');

    res.status(200).json(
      formatResponse(true, 'Followers retrieved', {
        followers: user?.followers || [],
        meta: { page, limit },
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getFollowing = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip } = buildPagination(page, limit);

    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'firstName lastName username avatar',
        options: { skip, limit },
      })
      .select('following');

    res.status(200).json(
      formatResponse(true, 'Following retrieved', {
        following: user?.following || [],
        meta: { page, limit },
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getInstitutions = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const { skip } = buildPagination(page, limit);

    // `$nin` rather than `status: 'approved'` on purpose: institutions created
    // before the status field existed have no `status` at all, and an equality
    // match would drop every one of them out of the registration dropdown.
    const query: any = {
      isActive: true,
      status: { $nin: [InstitutionStatus.PENDING, InstitutionStatus.REJECTED] },
    };
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { location: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [institutions, total] = await Promise.all([
      Institution.find(query).skip(skip).limit(limit).sort({ name: 1 }),
      Institution.countDocuments(query),
    ]);

    res.status(200).json(
      formatResponse(true, 'Institutions retrieved', institutions, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

/**
 * Public: a student whose university is not in the list proposes it during
 * registration. The institution is created in PENDING state and stays out of
 * `getInstitutions` until an admin approves it, but its id is returned right
 * away so the student can finish signing up instead of being blocked on review.
 *
 * Resubmitting an existing university is not an error — the caller just gets
 * the existing record back, which keeps the review queue free of duplicates.
 */
export const requestInstitution = async (req: any, res: Response): Promise<void> => {
  try {
    const { name, location, website, emailDomain, description } = req.body;
    const slug = slugify(name);

    if (!slug) {
      res.status(400).json(formatResponse(false, 'University name must contain letters or numbers'));
      return;
    }

    const existing = await Institution.findOne({
      $or: [{ slug }, { name: { $regex: `^${escapeRegex(name.trim())}$`, $options: 'i' } }],
    });

    if (existing) {
      if (existing.status === InstitutionStatus.REJECTED) {
        res.status(409).json(
          formatResponse(false, 'This university was reviewed and declined. Contact your administrator.')
        );
        return;
      }

      const alreadyPending = existing.status === InstitutionStatus.PENDING;
      res.status(200).json(
        formatResponse(
          true,
          alreadyPending
            ? 'This university has already been submitted and is awaiting approval'
            : 'This university is already listed',
          { institution: publicInstitution(existing) }
        )
      );
      return;
    }

    const institution = await Institution.create({
      name: name.trim(),
      slug,
      location: location || null,
      website: website || null,
      emailDomain: emailDomain ? emailDomain.toLowerCase() : null,
      description: description || null,
      status: InstitutionStatus.PENDING,
      isActive: false,
      // Registration is unauthenticated, so this is normally null; it is only
      // set when an already-signed-in user submits.
      submittedBy: req.user?._id || null,
    });

    logger.info(`Institution submitted for approval: ${institution.name} (${institution.slug})`);

    res.status(201).json(
      formatResponse(
        true,
        'University submitted for approval. You can complete registration now.',
        { institution: publicInstitution(institution) }
      )
    );
  } catch (error: any) {
    // A unique-index race between the lookup above and the insert.
    if (error?.code === 11000) {
      res.status(409).json(formatResponse(false, 'This university has already been submitted'));
      return;
    }
    respondServerError(req, res, error);
  }
};

/** Never leak reviewer identities or rejection notes to an unauthenticated caller. */
const publicInstitution = (institution: any) => ({
  _id: institution._id,
  name: institution.name,
  slug: institution.slug,
  location: institution.location,
  status: institution.status,
});

export const requestVerification = async (req: any, res: Response): Promise<void> => {
  try {
    const { documents } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      verificationDocuments: documents,
      isVerifiedStudent: false,
    });

    res.status(200).json(formatResponse(true, 'Verification request submitted'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};
