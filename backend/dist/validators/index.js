"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopStateSchema = exports.checkoutSchema = exports.orderItemSchema = exports.menuItemUpdateSchema = exports.productSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters long'),
});
exports.productSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters long').max(100),
    description: zod_1.z.string().max(250).optional().nullable(),
    defaultPrice: zod_1.z.number().positive('Price must be greater than zero'),
    defaultQuantity: zod_1.z.number().int().nonnegative('Quantity must be zero or positive'),
    isAvailable: zod_1.z.boolean().default(true),
});
exports.menuItemUpdateSchema = zod_1.z.object({
    price: zod_1.z.number().positive('Price must be greater than zero').optional(),
    availableQuantity: zod_1.z.number().int().nonnegative('Quantity must be zero or positive').optional(),
    initialQuantity: zod_1.z.number().int().nonnegative('Initial quantity must be zero or positive').optional(),
    isAvailable: zod_1.z.boolean().optional(),
});
exports.orderItemSchema = zod_1.z.object({
    menuItemId: zod_1.z.string().uuid('Invalid menu item ID'),
    quantity: zod_1.z.number().int().positive('Quantity must be at least 1'),
});
exports.checkoutSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100),
    customerPhone: zod_1.z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
    departmentClass: zod_1.z.string().min(2, 'Department/Class must be at least 2 characters').max(100).optional().nullable(),
    paymentMethod: zod_1.z.enum(['COD', 'ONLINE']),
    items: zod_1.z.array(exports.orderItemSchema).min(1, 'Order must contain at least one item'),
    idempotencyKey: zod_1.z.string().uuid('Invalid idempotency key').optional(),
});
exports.shopStateSchema = zod_1.z.object({
    manualClosed: zod_1.z.boolean().optional(),
    openingTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)').optional(),
    closingTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)').optional(),
    cancellationCutoff: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)').optional(),
});
