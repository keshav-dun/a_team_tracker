import { Router } from 'express';
import { getMyPercentage, chatQuery } from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

// Personal office percentage for My Calendar banner
router.get('/my-percentage', getMyPercentage);

// Unified chat data query handler (called by chatbot for data-aware queries)
router.post('/chat-query', chatQuery);

export default router;
