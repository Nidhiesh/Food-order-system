import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { AppError } from '../middleware/error';
import { checkoutSchema } from '../validators';
import { ensureActiveBusinessDay } from '../services/shopState';
import { determineShopStatus, getKolkataBusinessDate, getKolkataTime } from '../utils/timezone';
import { createRazorpayOrder } from '../services/payments';

const prisma = new PrismaClient();

// ==========================================
// STUDENT ENDPOINTS
// ==========================================

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const shopState = await ensureActiveBusinessDay();
    const shopStatus = determineShopStatus(shopState.manualClosed, shopState.openingTime, shopState.closingTime);

    if (!shopStatus.isOpen) {
      throw new AppError(`Cannot place order: ${shopStatus.message}`, 400);
    }

    const parsed = checkoutSchema.parse(req.body);
    const businessDate = getKolkataBusinessDate();

    // Use transaction to create order and deduct stock atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if there is an existing active order for this business date with the same customer name and phone
      const existingOrder = await tx.order.findFirst({
        where: {
          businessDate,
          customerName: parsed.customerName,
          customerPhone: parsed.customerPhone,
          orderStatus: {
            in: ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING'],
          },
        },
        include: {
          items: true,
          payment: true,
        },
      });

      if (existingOrder) {
        let additionalAmount = 0;
        const itemsToUpdate = [];
        const itemsToCreate = [];

        for (const item of parsed.items) {
          const menuItem = await tx.menuItem.findUnique({
            where: { id: item.menuItemId },
          });

          if (!menuItem) {
            throw new AppError(`Food item not found on today's menu`, 404);
          }

          if (menuItem.businessDate !== businessDate) {
            throw new AppError(`Food item '${menuItem.name}' is not on today's menu`, 400);
          }

          if (!menuItem.isAvailable) {
            throw new AppError(`Food item '${menuItem.name}' is sold out/unavailable`, 400);
          }

          const subtotal = menuItem.price * item.quantity;
          additionalAmount += subtotal;

          const existingItem = existingOrder.items.find(
            (i) => i.menuItemId === menuItem.id
          );

          if (existingItem) {
            itemsToUpdate.push({
              id: existingItem.id,
              quantity: existingItem.quantity + item.quantity,
              subtotal: existingItem.subtotal + subtotal,
            });
          } else {
            itemsToCreate.push({
              menuItemId: menuItem.id,
              name: menuItem.name,
              unitPrice: menuItem.price,
              quantity: item.quantity,
              subtotal,
            });
          }
        }

        // Apply updates and creations for items
        for (const item of itemsToUpdate) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              quantity: item.quantity,
              subtotal: item.subtotal,
            },
          });
        }

        if (itemsToCreate.length > 0) {
          await tx.orderItem.createMany({
            data: itemsToCreate.map((item) => ({
              orderId: existingOrder.id,
              menuItemId: item.menuItemId,
              name: item.name,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              subtotal: item.subtotal,
            })),
          });
        }

        const newTotalAmount = existingOrder.totalAmount + additionalAmount;

        let orderStatus = existingOrder.orderStatus;
        let paymentStatus = existingOrder.paymentStatus;
        let paymentMethod = existingOrder.paymentMethod;
        let rzpOrder = null;

        if (parsed.paymentMethod === 'ONLINE') {
          if (existingOrder.payment) {
            await tx.payment.delete({
              where: { orderId: existingOrder.id },
            });
          }
          rzpOrder = await createRazorpayOrder(existingOrder.id, additionalAmount, tx);

          orderStatus = 'PENDING_PAYMENT';
          paymentStatus = 'PENDING';
          paymentMethod = 'ONLINE';
        } else {
          paymentMethod = 'COD';
          paymentStatus = 'PENDING';
          if (existingOrder.payment && existingOrder.payment.status === 'PENDING') {
            await tx.payment.delete({
              where: { orderId: existingOrder.id },
            });
          }
          orderStatus = 'CONFIRMED';
        }

        const updatedOrder = await tx.order.update({
          where: { id: existingOrder.id },
          data: {
            totalAmount: newTotalAmount,
            paymentMethod,
            paymentStatus,
            orderStatus,
          },
          include: {
            items: true,
          },
        });

        return {
          order: updatedOrder,
          razorpayOrder: rzpOrder,
        };
      } else {
        let totalAmount = 0;
        const orderItemsData = [];

        for (const item of parsed.items) {
          // Fetch and lock MenuItem for update to prevent concurrent race conditions
          const menuItem = await tx.menuItem.findUnique({
            where: { id: item.menuItemId },
          });

          if (!menuItem) {
            throw new AppError(`Food item not found on today's menu`, 404);
          }

          if (menuItem.businessDate !== businessDate) {
            throw new AppError(`Food item '${menuItem.name}' is not on today's menu`, 400);
          }

          if (!menuItem.isAvailable) {
            throw new AppError(`Food item '${menuItem.name}' is sold out/unavailable`, 400);
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
          rzpOrder = await createRazorpayOrder(newOrder.id, totalAmount, tx);
        }

        return {
          order: newOrder,
          razorpayOrder: rzpOrder,
        };
      }
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
  } catch (error) {
    next(error);
  }
}

