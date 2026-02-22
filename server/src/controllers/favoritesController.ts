import { Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { AuthRequest } from '../types/index.js';

/**
 * Toggle a user as favorite.
 * POST /api/users/favorites/:userId
 * If userId not in favorites → add. If already in favorites → remove.
 */
export const toggleFavorite = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!._id;

    // Cannot favorite self
    if (userId === currentUserId.toString()) {
      res.status(400).json({ success: false, message: 'Cannot favorite yourself' });
      return;
    }

    // Validate ObjectId
    if (!mongoose.isValidObjectId(userId)) {
      res.status(400).json({ success: false, message: 'Invalid user ID' });
      return;
    }

    // Validate target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser || !targetUser.isActive) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      res.status(404).json({ success: false, message: 'Current user not found' });
      return;
    }

    const targetObjId = new mongoose.Types.ObjectId(userId);
    const isFavorited = currentUser.favorites.some(
      (fav) => fav.toString() === userId
    );

    if (isFavorited) {
      // Remove from favorites
      currentUser.favorites = currentUser.favorites.filter(
        (fav) => fav.toString() !== userId
      );
    } else {
      // Add to favorites
      currentUser.favorites.push(targetObjId);
    }

    await currentUser.save();

    res.json({
      success: true,
      data: {
        favorites: currentUser.favorites,
        action: isFavorited ? 'removed' : 'added',
      },
    });
  } catch (error: any) {
    console.error('toggleFavorite error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle favorite' });
  }
};

/**
 * Get current user's favorites list with minimal data.
 * GET /api/users/favorites
 */
export const getFavorites = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const currentUser = await User.findById(req.user!._id).populate(
      'favorites',
      '_id name email'
    );

    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: currentUser.favorites,
    });
  } catch (error: any) {
    console.error('getFavorites error:', error);
    res.status(500).json({ success: false, message: 'Failed to get favorites' });
  }
};
