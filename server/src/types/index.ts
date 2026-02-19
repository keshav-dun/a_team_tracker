import { Request } from 'express';
import { IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
}

export interface JwtPayload {
  userId: string;
  role: 'member' | 'admin';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

export interface EntryQuery {
  userId?: string;
  startDate: string;
  endDate: string;
}

export interface TeamViewQuery {
  month: string; // YYYY-MM
}