export async function getOrderDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { publicOrderId } = req.params;
    const { token } = req.query;

    if (!token) {
      throw new AppError('Order tracking token is required', 400);
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
      throw new AppError('Order not found or invalid access token', 404);
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { publicOrderId } = req.params;
    const { token } = req.query;
    const { reason } = req.body;

    if (!token) {
      throw new AppError('Order tracking token is required', 400);
    }

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { publicOrderId },
        include: { items: true },
      });

      if (!order || order.trackingToken !== token) {
        throw new AppError('Order not found or invalid access token', 404);
      }

      // Check if order belongs to current business day and is cancellable
      const currentBusinessDate = getKolkataBusinessDate();
      if (order.businessDate !== currentBusinessDate) {
        throw new AppError('Cannot cancel orders from previous operational days.', 400);
      }

      // Retrieve shop cancellation configurations
      const shopState = await tx.shopState.findUnique({
        where: { businessDate: currentBusinessDate },
      });

      if (shopState) {
        const time = getKolkataTime();
        const [cutoffHour, cutoffMin] = shopState.cancellationCutoff.split(':').map(Number);
        const currentMinutes = time.getHours() * 60 + time.getMinutes();
        const cutoffMinutes = cutoffHour * 60 + cutoffMin;

        if (currentMinutes >= cutoffMinutes) {
          throw new AppError('Cancellation cut-off time has passed for today.', 400);
        }
      }

      // Enforce status limits: only PENDING_PAYMENT or CONFIRMED orders are cancellable
      if (order.orderStatus !== 'PENDING_PAYMENT' && order.orderStatus !== 'CONFIRMED') {
        throw new AppError(`Cannot cancel order. Current status is already '${order.orderStatus}'`, 400);
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

      // Restore MenuItem stock quantities (Disabled for unlimited stock count)
      /*
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
      */
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully and stock restored.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { tokens } = req.body;

    if (!tokens || !Array.isArray(tokens)) {
      throw new AppError('Invalid tokens payload', 400);
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
  } catch (error) {
    next(error);
  }
}

// ==========================================
// OWNER ENDPOINTS
// ==========================================

export async function getTodayOrdersOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const businessDate = getKolkataBusinessDate();
    const orders = await prisma.order.findMany({
      where: { businessDate },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });

    const ordersWithIndicators = await Promise.all(
      orders.map(async (order) => {
        const otherOrdersCount = await prisma.order.count({
          where: {
            businessDate,
            customerPhone: order.customerPhone,
            id: { not: order.id },
          },
        });
        return {
          ...order,
          hasOtherOrdersToday: otherOrdersCount > 0,
        };
      })
    );

    res.json({
      success: true,
      businessDate,
      orders: ordersWithIndicators,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCodPendingOrdersOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const businessDate = getKolkataBusinessDate();
    const orders = await prisma.order.findMany({
      where: {
        businessDate,
        paymentMethod: 'COD',
        orderStatus: {
          in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
        },
      },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'asc' },
    });

    const ordersWithIndicators = await Promise.all(
      orders.map(async (order) => {
        const otherOrdersCount = await prisma.order.count({
          where: {
            businessDate,
            customerPhone: order.customerPhone,
            id: { not: order.id },
          },
        });
        return {
          ...order,
          hasOtherOrdersToday: otherOrdersCount > 0,
        };
      })
    );

    res.json({
      success: true,
      orders: ordersWithIndicators,
    });
  } catch (error) {
    next(error);
  }
}

export async function markCodDeliveredOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { payment: true },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      if (order.paymentMethod !== 'COD') {
        throw new AppError('Order is not a Cash on Delivery order', 400);
      }

      if (order.orderStatus === 'DELIVERED') {
        throw new AppError('Order is already marked delivered', 400);
      }

      if (order.orderStatus === 'CANCELLED') {
        throw new AppError('Cannot deliver a cancelled order', 400);
      }

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            amount: order.totalAmount,
          },
        });
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
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatusOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid order status value', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      if (order.orderStatus === status) {
        return order;
      }

      // Enforce status machine flows
      if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED') {
        throw new AppError(`Cannot change status of a completed/cancelled order (${order.orderStatus})`, 400);
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
  } catch (error) {
    next(error);
  }
}

export async function getTodayPreparationSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const businessDate = getKolkataBusinessDate();
    
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
    const summary: Record<string, { name: string; quantity: number }> = {};
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
  } catch (error) {
    next(error);
  }
}

export async function getTodaySalesSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const businessDate = getKolkataBusinessDate();

    // Fetch all orders for today with payments
    const orders = await prisma.order.findMany({
      where: { businessDate },
      include: { payment: true },
    });

    const confirmedCount = orders.filter(o => !['CANCELLED', 'PAYMENT_FAILED', 'PENDING_PAYMENT'].includes(o.orderStatus)).length;
    const cancelledCount = orders.filter(o => o.orderStatus === 'CANCELLED').length;
    
    // Paid sales (Paid online or COD marked delivered)
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED');
    const totalSales = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    let codSales = 0;
    let onlineSales = 0;

    for (const o of paidOrders) {
      if (o.paymentMethod === 'ONLINE') {
        onlineSales += o.totalAmount;
      } else {
        if (o.payment && o.payment.status === 'PAID') {
          onlineSales += o.payment.amount;
          codSales += Math.max(0, o.totalAmount - o.payment.amount);
        } else {
          codSales += o.totalAmount;
        }
      }
    }

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
  } catch (error) {
    next(error);
  }
}
