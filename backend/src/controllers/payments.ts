import { Request, Response, NextFunction } from 'express';
import { verifyRazorpayPayment, processWebhook } from '../services/payments';
import { AppError } from '../middleware/error';

export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      throw new AppError('Missing order ID or payment ID parameters', 400);
    }

    const order = await verifyRazorpayPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature || ''
    );

    res.json({
      success: true,
      message: 'Payment verified and order confirmed successfully.',
      order,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';

    // Verify and process webhook payload
    await processWebhook(req.body, signature);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    // Return 200/204 to gateway to avoid retry loops even if processing has issues,
    // but log the error on the server
    console.error('[Webhook Error]:', error);
    res.status(200).json({
      success: false,
      message: 'Webhook received but error occurred during processing',
    });
  }
}
