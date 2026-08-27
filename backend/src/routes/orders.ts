import { Router } from 'express';
import {
  createOrder,
  getOrderDetails,
  cancelOrder,
  getOrderHistory,
  getTodayOrdersOwner,
  searchOrdersOwner,
  getCodPendingOrdersOwner,
  markCodDeliveredOwner,
  updateOrderStatusOwner,
  getTodayPreparationSummary,
  getTodaySalesSummary,
  cancelAllOrdersOwner,
  getOnlineOrdersOwner,
  deliverAllOnlineOrdersOwner,
} from '../controllers/orders';
import { protectOwner } from '../middleware/auth';

const router = Router();

// Public student routes
router.post('/', createOrder);
router.post('/history', getOrderHistory);
router.get('/:publicOrderId', getOrderDetails);
router.post('/:publicOrderId/cancel', cancelOrder);

// Protected owner routes
router.get('/owner/today', protectOwner, getTodayOrdersOwner);
router.get('/owner/search', protectOwner, searchOrdersOwner);
router.get('/owner/cod-pending', protectOwner, getCodPendingOrdersOwner);
router.get('/owner/online', protectOwner, getOnlineOrdersOwner);
router.post('/owner/deliver-all-online', protectOwner, deliverAllOnlineOrdersOwner);
router.patch('/owner/:id/deliver-cod', protectOwner, markCodDeliveredOwner);
router.patch('/owner/:id/status', protectOwner, updateOrderStatusOwner);
router.post('/owner/cancel-all', protectOwner, cancelAllOrdersOwner);
router.get('/owner/summary', protectOwner, getTodayPreparationSummary);
router.get('/owner/sales/today', protectOwner, getTodaySalesSummary);

export default router;
