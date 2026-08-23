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

function groupActiveOrders(orders: any[], businessDate: string) {
  const groupedOrders: any[] = [];
  const activeGroups: Record<string, any[]> = {};
  
  for (const order of orders) {
    const isPrepActive = ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING'].includes(order.orderStatus);
    
    if (isPrepActive) {
      const key = `${order.customerName.trim().toLowerCase()}_${order.customerPhone.trim()}`;
      if (!activeGroups[key]) {
        activeGroups[key] = [];
      }
      activeGroups[key].push(order);
    } else {
      groupedOrders.push({
        ...order,
        mergedOrderIds: [order.id],
        isGrouped: false,
      });
    }
  }

  for (const key of Object.keys(activeGroups)) {
    const group = activeGroups[key];
    if (group.length === 1) {
      groupedOrders.push({
        ...group[0],
        mergedOrderIds: [group[0].id],
        isGrouped: false,
      });
      continue;
    }

    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const primary = group[0];

    const itemMap: Record<string, any> = {};

    for (const order of group) {
      for (const item of order.items) {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            id: item.id,
            orderId: primary.id,
            menuItemId: item.menuItemId,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: 0,
            subtotal: 0,
          };
        }
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].subtotal += item.subtotal;
      }
    }

    const totalAmount = group.reduce((sum, o) => sum + o.totalAmount, 0);

    let totalOnlinePaidAmount = 0;
    for (const o of group) {
      if (o.payment && o.payment.status === 'PAID') {
        totalOnlinePaidAmount += o.payment.amount;
      }
    }

    let orderStatus = 'PENDING_PAYMENT';
    if (group.some(o => o.orderStatus === 'CONFIRMED')) {
      orderStatus = 'CONFIRMED';
    } else if (group.some(o => o.orderStatus === 'PREPARING')) {
      orderStatus = 'PREPARING';
    }

    const hasCod = group.some(o => o.paymentMethod === 'COD');
    const paymentMethod = (hasCod || totalAmount > totalOnlinePaidAmount) ? 'COD' : 'ONLINE';
    const paymentStatus = totalOnlinePaidAmount >= totalAmount ? 'PAID' : 'PENDING';

    let payment = null;
    if (totalOnlinePaidAmount > 0) {
      payment = {
        id: 'virtual-payment-' + primary.id,
        orderId: primary.id,
        gateway: 'RAZORPAY',
        gatewayOrderId: 'virtual-gateway-' + primary.id,
        amount: totalOnlinePaidAmount,
        status: 'PAID',
        createdAt: primary.createdAt,
        updatedAt: primary.updatedAt,
      };
    }

    const virtualOrder = {
      ...primary,
      items: Object.values(itemMap),
      totalAmount,
      orderStatus,
      paymentMethod,
      paymentStatus,
      payment,
      mergedOrderIds: group.map(o => o.id),
      isGrouped: true,
    };

    groupedOrders.push(virtualOrder);
  }

  // Sort overall by createdAt descending to match expectations
  groupedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return groupedOrders;
}

