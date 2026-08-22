"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orders_1 = require("../controllers/orders");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public student routes
router.post('/', orders_1.createOrder);
router.post('/history', orders_1.getOrderHistory);
router.get('/:publicOrderId', orders_1.getOrderDetails);
router.post('/:publicOrderId/cancel', orders_1.cancelOrder);
// Protected owner routes
router.get('/owner/today', auth_1.protectOwner, orders_1.getTodayOrdersOwner);
router.get('/owner/cod-pending', auth_1.protectOwner, orders_1.getCodPendingOrdersOwner);
router.patch('/owner/:id/deliver-cod', auth_1.protectOwner, orders_1.markCodDeliveredOwner);
router.patch('/owner/:id/status', auth_1.protectOwner, orders_1.updateOrderStatusOwner);
router.get('/owner/summary', auth_1.protectOwner, orders_1.getTodayPreparationSummary);
router.get('/owner/sales/today', auth_1.protectOwner, orders_1.getTodaySalesSummary);
exports.default = router;
