import { Server, Socket } from 'socket.io';
import Message from '../models/Message';
import User from '../models/User';
import { socketService } from '../services/socketService';
import { sanitizeContent } from '../utils/helpers';
import { UserRole } from '../types';
import logger from '../utils/logger';

const MAX_MESSAGE_LENGTH = 2000;

export const initializeChatSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('send_message', async (data: { receiverId: string; content: string; isAnonymous?: boolean }) => {
      try {
        const { receiverId, content, isAnonymous = false } = data ?? {};

        // These are the same guards chatController.sendMessage applies. Without
        // them the socket is an unchecked path to the identical write.
        if (!receiverId || typeof receiverId !== 'string' || receiverId === userId) {
          socket.emit('error', { message: 'Invalid recipient' });
          return;
        }

        const clean = typeof content === 'string' ? sanitizeContent(content) : '';
        if (!clean || clean.length > MAX_MESSAGE_LENGTH) {
          socket.emit('error', { message: 'Message content is required' });
          return;
        }

        const [sender, receiver] = await Promise.all([
          User.findById(userId).select('institution role isActive'),
          User.findById(receiverId).select('institution isActive'),
        ]);

        if (!sender || !sender.isActive) {
          socket.emit('error', { message: 'Sender is not active' });
          return;
        }

        if (!receiver || !receiver.isActive) {
          socket.emit('error', { message: 'Receiver not found' });
          return;
        }

        if (
          sender.role !== UserRole.SUPER_ADMIN &&
          receiver.institution?.toString() !== sender.institution?.toString()
        ) {
          socket.emit('error', { message: 'Can only message users from your institution' });
          return;
        }

        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          content: clean,
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
        socket.emit('message_sent', { message });
      } catch (error) {
        logger.error('Socket send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('mark_read', async (data: { senderId: string }) => {
      try {
        if (!data?.senderId) return;
        await Message.updateMany(
          { sender: data.senderId, receiver: userId, isRead: false },
          { isRead: true }
        );
        socketService.emitToUser(data.senderId, 'messages_read', { by: userId });
      } catch (error) {
        logger.error('Socket mark read error:', error);
      }
    });

    socket.on('join_community', (communityId: string) => {
      socket.join(`community:${communityId}`);
    });

    socket.on('leave_community', (communityId: string) => {
      socket.leave(`community:${communityId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};
