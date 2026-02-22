import webPush from 'web-push';
import config from '../config/index.js';
import PushSubscription, { IPushSubscription } from '../models/PushSubscription.js';

/* ── Initialise web-push with VAPID keys ──────── */
if (config.vapidPublicKey && config.vapidPrivateKey) {
  webPush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );
}

/** Payload shape expected by our service worker */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to a single subscription.
 * Returns `true` on success. On 410 (Gone) the stale subscription is removed.
 */
async function sendToSubscription(
  sub: IPushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) return false;

  try {
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 } // 1 hour
    );
    return true;
  } catch (error: any) {
    // 404 or 410 → subscription expired / unsubscribed
    if (error.statusCode === 404 || error.statusCode === 410) {
      await PushSubscription.deleteOne({ _id: sub._id });
      console.info(`[Push] Removed stale subscription ${sub.endpoint.slice(0, 40)}…`);
    } else {
      console.error('[Push] Failed to send notification:', error.message);
    }
    return false;
  }
}

/* ── Public helpers ───────────────────────────── */

/**
 * Notify all subscribers of a specific user.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  const subs = await PushSubscription.find({ userId });
  let sent = 0;
  for (const sub of subs) {
    if (await sendToSubscription(sub, payload)) sent++;
  }
  return sent;
}

/**
 * Notify all subscribers who have a specific preference enabled,
 * optionally excluding a particular user (e.g. the actor who triggered
 * the event).
 */
export async function notifyAllWithPreference(
  preferenceKey: keyof IPushSubscription['preferences'],
  payload: PushPayload,
  excludeUserId?: string
): Promise<number> {
  const filter: Record<string, unknown> = {
    [`preferences.${preferenceKey}`]: true,
  };
  if (excludeUserId) {
    filter.userId = { $ne: excludeUserId };
  }
  const subs = await PushSubscription.find(filter);
  let sent = 0;
  for (const sub of subs) {
    if (await sendToSubscription(sub, payload)) sent++;
  }
  return sent;
}

/**
 * Notify team members when someone changes their status for today.
 * Runs in the background (fire-and-forget).
 */
export function notifyTeamStatusChange(
  actorName: string,
  actorId: string,
  date: string,
  newStatus: string
): void {
  const isToday = date === new Date().toISOString().slice(0, 10);
  if (!isToday) return; // Only send push for today's changes

  const payload: PushPayload = {
    title: '📍 Team Status Update',
    body: `${actorName} is now "${newStatus}" today.`,
    url: '/',
    tag: `status-${actorId}-${date}`,
  };

  notifyAllWithPreference('teamStatusChanges', payload, actorId).catch((err) =>
    console.error('[Push] notifyTeamStatusChange error:', err)
  );
}

/**
 * Notify all subscribers about a new holiday or event created by admin.
 */
export function notifyAdminAnnouncement(
  title: string,
  body: string,
  url = '/'
): void {
  const payload: PushPayload = { title, body, url, tag: 'admin-announcement' };
  notifyAllWithPreference('adminAnnouncements', payload).catch((err) =>
    console.error('[Push] notifyAdminAnnouncement error:', err)
  );
}
