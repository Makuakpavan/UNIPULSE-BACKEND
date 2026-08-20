import { Request, Response } from 'express';
import Notification from '../models/Notification';
import { formatResponse, buildPagination } from '../utils/helpers';
import { respondServerError } from '../middleware/errorHandler';

export const getNotifications = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread === 'true';
    const { skip } = buildPagination(page, limit);

    const query: any = { recipient: req.user._id };
    if (unreadOnly) query.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.status(200).json(
      formatResponse(true, 'Notifications retrieved', {
        notifications,
        unreadCount,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const markAsRead = async (req: any, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params;
    await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user._id },
      { isRead: true }
    );
    res.status(200).json(formatResponse(true, 'Notification marked as read'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const markAllAsRead = async (req: any, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    res.status(200).json(formatResponse(true, 'All notifications marked as read'));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const deleteNotification = async (req: any, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params;
    await Notification.findOneAndDelete({ _id: notificationId, recipient: req.user._id });
    res.status(200).json(formatResponse(true, 'Notification deleted'));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};
