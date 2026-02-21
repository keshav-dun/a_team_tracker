import { Response } from 'express';
import Event from '../models/Event.js';
import { AuthRequest } from '../types/index.js';

/**
 * Get events for a date range. All authenticated users can view.
 * GET /api/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getEvents = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const query: Record<string, unknown> = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .sort({ date: 1 });

    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error('getEvents error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
};

/**
 * Create an event (admin only).
 * POST /api/events
 */
export const createEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { date, title, description, eventType } = req.body;

    const event = await Event.create({
      date,
      title,
      description,
      eventType,
      createdBy: req.user!._id,
    });

    const populated = await Event.findById(event._id).populate('createdBy', 'name email');

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'An event with this title already exists on this date',
      });
      return;
    }
    console.error('createEvent error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Update an event (admin only).
 * PUT /api/events/:id
 */
export const updateEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, title, description, eventType } = req.body;

    const updateData: Record<string, unknown> = {};
    if (date !== undefined) updateData.date = date;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (eventType !== undefined) updateData.eventType = eventType;

    const event = await Event.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name email');

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    res.json({ success: true, data: event });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'An event with this title already exists on this date',
      });
      return;
    }
    console.error('updateEvent error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete an event (admin only).
 * DELETE /api/events/:id
 */
export const deleteEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    res.json({ success: true, message: 'Event deleted' });
  } catch (error: any) {
    console.error('deleteEvent error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
