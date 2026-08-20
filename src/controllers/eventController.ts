import { Request, Response } from 'express';
import Event from '../models/Event';
import Notification from '../models/Notification';
import { formatResponse, buildPagination, containsId, pick } from '../utils/helpers';
import { respondServerError } from '../middleware/errorHandler';
import { cacheGet, cacheSet, cacheDeletePattern } from '../config/redis';
import { uploadToCloudinary } from '../config/cloudinary';
import { canAccessInstitution, canManage } from '../utils/permissions';
import fs from 'fs';

/**
 * Client-settable event fields. `isApproved`, `attendees`, `institution` and
 * `organizer` are deliberately absent — they are server-owned.
 */
const EVENT_FIELDS = [
  'title', 'description', 'startDate', 'endDate', 'location',
  'isOnline', 'meetingLink', 'category', 'maxAttendees',
];

export const createEvent = async (req: any, res: Response): Promise<void> => {
  try {
    const eventData: any = {
      ...pick(req.body, EVENT_FIELDS),
      organizer: req.user._id,
      institution: req.user.institution,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.path, 'unipulse/events');
      eventData.coverImage = uploadResult.url;
      fs.unlinkSync(req.file.path);
    }

    const event = await Event.create(eventData);
    await event.populate('organizer', 'firstName lastName username avatar');

    await cacheDeletePattern(`events:${req.user.institution}:*`);

    res.status(201).json(formatResponse(true, 'Event created successfully', { event }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const getEvents = async (req: any, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;
    const upcoming = req.query.upcoming === 'true';
    const { skip } = buildPagination(page, limit);

    const cacheKey = `events:${req.user.institution}:${page}:${limit}:${category || 'all'}:${upcoming}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.status(200).json(formatResponse(true, 'Events retrieved', JSON.parse(cached)));
      return;
    }

    const query: any = {
      institution: req.user.institution,
      isApproved: true,
    };

    if (category) query.category = category;
    if (upcoming) query.startDate = { $gte: new Date() };

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('organizer', 'firstName lastName username avatar')
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(query),
    ]);

    const result = {
      events,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    await cacheSet(cacheKey, JSON.stringify(result), 300);
    res.status(200).json(formatResponse(true, 'Events retrieved', result));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const getEvent = async (req: any, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
      .populate('organizer', 'firstName lastName username avatar')
      .populate('attendees', 'firstName lastName username avatar');

    if (!event) {
      res.status(404).json(formatResponse(false, 'Event not found'));
      return;
    }

    if (!canAccessInstitution(event.institution, req.user)) {
      res.status(403).json(formatResponse(false, 'Access denied'));
      return;
    }

    res.status(200).json(formatResponse(true, 'Event retrieved', { event }));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};

export const attendEvent = async (req: any, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id.toString();

    const event = await Event.findById(eventId);
    if (!event) {
      res.status(404).json(formatResponse(false, 'Event not found'));
      return;
    }

    if (!canAccessInstitution(event.institution, req.user)) {
      res.status(403).json(formatResponse(false, 'Access denied'));
      return;
    }

    const isAttending = containsId(event.attendees, userId);

    if (isAttending) {
      await Event.findByIdAndUpdate(eventId, { $pull: { attendees: userId } });
      res.status(200).json(formatResponse(true, 'No longer attending'));
    } else {
      if (event.maxAttendees && event.attendees?.length >= event.maxAttendees) {
        res.status(400).json(formatResponse(false, 'Event is full'));
        return;
      }

      await Event.findByIdAndUpdate(eventId, { $addToSet: { attendees: userId } });

      // Notify organizer
      await Notification.create({
        recipient: event.organizer,
        type: 'event_reminder',
        title: 'New Attendee',
        message: `${req.user.firstName} ${req.user.lastName} is attending your event "${event.title}"`,
        data: { eventId, userId },
      });

      res.status(200).json(formatResponse(true, 'Attending event'));
    }
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const updateEvent = async (req: any, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      res.status(404).json(formatResponse(false, 'Event not found'));
      return;
    }

    if (!canManage({ owner: event.organizer, institution: event.institution }, req.user)) {
      res.status(403).json(formatResponse(false, 'Permission denied'));
      return;
    }

    const updates: any = pick(req.body, EVENT_FIELDS);

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.path, 'unipulse/events');
      updates.coverImage = uploadResult.url;
      fs.unlinkSync(req.file.path);
    }

    const updated = await Event.findByIdAndUpdate(eventId, updates, { new: true, runValidators: true })
      .populate('organizer', 'firstName lastName username avatar');

    await cacheDeletePattern(`events:${event.institution}:*`);

    res.status(200).json(formatResponse(true, 'Event updated', { event: updated }));
  } catch (error: any) {
    res.status(400).json(formatResponse(false, error.message));
  }
};

export const deleteEvent = async (req: any, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);

    if (!event) {
      res.status(404).json(formatResponse(false, 'Event not found'));
      return;
    }

    if (!canManage({ owner: event.organizer, institution: event.institution }, req.user)) {
      res.status(403).json(formatResponse(false, 'Permission denied'));
      return;
    }

    await Event.findByIdAndDelete(eventId);
    await cacheDeletePattern(`events:${event.institution}:*`);

    res.status(200).json(formatResponse(true, 'Event deleted'));
  } catch (error: any) {
    respondServerError(req, res, error);
  }
};
