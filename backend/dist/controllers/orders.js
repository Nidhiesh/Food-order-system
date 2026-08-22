"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.getOrderDetails = getOrderDetails;
exports.cancelOrder = cancelOrder;
exports.getOrderHistory = getOrderHistory;
exports.getTodayOrdersOwner = getTodayOrdersOwner;
exports.getCodPendingOrdersOwner = getCodPendingOrdersOwner;
exports.markCodDeliveredOwner = markCodDeliveredOwner;
exports.updateOrderStatusOwner = updateOrderStatusOwner;
exports.getTodayPreparationSummary = getTodayPreparationSummary;
exports.getTodaySalesSummary = getTodaySalesSummary;
const client_1 = require("@prisma/client");
const crypto = __importStar(require("crypto"));
const error_1 = require("../middleware/error");
const validators_1 = require("../validators");
const shopState_1 = require("../services/shopState");
const timezone_1 = require("../utils/timezone");
const payments_1 = require("../services/payments");
const prisma = new client_1.PrismaClient();
// ==========================================
// STUDENT ENDPOINTS
// ==========================================
async function createOrder(req, res, next) {
    try {
        const shopState = await (0, shopState_1.ensureActiveBusinessDay)();
        const shopStatus = (0, timezone_1.determineShopStatus)(shopState.manualClosed, shopState.openingTime, shopState.closingTime);
        if (!shopStatus.isOpen) {
            throw new error_1.AppError(`Cannot place order: ${shopStatus.message}`, 400);
        }
        const parsed = validators_1.checkoutSchema.parse(req.body);
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
        // Use transaction to create order and deduct stock atomically
        const result = await prisma.$transaction(async (tx) => {
            let totalAmount = 0;
            const orderItemsData = [];
            for (const item of parsed.items) {
                // Fetch and lock MenuItem for update to prevent concurrent race conditions
                const menuItem = await tx.menuItem.findUnique({
                    where: { id: item.menuItemId },
                });
                if (!menuItem) {
                    throw new error_1.AppError(`Food item not found on today's menu`, 404);
                }
                if (menuItem.businessDate !== businessDate) {
                    throw new error_1.AppError(`Food item '${menuItem.name}' is not on today's menu`, 400);
                }
                if (!menuItem.isAvailable) {
                    throw new error_1.AppError(`Food item '${menuItem.name}' is sold out/unavailable`, 400);
                }
                if (menuItem.availableQuantity < item.quantity) {
                    throw new error_1.AppError(`Insufficient stock for '${menuItem.name}'. Only ${menuItem.availableQuantity} left.`, 400);
                }
                // Deduct stock atomically
                const updatedMenuItem = await tx.menuItem.update({
                    where: { id: menuItem.id },
                    data: {
                        availableQuantity: {
                            decrement: item.quantity,
                        },
                    },
                });
                // Fail-safe check
                if (updatedMenuItem.availableQuantity < 0) {
                    throw new error_1.AppError(`Stock for '${menuItem.name}' was depleted by a concurrent order`, 400);
                }
                const subtotal = menuItem.price * item.quantity;
                totalAmount += subtotal;
                orderItemsData.push({
                    menuItemId: menuItem.id,
                    name: menuItem.name,
                    unitPrice: menuItem.price,
                    quantity: item.quantity,
                    subtotal,
                });
            }
            // Generate public Order ID and tracking token
            const randomDigits = Math.floor(100000 + Math.random() * 900000);
            const publicOrderId = `ORD-${businessDate.replace(/-/g, '')}-${randomDigits}`;
            const trackingToken = crypto.randomBytes(32).toString('hex');
            // Determine initial statuses
            let orderStatus = 'CONFIRMED';
            let paymentStatus = 'PENDING';
            if (parsed.paymentMethod === 'ONLINE') {
                orderStatus = 'PENDING_PAYMENT';
                paymentStatus = 'PENDING';
            }
            // Create main Order
            const newOrder = await tx.order.create({
                data: {
                    publicOrderId,
                    businessDate,
                    customerName: parsed.customerName,
                    customerPhone: parsed.customerPhone,
                    departmentClass: parsed.departmentClass,
                    totalAmount,
                    paymentMethod: parsed.paymentMethod,
                    paymentStatus,
                    orderStatus,
                    trackingToken,
                    items: {
                        create: orderItemsData,
                    },
                },
                include: {
                    items: true,
                },
            });
            // Handle Online Payment initialization
            let rzpOrder = null;
            if (parsed.paymentMethod === 'ONLINE') {
                rzpOrder = await (0, payments_1.createRazorpayOrder)(newOrder.id, totalAmount, tx);
            }
            return {
                order: newOrder,
                razorpayOrder: rzpOrder,
            };
        });
        res.status(201).json({
            success: true,
            message: 'Order initialized successfully',
            orderId: result.order.id,
            publicOrderId: result.order.publicOrderId,
            trackingToken: result.order.trackingToken,
            paymentMethod: result.order.paymentMethod,
            totalAmount: result.order.totalAmount,
            razorpayOrder: result.razorpayOrder,
        });
    }
    catch (error) {
        next(error);
    }
}
async function getOrderDetails(req, res, next) {
    try {
        const { publicOrderId } = req.params;
        const { token } = req.query;
        if (!token) {
            throw new error_1.AppError('Order tracking token is required', 400);
        }
        const order = await prisma.order.findUnique({
            where: { publicOrderId },
            include: {
                items: true,
                payment: {
                    select: { gatewayOrderId: true, gatewayPaymentId: true, status: true },
                },
            },
        });
        // Check token mismatch to prevent listing other people's orders
        if (!order || order.trackingToken !== token) {
            throw new error_1.AppError('Order not found or invalid access token', 404);
        }
        res.json({
            success: true,
            order,
        });
    }
    catch (error) {
        next(error);
    }
}
async function cancelOrder(req, res, next) {
    try {
        const { publicOrderId } = req.params;
        const { token } = req.query;
        const { reason } = req.body;
        if (!token) {
            throw new error_1.AppError('Order tracking token is required', 400);
        }
        await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { publicOrderId },
                include: { items: true },
            });
            if (!order || order.trackingToken !== token) {
                throw new error_1.AppError('Order not found or invalid access token', 404);
            }
            // Check if order belongs to current business day and is cancellable
            const currentBusinessDate = (0, timezone_1.getKolkataBusinessDate)();
            if (order.businessDate !== currentBusinessDate) {
                throw new error_1.AppError('Cannot cancel orders from previous operational days.', 400);
            }
            // Retrieve shop cancellation configurations
            const shopState = await tx.shopState.findUnique({
                where: { businessDate: currentBusinessDate },
            });
            if (shopState) {
                const time = (0, timezone_1.getKolkataTime)();
                const [cutoffHour, cutoffMin] = shopState.cancellationCutoff.split(':').map(Number);
                const currentMinutes = time.getHours() * 60 + time.getMinutes();
                const cutoffMinutes = cutoffHour * 60 + cutoffMin;
                if (currentMinutes >= cutoffMinutes) {
                    throw new error_1.AppError('Cancellation cut-off time has passed for today.', 400);
                }
            }
            // Enforce status limits: only PENDING_PAYMENT or CONFIRMED orders are cancellable
            if (order.orderStatus !== 'PENDING_PAYMENT' && order.orderStatus !== 'CONFIRMED') {
                throw new error_1.AppError(`Cannot cancel order. Current status is already '${order.orderStatus}'`, 400);
            }
            // Update Order Status to CANCELLED
            await tx.order.update({
                where: { id: order.id },
                data: {
                    orderStatus: 'CANCELLED',
                    cancellationReason: reason || 'Cancelled by customer',
                    cancelledAt: new Date(),
                },
            });
            // Restore MenuItem stock quantities
            for (const item of order.items) {
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
        });
        res.json({
            success: true,
            message: 'Order cancelled successfully and stock restored.',
        });
    }
    catch (error) {
        next(error);
    }
}
async function getOrderHistory(req, res, next) {
    try {
        const { tokens } = req.body;
        if (!tokens || !Array.isArray(tokens)) {
            throw new error_1.AppError('Invalid tokens payload', 400);
        }
        const orders = await prisma.order.findMany({
            where: {
                trackingToken: { in: tokens },
            },
            include: {
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            orders,
        });
    }
    catch (error) {
        next(error);
    }
}
// ==========================================
// OWNER ENDPOINTS
// ==========================================
async function getTodayOrdersOwner(req, res, next) {
    try {
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
        const orders = await prisma.order.findMany({
            where: { businessDate },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            businessDate,
            orders,
        });
    }
    catch (error) {
        next(error);
    }
}
async function getCodPendingOrdersOwner(req, res, next) {
    try {
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
        const orders = await prisma.order.findMany({
            where: {
                businessDate,
                paymentMethod: 'COD',
                orderStatus: {
                    in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
                },
            },
            include: { items: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json({
            success: true,
            orders,
        });
    }
    catch (error) {
        next(error);
    }
}
async function markCodDeliveredOwner(req, res, next) {
    try {
        const { id } = req.params;
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id },
            });
            if (!order) {
                throw new error_1.AppError('Order not found', 404);
            }
            if (order.paymentMethod !== 'COD') {
                throw new error_1.AppError('Order is not a Cash on Delivery order', 400);
            }
            if (order.orderStatus === 'DELIVERED') {
                throw new error_1.AppError('Order is already marked delivered', 400);
            }
            if (order.orderStatus === 'CANCELLED') {
                throw new error_1.AppError('Cannot deliver a cancelled order', 400);
            }
            const updated = await tx.order.update({
                where: { id },
                data: {
                    orderStatus: 'DELIVERED',
                    paymentStatus: 'PAID',
                    deliveredAt: new Date(),
                },
            });
            return updated;
        });
        res.json({
            success: true,
            message: 'COD order marked as delivered.',
            order: result,
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateOrderStatusOwner(req, res, next) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'];
        if (!validStatuses.includes(status)) {
            throw new error_1.AppError('Invalid order status value', 400);
        }
        const updated = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id },
                include: { items: true },
            });
            if (!order) {
                throw new error_1.AppError('Order not found', 404);
            }
            if (order.orderStatus === status) {
                return order;
            }
            // Enforce status machine flows
            if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED') {
                throw new error_1.AppError(`Cannot change status of a completed/cancelled order (${order.orderStatus})`, 400);
            }
            // If transitioning to CANCELLED, restore stock quantities
            if (status === 'CANCELLED') {
                for (const item of order.items) {
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
            }
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    orderStatus: status,
                    ...(status === 'DELIVERED' ? { deliveredAt: new Date(), paymentStatus: 'PAID' } : {}),
                    ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
                },
            });
            return updatedOrder;
        });
        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            order: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