function groupCodPendingOrders(orders: any[], businessDate: string) {
  const groupedOrders: any[] = [];
  const groups: Record<string, any[]> = {};

  for (const order of orders) {
    const key = `${order.customerName.trim().toLowerCase()}_${order.customerPhone.trim()}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(order);
  }

  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (group.length === 1) {
      groupedOrders.push({
        ...group[0],
        mergedOrderIds: [group[0].id],
        isGrouped: false,
      });
      continue;
    }

    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const primary = group[0];

    const itemMap: Record<string, any> = {};
    for (const order of group) {
      for (const item of order.items) {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            id: item.id,
            orderId: primary.id,
            menuItemId: item.menuItemId,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: 0,
            subtotal: 0,
          };
        }
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].subtotal += item.subtotal;
      }
    }

    const totalAmount = group.reduce((sum, o) => sum + o.totalAmount, 0);

    let totalOnlinePaidAmount = 0;
    for (const o of group) {
      if (o.payment && o.payment.status === 'PAID') {
        totalOnlinePaidAmount += o.payment.amount;
      }
    }

    let orderStatus = primary.orderStatus;
    const statuses = group.map(o => o.orderStatus);
    if (statuses.includes('CONFIRMED')) {
      orderStatus = 'CONFIRMED';
    } else if (statuses.includes('PREPARING')) {
      orderStatus = 'PREPARING';
    } else if (statuses.includes('READY')) {
      orderStatus = 'READY';
    } else if (statuses.includes('OUT_FOR_DELIVERY')) {
      orderStatus = 'OUT_FOR_DELIVERY';
    }

    let payment = null;
    if (totalOnlinePaidAmount > 0) {
      payment = {
        id: 'virtual-payment-' + primary.id,
        orderId: primary.id,
        gateway: 'RAZORPAY',
        gatewayOrderId: 'virtual-gateway-' + primary.id,
        amount: totalOnlinePaidAmount,
        status: 'PAID',
        createdAt: primary.createdAt,
        updatedAt: primary.updatedAt,
      };
    }

    const virtualOrder = {
      ...primary,
      items: Object.values(itemMap),
      totalAmount,
      orderStatus,
      payment,
      mergedOrderIds: group.map(o => o.id),
      isGrouped: true,
    };

    groupedOrders.push(virtualOrder);
  }

  // Sort overall by createdAt ascending to match expectations
  groupedOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return groupedOrders;
}

export async function getTodayOrdersOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const businessDate = getKolkataBusinessDate();
    const orders = await prisma.order.findMany({
      where: { businessDate },
      include: { items: true, payment: true },
      orderBy: { createdAt: 'desc' },
    });

    const grouped = groupActiveOrders(orders, businessDate);

    const ordersWithIndicators = await Promise.all(
      grouped.map(async (order) => {
        const otherOrdersCount = await prisma.order.count({
          where: {
            businessDate,
            customerPhone: order.customerPhone,
            customerName: {
              equals: order.customerName,
              mode: 'insensitive',
            },
            id: { notIn: order.mergedOrderIds },
          },
        });
        return {
          ...order,
          hasOtherOrdersToday: otherOrdersCount > 0 || (order.mergedOrderIds && order.mergedOrderIds.length > 1),
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

    const grouped = groupCodPendingOrders(orders, businessDate);

    const ordersWithIndicators = await Promise.all(
      grouped.map(async (order) => {
        const otherOrdersCount = await prisma.order.count({
          where: {
            businessDate,
            customerPhone: order.customerPhone,
            customerName: {
              equals: order.customerName,
              mode: 'insensitive',
            },
            id: { notIn: order.mergedOrderIds },
          },
        });
        return {
          ...order,
          hasOtherOrdersToday: otherOrdersCount > 0 || (order.mergedOrderIds && order.mergedOrderIds.length > 1),
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
      const targetOrder = await tx.order.findUnique({
        where: { id },
        include: { payment: true },
      });

      if (!targetOrder) {
        throw new AppError('Order not found', 404);
      }

      if (targetOrder.paymentMethod !== 'COD') {
        throw new AppError('Order is not a Cash on Delivery order', 400);
      }

      // Find all active COD orders in the group
      const groupOrders = await tx.order.findMany({
        where: {
          businessDate: targetOrder.businessDate,
          customerName: targetOrder.customerName,
          customerPhone: targetOrder.customerPhone,
          paymentMethod: 'COD',
          orderStatus: {
            in: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']
          }
        },
        include: { payment: true },
      });

      const ordersToUpdate = groupOrders.some(o => o.id === targetOrder.id) ? groupOrders : [targetOrder];

      let lastUpdatedOrder = null;
      for (const order of ordersToUpdate) {
        if (order.orderStatus === 'DELIVERED') {
          continue;
        }

        if (order.orderStatus === 'CANCELLED') {
          continue;
        }

        // Set payment record to PAID
        if (order.payment) {
          await tx.payment.update({
            where: { id: order.payment.id },
            data: {
              amount: order.totalAmount, // Mark the full amount of this order paid
              status: 'PAID',
            },
          });
        } else {
          // Create payment record if it doesn't exist
          await tx.payment.create({
            data: {
              orderId: order.id,
              gateway: 'COD',
              gatewayOrderId: 'cod-' + order.id,
              amount: order.totalAmount,
              status: 'PAID',
            }
          });
        }

        lastUpdatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: 'DELIVERED',
            paymentStatus: 'PAID',
            deliveredAt: new Date(),
          },
        });
      }

      return lastUpdatedOrder || targetOrder;
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
      const targetOrder = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!targetOrder) {
        throw new AppError('Order not found', 404);
      }

      // Find all active orders in the group
      const groupOrders = await tx.order.findMany({
        where: {
          businessDate: targetOrder.businessDate,
          customerName: targetOrder.customerName,
          customerPhone: targetOrder.customerPhone,
          orderStatus: {
            in: ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']
          }
        },
        include: { items: true },
      });

      const ordersToUpdate = groupOrders.some(o => o.id === targetOrder.id) ? groupOrders : [targetOrder];

      let lastUpdatedOrder = null;
      for (const order of ordersToUpdate) {
        if (order.orderStatus === status) {
          lastUpdatedOrder = order;
          continue;
        }

        if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED') {
          continue;
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

        lastUpdatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: status,
            ...(status === 'DELIVERED' ? { deliveredAt: new Date(), paymentStatus: 'PAID' } : {}),
            ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
          },
        });
      }

      return lastUpdatedOrder || targetOrder;
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
      } else if (o.paymentMethod === 'COD') {
        codSales += o.totalAmount;
      }
    }

    const grossAmount = orders.filter(o => o.orderStatus !== 'CANCELLED').reduce((sum, o) => sum + o.totalAmount, 0);
    const failedOrders = orders.filter(o => o.orderStatus === 'PAYMENT_FAILED' || o.paymentStatus === 'FAILED');
    const totalLoss = failedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const pendingCodOrders = orders.filter(o => 
      o.paymentMethod === 'COD' && 
      ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.orderStatus) &&
      o.paymentStatus !== 'PAID'
    );
    const outstandingCod = pendingCodOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      success: true,
      businessDate,
      summary: {
        totalOrders: orders.length - cancelledCount,
        confirmedOrders: confirmedCount,
        cancelledOrders: cancelledCount,
        totalSales,
        codSales,
        onlineSales,
        grossAmount,
        totalLoss,
        outstandingCod,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelAllOrdersOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body;
    const businessDate = getKolkataBusinessDate();

    const activeOrders = await prisma.order.findMany({
      where: {
        businessDate,
        orderStatus: {
          notIn: ['DELIVERED', 'CANCELLED', 'PAYMENT_FAILED'],
        },
      },
      include: {
        items: true,
      },
    });

    if (activeOrders.length === 0) {
      res.json({
        success: true,
        message: 'No active orders found to cancel today.',
        count: 0,
      });
      return;
    }

    const cancelledCount = await prisma.$transaction(async (tx) => {
      for (const order of activeOrders) {
        // Restore stock quantities
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

        // Update the order status to CANCELLED
        await tx.order.update({
          where: { id: order.id },
          data: {
            orderStatus: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: reason || 'Force cancelled by owner',
          },
        });
      }

      return activeOrders.length;
    });

    res.json({
      success: true,
      message: `Successfully force-cancelled ${cancelledCount} orders.`,
      count: cancelledCount,
    });
  } catch (error) {
    next(error);
  }
}

