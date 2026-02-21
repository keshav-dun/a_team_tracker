import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Entry from '../models/Entry.js';
import { AuthRequest } from '../types/index.js';

/**
 * Get all users (admin only) with pagination.
 * GET /api/admin/users?page=1&limit=20
 */
export const getAllUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const MAX_LIMIT = 100;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().sort({ name: 1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create a new user (admin only).
 * POST /api/admin/users
 */
export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    const user = await User.create({ name, email, password, role: role || 'member' });
    res.status(201).json({ success: true, data: user.toJSON() });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Update a user (admin only).
 * PUT /api/admin/users/:id
 */
export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Reset a user's password (admin only).
 * PUT /api/admin/users/:id/reset-password
 */
export const resetUserPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
      return;
    }

    const user = await User.findById(id).select('+password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    user.password = password;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Delete a user and their entries (admin only).
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user!._id.toString() === id) {
      await session.endSession();
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
      return;
    }

    await session.startTransaction();

    const user = await User.findByIdAndDelete(id, { session });
    if (!user) {
      await session.abortTransaction();
      await session.endSession();
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Remove all entries for this user
    await Entry.deleteMany({ userId: id }, { session });

    await session.commitTransaction();
    await session.endSession();

    res.json({ success: true, message: 'User and their entries deleted' });
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};
