export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'member' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StatusType = 'office' | 'leave';

export interface Entry {
  _id: string;
  userId: string;
  date: string;
  status: StatusType;
  note?: string;
  startTime?: string; // HH:mm 24h IST
  endTime?: string;   // HH:mm 24h IST
}

export interface Holiday {
  _id: string;
  date: string;
  name: string;
}

// Effective status: includes implicit WFH
export type EffectiveStatus = 'office' | 'leave' | 'wfh' | 'holiday';

export interface EntryDetail {
  status: StatusType;
  note?: string;
  startTime?: string;
  endTime?: string;
}

export interface TeamMemberData {
  user: Pick<User, '_id' | 'name' | 'email' | 'role'>;
  entries: Record<string, EntryDetail>; // { "2026-02-19": { status: "office", ... } }
}

export interface TeamViewResponse {
  month: string;
  startDate: string;
  endDate: string;
  today: string;
  team: TeamMemberData[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
