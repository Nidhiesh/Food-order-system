import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error';
import { ensureActiveBusinessDay } from '../services/shopState';
import { productSchema, menuItemUpdateSchema } from '../validators';
import { getKolkataBusinessDate } from '../utils/timezone';

const prisma = new PrismaClient();

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

export async function getTodayMenuPublic(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();
    const menuItems = await prisma.menuItem.findMany({
      where: {
        businessDate: state.businessDate,
        isAvailable: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      businessDate: state.businessDate,
      menu: menuItems,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// OWNER CATALOG ENDPOINTS
// ==========================================

export async function getCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({
      success: true,
      catalog: products,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = productSchema.parse(req.body);

    const product = await prisma.product.create({
      data: parsed,
    });

    // Automatically add to today's menu if initialized
    const businessDate = getKolkataBusinessDate();
    const state = await prisma.shopState.findUnique({ where: { businessDate } });
    if (state) {
      // Create if it doesn't already exist for today
      await prisma.menuItem.upsert({
        where: {
          businessDate_name: {
            businessDate,
            name: product.name,
          },
        },
        update: {
          isAvailable: true,
          price: product.defaultPrice,
          availableQuantity: product.defaultQuantity,
          initialQuantity: product.defaultQuantity,
        },
        create: {
          businessDate,
          productId: product.id,
          name: product.name,
          description: product.description,
          price: product.defaultPrice,
          initialQuantity: product.defaultQuantity,
          availableQuantity: product.defaultQuantity,
          isAvailable: true,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Product created and added to catalog.',
      product,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = productSchema.partial().parse(req.body);

    const product = await prisma.product.update({
      where: { id },
      data: parsed,
    });

    // Sync with today's menu item if it exists
    const businessDate = getKolkataBusinessDate();
    const todayMenuItem = await prisma.menuItem.findFirst({
      where: { businessDate, productId: id },
    });

    if (todayMenuItem) {
      await prisma.menuItem.update({
        where: { id: todayMenuItem.id },
        data: {
          name: product.name,
          description: product.description,
          price: parsed.defaultPrice !== undefined ? parsed.defaultPrice : undefined,
        },
      });
    }

    res.json({
      success: true,
      message: 'Catalog product updated.',
      product,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCatalogItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Check if product is in any menu items that are linked to orders
    const menuItemsUsingProduct = await prisma.menuItem.findMany({
      where: { productId: id },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    const isUsedInOrders = menuItemsUsingProduct.some(item => item._count.orderItems > 0);

    if (isUsedInOrders) {
      // Cannot physical delete, do soft delete
      const product = await prisma.product.update({
        where: { id },
        data: { isAvailable: false },
      });

      // Set today's menu item unavailable
      const businessDate = getKolkataBusinessDate();
      await prisma.menuItem.updateMany({
        where: { businessDate, productId: id },
        data: { isAvailable: false },
      });

      res.json({
        success: true,
        message: 'Product is linked to historical orders. Soft-deleted (marked unavailable) to preserve records.',
        product,
      });
    } else {
      // Safe to physical delete
      // First delete associated daily MenuItems that don't have order items
      const businessDate = getKolkataBusinessDate();
      await prisma.menuItem.deleteMany({
        where: { productId: id, businessDate },
      });

      await prisma.product.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Product permanently deleted from catalog.',
      });
    }
  } catch (error) {
    next(error);
  }
}

// ==========================================
// OWNER DAILY MENU ENDPOINTS
// ==========================================

export async function getTodayMenuOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();
    const menuItems = await prisma.menuItem.findMany({
      where: { businessDate: state.businessDate },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      businessDate: state.businessDate,
      menu: menuItems,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTodayMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = menuItemUpdateSchema.parse(req.body);

    const menuItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!menuItem) {
      throw new AppError('Menu item not found', 404);
    }

    const businessDate = getKolkataBusinessDate();
    if (menuItem.businessDate !== businessDate) {
      throw new AppError('Cannot modify menu items from previous business days.', 400);
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: parsed,
    });

    res.json({
      success: true,
      message: 'Daily menu item updated.',
      menuItem: updated,
    });
  } catch (error) {
    next(error);
  }
}
