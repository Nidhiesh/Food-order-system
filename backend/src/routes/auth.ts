import { Router } from 'express';
import { login, logout, getMe } from '../controllers/auth';
import { protectOwner } from '../middleware/auth';

const router = Router();

// Public login route
router.post('/login', login);

// Protected routes
router.post('/logout', protectOwner, logout);
router.get('/me', protectOwner, getMe);

export default router;
