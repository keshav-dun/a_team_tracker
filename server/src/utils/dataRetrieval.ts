/**
 * Stage 3 — Data Retrieval
 *
 * Core data-fetching functions for the chat pipeline.
 * Wraps existing model queries into reusable, typed functions.
 */

import Entry from '../models/Entry.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { getWorkingDays, getHolidaySet } from './workingDays.js';
import type { ResolvedPerson } from './personResolver.js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface EntryData {
  status: string;
  leaveDuration?: string;
  workingPortion?: string;
}

export interface AttendanceStats {
  totalWorkingDays: number;
  officeDays: number;
  leaveDays: number;
  wfhDays: number;
  officePercent: number;
}

export interface UserScheduleData {
  userId: string;
  name: string;
  stats: AttendanceStats;
  entryMap: Map<string, EntryData>;
  workingDays: string[];
  coverage: DataCoverage;
}

export interface DataCoverage {
  userId: string;
  name: string;
  coverage: number;
  daysWithEntries: number;
  totalWorkingDays: number;
  level: 'high' | 'medium' | 'low' | 'none';
}

export interface TeamPresenceDay {
  date: string;
  officeUsers: string[];
  count: number;
  totalTeam: number;
}

/* ------------------------------------------------------------------ */
/*  Core retrieval functions                                          */
/* ------------------------------------------------------------------ */

/**
 * Compute attendance statistics for a user over a date range.
 * Replicates the logic from analyticsController.computeAttendanceStats.
 */
export async function computeAttendanceStats(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<{
  stats: AttendanceStats;
  workingDays: string[];
  entryMap: Map<string, EntryData>;
}> {
  const [holidaySet, entries] = await Promise.all([
    getHolidaySet(startDate, endDate),
    Entry.find({ userId, date: { $gte: startDate, $lte: endDate } }),
  ]);

  const workingDays = getWorkingDays(startDate, endDate, holidaySet);
  const totalWorkingDays = workingDays.length;

  const entryMap = new Map<string, EntryData>(
    entries.map((e) => [
      e.date,
      {
        status: e.status,
        leaveDuration: e.leaveDuration,
        workingPortion: e.workingPortion,
      },
    ]),
  );

  let officeDays = 0;
  let leaveDays = 0;

  for (const d of workingDays) {
    const entry = entryMap.get(d);
    if (!entry) continue;
    if (entry.status === 'office') {
      officeDays++;
    } else if (entry.status === 'leave') {
      if (entry.leaveDuration === 'half') {
        leaveDays += 0.5;
        if (entry.workingPortion === 'office') {
          officeDays += 0.5;
        }
      } else {
        leaveDays++;
      }
    }
  }

  const wfhDays = totalWorkingDays - officeDays - leaveDays;
  const officePercent =
    totalWorkingDays > 0 ? Math.round((officeDays / totalWorkingDays) * 100) : 0;

  return {
    stats: { totalWorkingDays, officeDays, leaveDays, wfhDays, officePercent },
    workingDays,
    entryMap,
  };
}

/**
 * Get full schedule data for a user, including coverage check (Gap #5).
 */
export async function getUserScheduleData(
  person: ResolvedPerson,
  startDate: string,
  endDate: string,
): Promise<UserScheduleData> {
  const { stats, workingDays, entryMap } = await computeAttendanceStats(
    person.userId,
    startDate,
    endDate,
  );

  const daysWithEntries = workingDays.filter((d) => entryMap.has(d)).length;
  const coverageRatio =
    workingDays.length > 0 ? daysWithEntries / workingDays.length : 0;

  let level: DataCoverage['level'];
  if (daysWithEntries === 0) level = 'none';
  else if (coverageRatio < 0.4) level = 'low';
  else if (coverageRatio < 0.8) level = 'medium';
  else level = 'high';

  return {
    userId: person.userId,
    name: person.name,
    stats,
    entryMap,
    workingDays,
    coverage: {
      userId: person.userId,
      name: person.name,
      coverage: Math.round(coverageRatio * 100),
      daysWithEntries,
      totalWorkingDays: workingDays.length,
      level,
    },
  };
}

/**
 * Get team presence by day: for each working day in the range, list
 * which users are in the office and the count.
 */
export async function getTeamPresenceByDay(
  startDate: string,
  endDate: string,
): Promise<TeamPresenceDay[]> {
  const [users, holidaySet, entries] = await Promise.all([
    User.find({ isActive: true }).select('name'),
    getHolidaySet(startDate, endDate),
    Entry.find({ date: { $gte: startDate, $lte: endDate } }),
  ]);

  const workingDays = getWorkingDays(startDate, endDate, holidaySet);
  const totalTeam = users.length;
  const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

  // Build date → userId → status
  const entryByDate = new Map<string, Map<string, string>>();
  for (const e of entries) {
    if (!entryByDate.has(e.date)) entryByDate.set(e.date, new Map());
    entryByDate.get(e.date)!.set(e.userId.toString(), e.status);
  }

  return workingDays.map((date) => {
    const dateEntries = entryByDate.get(date) || new Map<string, string>();
    const officeUsers: string[] = [];

    for (const [uid, status] of dateEntries) {
      if (status === 'office') {
        officeUsers.push(userMap.get(uid) || uid);
      }
    }

    return { date, officeUsers, count: officeUsers.length, totalTeam };
  });
}

/**
 * Get schedule data for multiple people in parallel.
 */
export async function getMultipleUserSchedules(
  people: ResolvedPerson[],
  startDate: string,
  endDate: string,
): Promise<UserScheduleData[]> {
  return Promise.all(
    people.map((p) => getUserScheduleData(p, startDate, endDate)),
  );
}
