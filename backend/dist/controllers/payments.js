"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = verifyPayment;
exports.handleWebhook = handleWebhook;
const payments_1 = require("../services/payments");
const error_1 = require("../middleware/error");
async function verifyPayment(req, res, next) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id) {
            throw new error_1.AppError('Missing order ID or payment ID parameters', 400);
        }
        const order = await (0, payments_1.verifyRazorpayPayment)(razorpay_order_id, razorpay_payment_id, razorpay_signature || '');
        res.json({
            success: true,
            message: 'Payment verified and order confirmed successfully.',
            order,
        });
    }
    catch (error) {
        next(error);
    }
}
async function handleWebhook(req, res, next) {
    try {
        const signature = req.headers['x-razorpay-signature'] || '';
        // Verify and process webhook payload
        await (0, payments_1.processWebhook)(req.body, signature);
        res.json({
            success: true,
            message: 'Webhook processed successfully',
        });
    }
    catch (error) {
        // Return 200/204 to gateway to avoid retry loops even if processing has issues,
        // but log the error on the server
        console.error('[Webhook Error]:', error);
        res.status(200).json({
            success: false,
            message: 'Webhook received but error occurred during processing',
        });
    }
}
