import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  deleteTemplate,
} from '../controllers/templateController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.delete('/:id', deleteTemplate);

export default router;
