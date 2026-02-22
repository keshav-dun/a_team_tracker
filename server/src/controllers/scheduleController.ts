import { Response } from 'express';
import mongoose from 'mongoose';
import Entry from '../models/Entry.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { AuthRequest } from '../types/index.js';
import { isMemberAllowedDate } from '../utils/date.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Check if a date is a weekend (Sat/Sun). */
const isWeekend = (dateStr: string): boolean => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
};

export type MatchDateClassification =
  | 'will_be_added'
  | 'conflict_leave'
  | 'locked'
  | 'already_matching'
  | 'holiday'
  | 'weekend';

export interface MatchPreviewDate {
  date: string;
  classification: MatchDateClassification;
  favoriteStatus: string; // office, leave, wfh
  userStatus: string; // office, leave, wfh
  canOverride: boolean;
  reason?: string;
}

/**
 * Preview schedule alignment with a favorite.
 * POST /api/schedule/match-preview
 * Body: { favoriteUserId, startDate, endDate }
 */
export const matchPreview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { favoriteUserId, startDate, endDate } = req.body;
    const userId = req.user!._id;
    const isAdmin = req.user!.role === 'admin';

    // Validate inputs
    if (!favoriteUserId || !mongoose.isValidObjectId(favoriteUserId)) {
      res.status(400).json({ success: false, message: 'Valid favoriteUserId is required' });
      return;
    }
    if (!startDate || !DATE_RE.test(startDate) || !endDate || !DATE_RE.test(endDate)) {
      res.status(400).json({ success: false, message: 'Valid startDate and endDate required (YYYY-MM-DD)' });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ success: false, message: 'endDate must be >= startDate' });
      return;
    }

    // Verify favorite user exists
    const favoriteUser = await User.findById(favoriteUserId);
    if (!favoriteUser || !favoriteUser.isActive) {
      res.status(404).json({ success: false, message: 'Favorite user not found' });
      return;
    }

    // Fetch data in parallel
    const [favoriteEntries, userEntries, holidays] = await Promise.all([
      Entry.find({
        userId: new mongoose.Types.ObjectId(favoriteUserId),
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      Entry.find({
        userId,
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      Holiday.find({
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
    ]);

    // Build lookup maps
    const favEntryMap: Record<string, any> = {};
    favoriteEntries.forEach((e: any) => { favEntryMap[e.date] = e; });

    const userEntryMap: Record<string, any> = {};
    userEntries.forEach((e: any) => { userEntryMap[e.date] = e; });

    const holidaySet = new Set(holidays.map((h: any) => h.date));

    // Generate dates in range
    const dates: string[] = [];
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }

    // Classify each date
    const preview: MatchPreviewDate[] = dates
      .filter((date) => {
        // Only consider dates where favorite has office
        const favEntry = favEntryMap[date];
        return favEntry?.status === 'office';
      })
      .map((date) => {
        const favEntry = favEntryMap[date];
        const userEntry = userEntryMap[date];
        const favoriteStatus = favEntry?.status || 'wfh';
        const userStatus = userEntry?.status || 'wfh';

        // Weekend
        if (isWeekend(date)) {
          return {
            date,
            classification: 'weekend' as MatchDateClassification,
            favoriteStatus,
            userStatus,
            canOverride: false,
            reason: 'Weekend',
          };
        }

        // Holiday
        if (holidaySet.has(date)) {
          return {
            date,
            classification: 'holiday' as MatchDateClassification,
            favoriteStatus,
            userStatus,
            canOverride: false,
            reason: 'Public holiday',
          };
        }

        // Locked (outside editing window)
        if (!isAdmin && !isMemberAllowedDate(date)) {
          return {
            date,
            classification: 'locked' as MatchDateClassification,
            favoriteStatus,
            userStatus,
            canOverride: false,
            reason: 'Outside editing window',
          };
        }

        // Already matching (user already office)
        if (userStatus === 'office') {
          return {
            date,
            classification: 'already_matching' as MatchDateClassification,
            favoriteStatus,
            userStatus,
            canOverride: false,
          };
        }

        // Conflict — user has leave
        if (userStatus === 'leave') {
          return {
            date,
            classification: 'conflict_leave' as MatchDateClassification,
            favoriteStatus,
            userStatus,
            canOverride: true,
            reason: 'You have leave on this day',
          };
        }

        // Will be added (user is WFH, favorite is office)
        return {
          date,
          classification: 'will_be_added' as MatchDateClassification,
          favoriteStatus,
          userStatus,
          canOverride: false,
        };
      });

    // Check if favorite's data may have changed recently
    const latestFavEntry = favoriteEntries.length > 0
      ? Math.max(...favoriteEntries.map((e: any) => new Date(e.updatedAt).getTime()))
      : 0;

    res.json({
      success: true,
      data: {
        favoriteUser: {
          _id: favoriteUser._id,
          name: favoriteUser.name,
          email: favoriteUser.email,
        },
        preview,
        lastUpdated: latestFavEntry ? new Date(latestFavEntry).toISOString() : null,
      },
    });
  } catch (error: any) {
    console.error('matchPreview error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate match preview' });
  }
};

/**
 * Apply schedule alignment.
 * POST /api/schedule/match-apply
 * Body: { favoriteUserId, dates: string[], overrideLeave: boolean }
 */
export const matchApply = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { favoriteUserId, dates, overrideLeave = false } = req.body;
    const userId = req.user!._id;
    const isAdmin = req.user!.role === 'admin';

    // Validate
    if (!favoriteUserId || !mongoose.isValidObjectId(favoriteUserId)) {
      res.status(400).json({ success: false, message: 'Valid favoriteUserId is required' });
      return;
    }
    if (!Array.isArray(dates) || dates.length === 0) {
      res.status(400).json({ success: false, message: 'dates array is required' });
      return;
    }

    // Verify favorite user still exists
    const favoriteUser = await User.findById(favoriteUserId);
    if (!favoriteUser || !favoriteUser.isActive) {
      res.status(404).json({ success: false, message: 'Favorite user not found' });
      return;
    }

    // Re-fetch favorite's entries for the requested dates
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    const [favoriteEntries, userEntries, holidays] = await Promise.all([
      Entry.find({
        userId: new mongoose.Types.ObjectId(favoriteUserId),
        date: { $in: dates },
      }).lean(),
      Entry.find({
        userId,
        date: { $in: dates },
      }).lean(),
      Holiday.find({
        date: { $gte: minDate, $lte: maxDate },
      }).lean(),
    ]);

    const favEntryMap: Record<string, any> = {};
    favoriteEntries.forEach((e: any) => { favEntryMap[e.date] = e; });

    const userEntryMap: Record<string, any> = {};
    userEntries.forEach((e: any) => { userEntryMap[e.date] = e; });

    const holidaySet = new Set(holidays.map((h: any) => h.date));

    // Check if favorite's schedule has changed
    const staleCheck = dates.some((date) => {
      const favEntry = favEntryMap[date];
      return !favEntry || favEntry.status !== 'office';
    });

    if (staleCheck) {
      res.status(409).json({
        success: false,
        message: 'Schedule has changed. Please review again.',
      });
      return;
    }

    const results: { date: string; success: boolean; message?: string }[] = [];

    for (const date of dates) {
      // Validate date format
      if (!DATE_RE.test(date)) {
        results.push({ date, success: false, message: 'Invalid date format' });
        continue;
      }

      // Skip weekends
      if (isWeekend(date)) {
        results.push({ date, success: false, message: 'Weekend' });
        continue;
      }

      // Skip holidays
      if (holidaySet.has(date)) {
        results.push({ date, success: false, message: 'Holiday' });
        continue;
      }

      // Check editing window
      if (!isAdmin && !isMemberAllowedDate(date)) {
        results.push({ date, success: false, message: 'Outside editing window' });
        continue;
      }

      // Check user's current status
      const userEntry = userEntryMap[date];
      const userStatus = userEntry?.status || 'wfh';

      // Already office
      if (userStatus === 'office') {
        results.push({ date, success: true, message: 'Already matching' });
        continue;
      }

      // User has leave — don't override unless explicitly allowed
      if (userStatus === 'leave' && !overrideLeave) {
        results.push({ date, success: false, message: 'Leave conflict — override not enabled' });
        continue;
      }

      // Apply: set to office
      try {
        await Entry.findOneAndUpdate(
          { userId, date },
          {
            $set: { userId, date, status: 'office' },
            $unset: {
              leaveDuration: 1,
              halfDayPortion: 1,
              workingPortion: 1,
              note: 1,
              startTime: 1,
              endTime: 1,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );
        results.push({ date, success: true });
      } catch (err: any) {
        console.error(`matchApply: failed for ${date}:`, err);
        results.push({ date, success: false, message: 'Failed to apply' });
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.filter((r) => r.success).length,
        skipped: results.filter((r) => !r.success).length,
        results,
      },
    });
  } catch (error: any) {
    console.error('matchApply error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply schedule alignment' });
  }
};
