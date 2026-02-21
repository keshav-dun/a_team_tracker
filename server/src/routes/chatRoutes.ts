import { Router } from 'express';
import { chat } from '../controllers/chatController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Require authentication so only logged-in users can query the assistant
router.post('/', authenticate, chat);

export default router;
