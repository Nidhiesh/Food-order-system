import { Router } from 'express';
import { verifyPayment, handleWebhook } from '../controllers/payments';

const router = Router();

// Public routes for payment gateway callbacks
router.post('/verify', verifyPayment);
router.post('/webhook', handleWebhook);

export default router;