async function getTodayPreparationSummary(req, res, next) {
    try {
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
        // Fetch all active/valid today's orders
        const orders = await prisma.order.findMany({
            where: {
                businessDate,
                orderStatus: {
                    notIn: ['CANCELLED', 'PAYMENT_FAILED', 'PENDING_PAYMENT'],
                },
            },
            include: { items: true },
        });
        // Aggregate quantities
        const summary = {};
        for (const order of orders) {
            for (const item of order.items) {
                if (!summary[item.name]) {
                    summary[item.name] = { name: item.name, quantity: 0 };
                }
                summary[item.name].quantity += item.quantity;
            }
        }
        res.json({
            success: true,
            businessDate,
            summary: Object.values(summary),
        });
    }
    catch (error) {
        next(error);
    }
}
async function getTodaySalesSummary(req, res, next) {
    try {
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
        // Fetch all orders for today
        const orders = await prisma.order.findMany({
            where: { businessDate },
        });
        const confirmedCount = orders.filter(o => !['CANCELLED', 'PAYMENT_FAILED', 'PENDING_PAYMENT'].includes(o.orderStatus)).length;
        const cancelledCount = orders.filter(o => o.orderStatus === 'CANCELLED').length;
        // Paid sales (Paid online or COD marked delivered)
        const paidOrders = orders.filter(o => o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED');
        const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const codSales = paidOrders.filter(o => o.paymentMethod === 'COD').reduce((sum, o) => sum + o.totalAmount, 0);
        const onlineSales = paidOrders.filter(o => o.paymentMethod === 'ONLINE').reduce((sum, o) => sum + o.totalAmount, 0);
        res.json({
            success: true,
            businessDate,
            summary: {
                totalOrders: orders.length,
                confirmedOrders: confirmedCount,
                cancelledOrders: cancelledCount,
                totalSales,
                codSales,
                onlineSales,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
