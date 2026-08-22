import { Router } from 'express';
import {
  getTodayMenuPublic,
  getCatalog,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  getTodayMenuOwner,
  updateTodayMenuItem
} from '../controllers/menu';
import { protectOwner } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/today', getTodayMenuPublic);

// Owner protected routes
router.get('/owner/catalog', protectOwner, getCatalog);
router.post('/owner/catalog', protectOwner, createCatalogItem);
router.patch('/owner/catalog/:id', protectOwner, updateCatalogItem);
router.delete('/owner/catalog/:id', protectOwner, deleteCatalogItem);

router.get('/owner/today', protectOwner, getTodayMenuOwner);
router.patch('/owner/today/:id', protectOwner, updateTodayMenuItem);

export default router;
