import api from './client';
import type {
  ApiResponse,
  AuthResponse,
  Entry,
  Holiday,
  TeamViewResponse,
  User,
} from '../types';

// ─── Auth ────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password }),

  register: (name: string, email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', { name, email, password }),

  getMe: () => api.get<ApiResponse<User>>('/auth/me'),

  updateProfile: (name: string) =>
    api.put<ApiResponse<User>>('/auth/profile', { name }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<ApiResponse>('/auth/change-password', { currentPassword, newPassword }),
};

// ─── Entries ─────────────────────────────────
export const entryApi = {
  getMyEntries: (startDate: string, endDate: string) =>
    api.get<ApiResponse<Entry[]>>('/entries', { params: { startDate, endDate } }),

  getTeamEntries: (month: string) =>
    api.get<ApiResponse<TeamViewResponse>>('/entries/team', { params: { month } }),

  upsertEntry: (date: string, status: 'office' | 'leave', opts?: { note?: string; startTime?: string; endTime?: string }) =>
    api.put<ApiResponse<Entry>>('/entries', { date, status, ...opts }),

  deleteEntry: (date: string) =>
    api.delete<ApiResponse>(`/entries/${date}`),

  adminUpsertEntry: (userId: string, date: string, status: 'office' | 'leave', opts?: { note?: string; startTime?: string; endTime?: string }) =>
    api.put<ApiResponse<Entry>>('/entries/admin', { userId, date, status, ...opts }),

  adminDeleteEntry: (userId: string, date: string) =>
    api.delete<ApiResponse>(`/entries/admin/${userId}/${date}`),
};

// ─── Admin Users ─────────────────────────────
export const adminApi = {
  getUsers: () => api.get<ApiResponse<User[]>>('/admin/users'),

  createUser: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post<ApiResponse<User>>('/admin/users', data),

  updateUser: (id: string, data: Partial<User>) =>
    api.put<ApiResponse<User>>(`/admin/users/${id}`, data),

  resetPassword: (id: string, password: string) =>
    api.put<ApiResponse>(`/admin/users/${id}/reset-password`, { password }),

  deleteUser: (id: string) =>
    api.delete<ApiResponse>(`/admin/users/${id}`),
};

// ─── Holidays ────────────────────────────────
export const holidayApi = {
  getHolidays: (startDate?: string, endDate?: string) =>
    api.get<ApiResponse<Holiday[]>>('/holidays', { params: { startDate, endDate } }),

  createHoliday: (date: string, name: string) =>
    api.post<ApiResponse<Holiday>>('/holidays', { date, name }),

  updateHoliday: (id: string, date: string, name: string) =>
    api.put<ApiResponse<Holiday>>(`/holidays/${id}`, { date, name }),

  deleteHoliday: (id: string) =>
    api.delete<ApiResponse>(`/holidays/${id}`),
};
