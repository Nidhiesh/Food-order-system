import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getKolkataBusinessDate } from '../utils/timezone';

const prisma = new PrismaClient();

// Dynamic supertest support requires running server, or direct application handlers.
// Express application handlers can be queried directly via supertest.
import supertest = require('supertest');

describe('College Food Ordering System Integration Tests', () => {
  let testProduct: any;
  let testMenuItem: any;
  let ownerToken: string;

  beforeAll(async () => {
    // Clean up or initialize test environment
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.shopState.deleteMany();
    await prisma.product.deleteMany();
    await prisma.shopOwner.deleteMany();

    // Create seed owner
    const hash = await bcrypt.hash('OwnerSecurePass123!', 12);
    await prisma.shopOwner.create({
      data: {
        email: 'owner@collegefood.com',
        passwordHash: hash,
      },
    });

    // Create seed product in catalog
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Chicken Biryani',
        description: 'Flavorful spiced rice with chicken',
        defaultPrice: 130,
        defaultQuantity: 15,
        isAvailable: true,
      },
    });

    // Pre-create ShopState for today with 24h operational window to bypass closing checks
    const businessDate = getKolkataBusinessDate();
    await prisma.shopState.create({
      data: {
        businessDate,
        manualClosed: false,
        openingTime: '00:00',
        closingTime: '23:59',
        cancellationCutoff: '23:59',
      },
    });

    // Manually copy product to today's menu items
    await prisma.menuItem.create({
      data: {
        businessDate,
        productId: testProduct.id,
        name: testProduct.name,
        description: testProduct.description,
        price: testProduct.defaultPrice,
        initialQuantity: testProduct.defaultQuantity,
        availableQuantity: testProduct.defaultQuantity,
        isAvailable: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Shop State APIs', () => {
    it('should retrieve public shop status and verify auto-initialization of business day', async () => {
      const res = await request(app).get('/api/shop/status');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.status).toHaveProperty('isOpen');
      expect(res.body.status).toHaveProperty('code');
      expect(res.body.status).toHaveProperty('message');
    });
  });

  describe('Menu APIs', () => {
    it('should load today\'s menu items and return available quantities', async () => {
      const res = await request(app).get('/api/menu/today');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.menu)).toBe(true);
      
      // Test product should have been auto-copied to today's menu
      const item = res.body.menu.find((i: any) => i.name === 'Test Chicken Biryani');
      expect(item).toBeDefined();
      expect(item.price).toBe(130);
      expect(item.availableQuantity).toBe(15);
      testMenuItem = item;
    });
  });

  describe('Auth APIs', () => {
    it('should fail owner login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'owner@collegefood.com', password: 'wrongpassword' });
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should login owner successfully and set session cookies', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'owner@collegefood.com', password: 'OwnerSecurePass123!' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.owner.email).toBe('owner@collegefood.com');
      
      // Save owner token from headers / cookies
      const rawCookies = res.headers['set-cookie'];
      const cookies = Array.isArray(rawCookies) ? rawCookies : (rawCookies ? [rawCookies] : []);
      const tokenCookie = cookies.find((c: string) => c.startsWith('owner_token='));
      if (tokenCookie) {
        ownerToken = tokenCookie.split(';')[0].split('=')[1];
      }
    });
  });

  describe('Order Lifecycle APIs', () => {
    it('should place a student COD order, deduct menu item stock, and generate tracking token', async () => {
      // Create order
      const res = await request(app)
        .post('/api/orders')
        .send({
          customerName: 'Test Student',
          customerPhone: '9876543210',
          departmentClass: 'IT - 2nd Year',
          paymentMethod: 'COD',
          items: [
            { menuItemId: testMenuItem.id, quantity: 2 }
          ]
        });

      // Verify response
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.publicOrderId).toBeDefined();
      expect(res.body.trackingToken).toBeDefined();
      expect(res.body.totalAmount).toBe(260);

      // Verify stock was decremented on today's menu item
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: testMenuItem.id }
      });
      expect(menuItem?.availableQuantity).toBe(13); // 15 - 2 = 13
    });

    it('should allow student order details lookup using tracking token', async () => {
      // First create order to get details
      const order = await prisma.order.findFirst({
        where: { customerName: 'Test Student' }
      });

      const res = await request(app)
        .get(`/api/orders/${order?.publicOrderId}`)
        .query({ token: order?.trackingToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.customerName).toBe('Test Student');
      expect(res.body.order.totalAmount).toBe(260);
    });

    it('should prevent order details access when token is mismatched', async () => {
      const order = await prisma.order.findFirst({
        where: { customerName: 'Test Student' }
      });

      const res = await request(app)
        .get(`/api/orders/${order?.publicOrderId}`)
        .query({ token: 'invalid_token_123' });

      expect(res.status).toBe(404); // returns 404 to protect ID enumeration
    });
  });
});
