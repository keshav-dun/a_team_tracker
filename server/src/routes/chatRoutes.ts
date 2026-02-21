import { Router } from 'express';
import { chat } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Require authentication so only logged-in users can query the assistant
router.post('/', authenticate, chat);

export default router;
