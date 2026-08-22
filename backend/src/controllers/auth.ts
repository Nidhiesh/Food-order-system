import { Request, Response, NextFunction } from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error';
import { loginSchema } from '../validators';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_for_local_testing_12345';
const NODE_ENV = process.env.NODE_ENV || 'development';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate request body
    const { email, password } = loginSchema.parse(req.body);

    // Find owner
    const owner = await prisma.shopOwner.findUnique({
      where: { email },
    });

    if (!owner || !owner.isActive) {
      throw new AppError('Invalid email or password', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, owner.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate JWT
    const token = jwt.sign(
      { id: owner.id, email: owner.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set cookie
    res.cookie('owner_token', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({
      success: true,
      message: 'Login successful',
      owner: {
        id: owner.id,
        email: owner.email,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    res.clearCookie('owner_token', {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: any, res: Response, next: NextFunction) {
  try {
    if (!req.owner) {
      throw new AppError('Not authenticated', 401);
    }

    res.json({
      success: true,
      owner: req.owner,
    });
  } catch (error) {
    next(error);
  }
}
