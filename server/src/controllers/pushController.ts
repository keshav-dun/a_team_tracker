import { Response } from 'express';
import PushSubscription from '../models/PushSubscription.js';
import { AuthRequest } from '../types/index.js';

/**
 * POST /api/push/subscribe
 * Store (or update) a push subscription for the authenticated user.
 */
export const subscribe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { endpoint, keys, preferences } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ success: false, message: 'Invalid push subscription payload' });
      return;
    }

    const sub = await PushSubscription.findOneAndUpdate(
      { userId, endpoint },
      {
        userId,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        ...(preferences ? { preferences } : {}),
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, data: sub });
  } catch (error: any) {
    console.error('push subscribe error:', error);
    res.status(500).json({ success: false, message: 'Failed to save subscription' });
  }
};

/**
 * DELETE /api/push/subscribe
 * Remove the push subscription for the authenticated user.
 */
export const unsubscribe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ success: false, message: 'Endpoint is required' });
      return;
    }

    await PushSubscription.deleteOne({ userId, endpoint });
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('push unsubscribe error:', error);
    res.status(500).json({ success: false, message: 'Failed to unsubscribe' });
  }
};

/**
 * GET /api/push/status
 * Check if the requesting user has any active push subscriptions
 * and return their notification preferences.
 */
export const getStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const subs = await PushSubscription.find({ userId }).select('endpoint preferences');

    res.json({
      success: true,
      data: {
        subscribed: subs.length > 0,
        subscriptionCount: subs.length,
        preferences: subs[0]?.preferences ?? {
          teamStatusChanges: true,
          weeklyReminder: true,
          adminAnnouncements: true,
        },
      },
    });
  } catch (error) {
    console.error('push status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch push status' });
  }
};

/**
 * PUT /api/push/preferences
 * Update notification preferences for ALL of this user's subscriptions.
 */
export const updatePreferences = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      res.status(400).json({ success: false, message: 'preferences object is required' });
      return;
    }

    const update: Record<string, boolean> = {};
    if (typeof preferences.teamStatusChanges === 'boolean') {
      update['preferences.teamStatusChanges'] = preferences.teamStatusChanges;
    }
    if (typeof preferences.weeklyReminder === 'boolean') {
      update['preferences.weeklyReminder'] = preferences.weeklyReminder;
    }
    if (typeof preferences.adminAnnouncements === 'boolean') {
      update['preferences.adminAnnouncements'] = preferences.adminAnnouncements;
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ success: false, message: 'No valid preference keys provided' });
      return;
    }

    await PushSubscription.updateMany({ userId }, { $set: update });

    // Fetch updated preferences
    const sub = await PushSubscription.findOne({ userId }).select('preferences');
    res.json({
      success: true,
      data: {
        preferences: sub?.preferences ?? preferences,
      },
    });
  } catch (error) {
    console.error('push updatePreferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
};
