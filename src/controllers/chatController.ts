import { Request, Response } from 'express';
import Message from '../models/Message';
import User from '../models/User';
import { formatResponse, buildPagination, sanitizeContent } from '../utils/helpers';
import { respondServerError } from '../middleware/errorHandler';
import { socketService } from '../services/socketService';
import { UserRole } from '../types';

export const sendMessage = async (req: any, res: Response): Promise<void> => {
  try {
    const { receiverId, content, isAnonymous = false } = req.body;
    const senderId = req.user._id.toString();

    if (senderId === receiverId) {
      res.status(400).json(formatResponse(false, 'Cannot message yourself'));
      return;
    }

    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.isActive) {
      res.status(404).json(formatResponse(false, 'Receiver not found'));
      return;
    }

    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      receiver.institution?.toString() !== req.user.institution?.toString()
    ) {
      res.status(403).json(formatResponse(false, 'Can only message users from your institution'));
      return;
    }

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content: sanitizeContent(content),
      isAnonymous,
    });

    await message.populate('sender', 'firstName lastName username avatar');

    socketService.emitToUser(receiverId, 'new_message', {
      message: {
        id: message._id,
        sender: isAnonymous ? null : message.sender,
        content: message.content,
        isAnonymous: message.isAnonymous,
        createdAt: message.createdAt,
      },
    });

    res.status(201).json(formatResponse(true, 'Message sent', { message }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getConversations = async (req: any, res: Response): Promise<void> => {
  try {
    const userId = req.user._id.toString();
    const sentMessages = await Message.distinct('receiver', { sender: userId });
    const receivedMessages = await Message.distinct('sender', { receiver: userId });
    const partnerIds = [...new Set([...sentMessages, ...receivedMessages])];

    const partners = await User.find({ _id: { $in: partnerIds } })
      .select('firstName lastName username avatar')
      .lean();

    const conversations = await Promise.all(
      partners.map(async (partner: any) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: partner._id },
            { sender: partner._id, receiver: userId },
          ],
        }).sort({ createdAt: -1 }).lean();

        const unreadCount = await Message.countDocuments({
          sender: partner._id,
          receiver: userId,
          isRead: false,
        });

        return { partner, lastMessage, unreadCount };
      })
    );

    res.status(200).json(formatResponse(true, 'Conversations retrieved', { conversations }));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getMessages = async (req: any, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const { skip } = buildPagination(page, limit);

    const [messages, total] = await Promise.all([
      Message.find({
        $or: [
          { sender: currentUserId, receiver: userId },
          { sender: userId, receiver: currentUserId },
        ],
      })
        .populate('sender', 'firstName lastName username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({
        $or: [
          { sender: currentUserId, receiver: userId },
          { sender: userId, receiver: currentUserId },
        ],
      }),
    ]);

    await Message.updateMany(
      { sender: userId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );

    // The live socket payload nulls the sender on anonymous messages; history
    // has to do the same or the identity leaks on the next page load. The
    // sender still sees their own messages attributed.
    const sanitizedMessages = messages.map((message: any) => {
      if (!message.isAnonymous) return message;
      const senderId = message.sender?._id?.toString() ?? message.sender?.toString();
      return senderId === currentUserId ? message : { ...message, sender: null };
    });

    res.status(200).json(
      formatResponse(true, 'Messages retrieved', {
        messages: sanitizedMessages.reverse(),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getUnreadCount = async (req: any, res: Response): Promise<void> => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false,
    });
    res.status(200).json(formatResponse(true, 'Unread count retrieved', { count }));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};
