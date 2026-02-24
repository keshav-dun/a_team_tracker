/**
 * Stage 2 — Person Resolver
 *
 * Resolves person references from chat queries to User documents.
 * Handles: "me"/"my"/"I", fuzzy name matching, "my team", ambiguity.
 */

import User, { IUser } from '../models/User.js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ResolvedPerson {
  userId: string;
  name: string;
}

export interface PersonResolutionResult {
  resolved: ResolvedPerson[];
  /** Set when there's ambiguity requiring user clarification */
  clarification?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Escape regex-special characters in a string. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/*  Core resolver                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolve a single name reference to User doc(s).
 * Returns matches or a clarification message.
 */
async function resolveOneName(name: string): Promise<PersonResolutionResult> {
  const users = await User.find({
    isActive: true,
    name: { $regex: escapeRegExp(name), $options: 'i' },
  }).select('name email');

  if (users.length === 0) {
    return {
      resolved: [],
      clarification: `I couldn't find anyone named "${name}" in the team. Please check the spelling.`,
    };
  }

  if (users.length > 1) {
    const names = users.map((u) => u.name).join(', ');
    return {
      resolved: users.map((u) => ({ userId: u._id.toString(), name: u.name })),
      clarification: `I found multiple people matching "${name}": ${names}. Which one did you mean?`,
    };
  }

  return {
    resolved: [{ userId: users[0]._id.toString(), name: users[0].name }],
  };
}

/**
 * Resolve a list of person references from an extracted query.
 *
 * @param people       Names / pronouns extracted from the question
 * @param currentUser  The authenticated user making the request
 */
export async function resolvePeople(
  people: string[],
  currentUser: { _id: any; name: string },
): Promise<PersonResolutionResult> {
  const allResolved: ResolvedPerson[] = [];
  const clarifications: string[] = [];

  for (const ref of people) {
    const lower = ref.toLowerCase().trim();

    // Self-references
    if (['me', 'my', 'i', 'myself', 'mine'].includes(lower)) {
      allResolved.push({
        userId: currentUser._id.toString(),
        name: currentUser.name,
      });
      continue;
    }

    // "my team" → favorites as proxy, or all active users
    if (lower === 'my team' || lower === 'team') {
      const userDoc = await User.findById(currentUser._id).select('favorites');
      if (userDoc?.favorites && userDoc.favorites.length > 0) {
        const favUsers = await User.find({
          _id: { $in: userDoc.favorites },
          isActive: true,
        }).select('name');
        for (const u of favUsers) {
          allResolved.push({ userId: u._id.toString(), name: u.name });
        }
      } else {
        // Fall back to all active users
        const allUsers = await User.find({ isActive: true }).select('name');
        for (const u of allUsers) {
          allResolved.push({ userId: u._id.toString(), name: u.name });
        }
      }
      continue;
    }

    // Named person
    const result = await resolveOneName(lower);
    allResolved.push(...result.resolved);
    if (result.clarification) {
      clarifications.push(result.clarification);
    }
  }

  // Deduplicate by userId
  const seen = new Set<string>();
  const deduped: ResolvedPerson[] = [];
  for (const p of allResolved) {
    if (!seen.has(p.userId)) {
      seen.add(p.userId);
      deduped.push(p);
    }
  }

  return {
    resolved: deduped,
    clarification: clarifications.length > 0 ? clarifications.join('\n') : undefined,
  };
}

/**
 * Extract person names from the question text using simple heuristics.
 * Used when the fast-path (Stage 0) detects a person reference.
 */
export function extractPersonName(question: string): string | null {
  const patterns = [
    /\bis\s+(\w+)\s+(on|in|coming|going)/i,
    /\bwhen\s+is\s+(\w+)\s+(coming|going|in)/i,
    /\bwhen\s+will\s+(\w+)\s+(be|come)/i,
    /\bwhere\s+is\s+(\w+)/i,
    /\b(\w+)\s+coming\s+to\s+office/i,
    /\bis\s+(\w+)\s+on\s+leave/i,
  ];

  const stopWords = new Set([
    'there', 'anyone', 'everyone', 'the', 'any', 'most', 'many',
    'that', 'this', 'next', 'all', 'some', 'each', 'every',
  ]);

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      const name = match[1].toLowerCase();
      if (!stopWords.has(name)) {
        return name;
      }
    }
  }

  return null;
}
