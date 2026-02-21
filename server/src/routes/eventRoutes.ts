import { Router } from 'express';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  validateCreateEvent,
  validateUpdateEvent,
} from '../middleware/eventValidation.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Any user can view events
router.get('/', getEvents);

// Admin-only: create, update, delete
router.post('/', requireAdmin, validateCreateEvent, createEvent);
router.put('/:id', requireAdmin, validateUpdateEvent, updateEvent);
router.delete('/:id', requireAdmin, deleteEvent);

export default router;
