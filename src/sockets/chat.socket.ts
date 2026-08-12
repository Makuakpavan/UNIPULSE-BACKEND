import { Server, Socket } from 'socket.io';
import Message from '../models/Message';
import { socketService } from '../services/socketService';
import logger from '../utils/logger';

export const initializeChatSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('send_message', async (data: { receiverId: string; content: string; isAnonymous?: boolean }) => {
      try {
        const { receiverId, content, isAnonymous = false } = data;
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          content,
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
