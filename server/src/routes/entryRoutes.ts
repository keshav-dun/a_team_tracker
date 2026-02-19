import { Router } from 'express';
import {
  upsertEntry,
  deleteEntry,
  getMyEntries,
  getTeamEntries,
  adminUpsertEntry,
  adminDeleteEntry,
} from '../controllers/entryController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Team view
router.get('/team', getTeamEntries);

// Current user's entries
router.get('/', getMyEntries);

// Set/update own entry
router.put('/', upsertEntry);

// Delete own entry (revert to WFH)
router.delete('/:date', deleteEntry);

// Admin: set/update entry for any user
router.put('/admin', requireAdmin, adminUpsertEntry);

// Admin: delete entry for any user
router.delete('/admin/:userId/:date', requireAdmin, adminDeleteEntry);

export default router;
