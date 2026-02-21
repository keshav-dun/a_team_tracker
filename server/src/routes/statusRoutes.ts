import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getTodayStatus } from '../controllers/statusController.js';

const router = Router();

// Any authenticated user can see today's status
router.get('/today', authenticate, getTodayStatus);

export default router;
