import { Router } from 'express';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holidayController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Anyone authenticated can view holidays
router.get('/', authenticate, getHolidays);

// Only admins can manage holidays
router.post('/', authenticate, requireAdmin, createHoliday);
router.put('/:id', authenticate, requireAdmin, updateHoliday);
router.delete('/:id', authenticate, requireAdmin, deleteHoliday);

export default router;
