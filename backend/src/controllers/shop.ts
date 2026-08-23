import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { determineShopStatus } from '../utils/timezone';
import { ensureActiveBusinessDay } from '../services/shopState';
import { shopStateSchema } from '../validators';
import { sseManager } from '../services/sseManager';

const prisma = new PrismaClient();

export async function getPublicStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();
    const status = determineShopStatus(state.manualClosed, state.openingTime, state.closingTime);

    res.json({
      success: true,
      businessDate: state.businessDate,
      openingTime: state.openingTime,
      closingTime: state.closingTime,
      cancellationCutoff: state.cancellationCutoff,
      status,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOwnerStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();
    const status = determineShopStatus(state.manualClosed, state.openingTime, state.closingTime);

    res.json({
      success: true,
      shopState: state,
      status,
    });
  } catch (error) {
    next(error);
  }
}

export async function closeShop(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();

    const updated = await prisma.shopState.update({
      where: { id: state.id },
      data: { manualClosed: true },
    });

    sseManager.broadcast('shop_updated', { isOpen: false });

    res.json({
      success: true,
      message: 'Shop manually closed.',
      shopState: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function openShop(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();

    const updated = await prisma.shopState.update({
      where: { id: state.id },
      data: { manualClosed: false },
    });

    sseManager.broadcast('shop_updated', { isOpen: true });

    res.json({
      success: true,
      message: 'Shop manually opened.',
      shopState: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const state = await ensureActiveBusinessDay();
    const parsed = shopStateSchema.parse(req.body);

    const updated = await prisma.shopState.update({
      where: { id: state.id },
      data: parsed,
    });

    sseManager.broadcast('shop_updated', { configUpdated: true });

    res.json({
      success: true,
      message: 'Operational configuration updated.',
      shopState: updated,
    });
  } catch (error) {
    next(error);
  }
}
