import { Router } from 'express';
import {
  getPublicStatus,
  getOwnerStatus,
  closeShop,
  openShop,
  updateConfig
} from '../controllers/shop';
import { protectOwner } from '../middleware/auth';

const router = Router();

// Public route to check shop status
router.get('/status', getPublicStatus);

// Protected owner routes
router.get('/owner/status', protectOwner, getOwnerStatus);
router.post('/owner/close', protectOwner, closeShop);
router.post('/owner/open', protectOwner, openShop);
router.patch('/owner/config', protectOwner, updateConfig);

export default router;
