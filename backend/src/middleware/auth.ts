import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AppError } from './error';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_for_local_testing_12345';

export interface AuthenticatedRequest extends Request {
  owner?: {
    id: string;
    email: string;
  };
}

export async function protectOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let token = req.cookies?.owner_token;

    // Support Authorization header as fallback (for testing/development ease)
    if (!token && req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Not authenticated. Please log in as shop owner.', 401);
    }

    // Verify JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new AppError('Session expired or invalid token. Please log in again.', 401);
    }

    // Verify owner exists in DB
    const owner = await prisma.shopOwner.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, isActive: true },
    });

    if (!owner || !owner.isActive) {
      throw new AppError('User account is no longer active or exists.', 401);
    }

    // Attach owner to request context
    req.owner = {
      id: owner.id,
      email: owner.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}
