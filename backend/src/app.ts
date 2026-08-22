import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import { errorHandler } from './middleware/error';
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import shopRoutes from './routes/shop';

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'super_cookie_secret_local_testing_98765';

// ==========================================
// SECURITY MIDDLEWARES
// ==========================================

// Helmet for security headers
app.use(helmet());

// CORS setup supporting credentials (HTTP-only cookies)
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body size limit + parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Cookie parser
app.use(cookieParser(COOKIE_SECRET));

// ==========================================
// RATE LIMITING (Disabled for development/testing)
// ==========================================

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200, // Limit each IP to 200 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
// app.use('/api', globalLimiter);

// Strict login rate limiter (prevent owner account brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit to 5 failed login attempts
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Access blocked for 15 minutes.',
  },
});
// app.use('/api/auth/login', loginLimiter);

// ==========================================
// ROUTE REGISTRATION
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shop', shopRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
