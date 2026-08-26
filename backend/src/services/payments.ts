import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error';

const prisma = new PrismaClient();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';

// Dynamically import Razorpay package to prevent startup crashes if it behaves weirdly in some node setups.
// Since it's in package.json, we can import it.
import Razorpay = require('razorpay');

let razorpayInstance: Razorpay | null = null;
const isMockMode = RAZORPAY_KEY_ID === 'rzp_test_mock' || RAZORPAY_KEY_SECRET === 'mock_secret';

if (!isMockMode) {
  try {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (error) {
    console.error('Failed to initialize Razorpay SDK. Falling back to Mock Mode.', error);
    razorpayInstance = null;
  }
} else {
  console.log('[Payments] Running in Mock Sandbox Mode (Test Keys detected).');
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  currency: string;
  receipt?: string;
  status: string;
  attempts: number;
  notes?: any;
  created_at: number;
  isMock: boolean;
}

/**
 * Creates a payment order via Razorpay or returns a Mock Order in Sandbox mode.
 */
export async function createRazorpayOrder(
  orderId: string,
  amount: number,
  tx: any // Prisma transaction context
): Promise<RazorpayOrderResponse> {
  const amountInPaise = Math.round(amount * 100);

  if (isMockMode || !razorpayInstance) {
    const mockOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    
    // Save payment log in database
    await tx.payment.create({
      data: {
        orderId,
        gateway: 'RAZORPAY_MOCK',
        gatewayOrderId: mockOrderId,
        gatewayPaymentId: 'pay_mock_success',
        signature: 'mock_sig_hash_validated_locally',
        amount,
        status: 'PAID',
      },
    });

    return {
      id: mockOrderId,
      entity: 'order',
      amount: amountInPaise,
      amount_paid: amountInPaise,
      amount_due: 0,
      currency: 'INR',
      receipt: orderId,
      status: 'paid',
      attempts: 1,
      notes: {},
      created_at: Math.floor(Date.now() / 1000),
      isMock: true,
    };
  }

  try {
    const response = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: orderId,
    });

    // Save payment log in database
    await tx.payment.create({
      data: {
        orderId,
        gateway: 'RAZORPAY',
        gatewayOrderId: response.id,
        amount,
        status: 'PENDING',
      },
    });

    return {
      ...response,
      isMock: false,
    };
  } catch (error: any) {
    console.error('Razorpay Order Creation Error:', error);
    throw new AppError(`Payment gateway error: ${error.description || error.message || 'Failed to initialize order.'}`, 500);
  }
}

/**
 * Verifies Razorpay signature and marks the order as paid.
 */
export async function verifyRazorpayPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Payment and associated Order
    const payment = await tx.payment.findUnique({
      where: { gatewayOrderId: razorpayOrderId },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError('Payment record not found for this gateway order', 404);
    }

    if (payment.status === 'PAID') {
      return payment.order; // Already processed
    }

    // 2. Perform Signature Verification
    if (payment.gateway === 'RAZORPAY_MOCK') {
      // Mock Sandbox validation rule
      if (razorpayPaymentId === 'pay_mock_cancel') {
        throw new AppError('Mock payment was cancelled.', 400);
      }
    } else {
      // Real signature verification
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        // Mark payment & order failed
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            orderStatus: 'PAYMENT_FAILED',
            paymentStatus: 'FAILED',
          },
        });

        // Restore MenuItem stock quantities (Disabled for unlimited stock count)
        /*
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: payment.orderId },
        });
        for (const item of orderItems) {
          if (item.menuItemId) {
            await tx.menuItem.update({
              where: { id: item.menuItemId },
              data: {
                availableQuantity: {
                  increment: item.quantity,
                },
              },
            });
          }
        }
        */

        throw new AppError('Payment signature verification failed. Tampering detected.', 400);
      }
    }

    // 3. Mark payment and order as successful
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        gatewayPaymentId: razorpayPaymentId,
        signature: razorpaySignature || 'MOCK_SIGNATURE',
        amount: payment.order.totalAmount, // update payment amount to match the new total order amount
      },
    });

    const updatedOrder = await tx.order.update({
      where: { id: payment.orderId },
      data: {
        orderStatus: payment.order.orderStatus === 'PENDING_PAYMENT' ? 'CONFIRMED' : payment.order.orderStatus,
        paymentStatus: 'PAID',
      },
    });

    return updatedOrder;
  });
}

/**
 * Handles incoming webhooks securely.
 */
export async function processWebhook(payload: any, signature: string) {
  // Verify webhook signature (skip if in mock mode and no signature provided)
  if (!isMockMode) {
    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expectedSig !== signature) {
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  const event = payload.event;
  if (event === 'order.paid' || event === 'payment.captured') {
    const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;
    const razorpaySignature = signature; // Razorpay webhooks don't send signature in body

    if (razorpayOrderId && razorpayPaymentId) {
      console.log(`[Webhook] Processing paid event for Order ID: ${razorpayOrderId}`);
      await verifyRazorpayPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    }
  }
}
