import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { TokenPayload } from '../types';
import logger from '../utils/logger';

class SocketService {
  private io: SocketServer | null = null;
  private userSockets: Map<string, string[]> = new Map();

  initialize(io: SocketServer) {
    this.io = io;

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token as string, env.jwtAccessSecret) as TokenPayload;
        socket.data.userId = decoded.userId;
        socket.data.role = decoded.role;
        socket.data.institutionId = decoded.institutionId;

        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    io.on('connection', (socket) => {
      const userId = socket.data.userId as string;
      logger.info(`User connected: ${userId}, Socket: ${socket.id}`);

      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)?.push(socket.id);

      // Join institution room
      if (socket.data.institutionId) {
        socket.join(`institution:${socket.data.institutionId}`);
      }

      // Join personal room
      socket.join(`user:${userId}`);

      // Handle typing events
      socket.on('typing', (data: { receiverId: string; isTyping: boolean }) => {
        this.emitToUser(data.receiverId, 'typing', {
          userId,
          isTyping: data.isTyping,
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          const updated = sockets.filter((id) => id !== socket.id);
          if (updated.length === 0) {
            this.userSockets.delete(userId);
          } else {
            this.userSockets.set(userId, updated);
          }
        }
        logger.info(`User disconnected: ${userId}, Socket: ${socket.id}`);
      });
    });
  }

  emitToUser(userId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  emitToInstitution(institutionId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`institution:${institutionId}`).emit(event, data);
    }
  }

  broadcast(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.length > 0;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }
}

export const socketService = new SocketService();
