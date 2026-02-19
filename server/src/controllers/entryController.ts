import { Response } from 'express';
import Entry from '../models/Entry';
import User from '../models/User';
import { AuthRequest } from '../types';
import {
  isPastDate,
  isWithinPlanningWindow,
  getMonthRange,
  getTodayString,
} from '../utils/date';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validate and sanitise the optional time window. Returns error message or null. */
const validateTimeWindow = (
  startTime?: string,
  endTime?: string
): string | null => {
  if (!startTime && !endTime) return null;
  if ((startTime && !endTime) || (!startTime && endTime)) {
    return 'Both startTime and endTime must be provided together';
  }
  if (!TIME_RE.test(startTime!)) return 'startTime must be in HH:mm 24-hour format';
  if (!TIME_RE.test(endTime!)) return 'endTime must be in HH:mm 24-hour format';
  if (endTime! <= startTime!) return 'endTime must be after startTime';
  return null;
};

/** Strip HTML / script tags for basic XSS prevention. */
const sanitizeText = (text: string): string =>
  text.replace(/<[^>]*>/g, '').trim();

/**
 * Set or update a day's status (office or leave), with optional time window & note.
 * PUT /api/entries
 * Body: { date, status, note?, startTime?, endTime? }
 */
export const upsertEntry = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { date, status, note, startTime, endTime } = req.body;
    const userId = req.user!._id;
    const isAdmin = req.user!.role === 'admin';

    // Validate status
    if (!['office', 'leave'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Status must be "office" or "leave"',
      });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        success: false,
        message: 'Date must be in YYYY-MM-DD format',
      });
      return;
    }

    // Members cannot edit past dates
    if (!isAdmin && isPastDate(date)) {
      res.status(403).json({
        success: false,
        message: 'Cannot modify past dates',
      });
      return;
    }

    // Members must be within planning window
    if (!isAdmin && !isWithinPlanningWindow(date)) {
      res.status(403).json({
        success: false,
        message: 'Date must be within 90 days from today',
      });
      return;
    }

    // Validate time window
    const timeErr = validateTimeWindow(startTime, endTime);
    if (timeErr) {
      res.status(400).json({ success: false, message: timeErr });
      return;
    }

    // Validate note length
    if (note && note.length > 500) {
      res.status(400).json({ success: false, message: 'Note cannot exceed 500 characters' });
      return;
    }

    const updateData: Record<string, unknown> = {
      userId,
      date,
      status,
      note: note ? sanitizeText(note) : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    };

    // If times are explicitly cleared (sent as empty string / null), unset them
    const unsetFields: Record<string, 1> = {};
    if (startTime === '' || startTime === null) { unsetFields.startTime = 1; unsetFields.endTime = 1; delete updateData.startTime; delete updateData.endTime; }
    if (note === '' || note === null) { unsetFields.note = 1; delete updateData.note; }

    const updateOp: Record<string, unknown> = { $set: updateData };
    if (Object.keys(unsetFields).length) updateOp.$unset = unsetFields;

    const entry = await Entry.findOneAndUpdate(
      { userId, date },
      updateOp,
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: entry });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ success: false, message: 'Duplicate entry' });
      return;
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Admin sets/updates entry for another user.
 * PUT /api/entries/admin
 * Body: { userId, date, status, note?, startTime?, endTime? }
 */
export const adminUpsertEntry = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId, date, status, note, startTime, endTime } = req.body;

    if (!['office', 'leave'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Status must be "office" or "leave"',
      });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({
        success: false,
        message: 'Date must be in YYYY-MM-DD format',
      });
      return;
    }

    // Validate time window
    const timeErr = validateTimeWindow(startTime, endTime);
    if (timeErr) {
      res.status(400).json({ success: false, message: timeErr });
      return;
    }

    if (note && note.length > 500) {
      res.status(400).json({ success: false, message: 'Note cannot exceed 500 characters' });
      return;
    }

    // Verify target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const updateData: Record<string, unknown> = {
      userId,
      date,
      status,
      note: note ? sanitizeText(note) : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    };

    const unsetFields: Record<string, 1> = {};
    if (startTime === '' || startTime === null) { unsetFields.startTime = 1; unsetFields.endTime = 1; delete updateData.startTime; delete updateData.endTime; }
    if (note === '' || note === null) { unsetFields.note = 1; delete updateData.note; }

    const updateOp: Record<string, unknown> = { $set: updateData };
    if (Object.keys(unsetFields).length) updateOp.$unset = unsetFields;

    const entry = await Entry.findOneAndUpdate(
      { userId, date },
      updateOp,
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: entry });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Remove an entry (revert to WFH).
 * DELETE /api/entries/:date
 */
export const deleteEntry = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { date } = req.params;
    const userId = req.user!._id;
    const isAdmin = req.user!.role === 'admin';

    if (!isAdmin && isPastDate(date)) {
      res.status(403).json({
        success: false,
        message: 'Cannot modify past dates',
      });
      return;
    }

    const entry = await Entry.findOneAndDelete({ userId, date });

    res.json({
      success: true,
      message: entry ? 'Entry removed (status reverted to WFH)' : 'No entry found',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Admin removes an entry for any user.
 * DELETE /api/entries/admin/:userId/:date
 */
export const adminDeleteEntry = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId, date } = req.params;

    const entry = await Entry.findOneAndDelete({ userId, date });

    res.json({
      success: true,
      message: entry ? 'Entry removed (status reverted to WFH)' : 'No entry found',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get current user's entries for a date range.
 * GET /api/entries?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getMyEntries = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
      return;
    }

    const entries = await Entry.find({
      userId: req.user!._id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get team view: all active users' entries for a month.
 * GET /api/entries/team?month=YYYY-MM
 */
export const getTeamEntries = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { month } = req.query as { month?: string };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({
        success: false,
        message: 'month query param is required in YYYY-MM format',
      });
      return;
    }

    const { startDate, endDate } = getMonthRange(month);

    // Get all active users
    const users = await User.find({ isActive: true })
      .select('name email role')
      .sort({ name: 1 });

    // Get all entries for the month
    const entries = await Entry.find({
      date: { $gte: startDate, $lte: endDate },
      userId: { $in: users.map((u) => u._id) },
    });

    // Build a lookup: { [userId]: { [date]: { status, note?, startTime?, endTime? } } }
    const entryMap: Record<string, Record<string, { status: string; note?: string; startTime?: string; endTime?: string }>> = {};
    entries.forEach((e) => {
      const uid = e.userId.toString();
      if (!entryMap[uid]) entryMap[uid] = {};
      entryMap[uid][e.date] = {
        status: e.status,
        ...(e.note ? { note: e.note } : {}),
        ...(e.startTime ? { startTime: e.startTime } : {}),
        ...(e.endTime ? { endTime: e.endTime } : {}),
      };
    });

    const teamData = users.map((user) => ({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      entries: entryMap[user._id.toString()] || {},
    }));

    res.json({
      success: true,
      data: {
        month,
        startDate,
        endDate,
        today: getTodayString(),
        team: teamData,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
