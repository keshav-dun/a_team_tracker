import { Router } from 'express';
import { matchPreview, matchApply } from '../controllers/scheduleController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Match preview
router.post('/match-preview', matchPreview);

// Match apply
router.post('/match-apply', matchApply);

export default router;
