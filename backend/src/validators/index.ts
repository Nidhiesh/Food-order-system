import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long').max(100),
  description: z.string().max(250).optional().nullable(),
  defaultPrice: z.number().positive('Price must be greater than zero'),
  defaultQuantity: z.number().int().nonnegative('Quantity must be zero or positive'),
  isAvailable: z.boolean().default(true),
});

export const menuItemUpdateSchema = z.object({
  price: z.number().positive('Price must be greater than zero').optional(),
  availableQuantity: z.number().int().nonnegative('Quantity must be zero or positive').optional(),
  initialQuantity: z.number().int().nonnegative('Initial quantity must be zero or positive').optional(),
  isAvailable: z.boolean().optional(),
});

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
  departmentClass: z.string().min(2, 'Department/Class must be at least 2 characters').max(100).optional().nullable(),
  paymentMethod: z.enum(['COD', 'ONLINE']),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  idempotencyKey: z.string().uuid('Invalid idempotency key').optional(),
});

export const shopStateSchema = z.object({
  manualClosed: z.boolean().optional(),
  openingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)').optional(),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)').optional(),
  cancellationCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format (HH:MM)').optional(),
});
