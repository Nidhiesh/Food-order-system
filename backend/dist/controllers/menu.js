"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayMenuPublic = getTodayMenuPublic;
exports.getCatalog = getCatalog;
exports.createCatalogItem = createCatalogItem;
exports.updateCatalogItem = updateCatalogItem;
exports.deleteCatalogItem = deleteCatalogItem;
exports.getTodayMenuOwner = getTodayMenuOwner;
exports.updateTodayMenuItem = updateTodayMenuItem;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const shopState_1 = require("../services/shopState");
const validators_1 = require("../validators");
const timezone_1 = require("../utils/timezone");
const prisma = new client_1.PrismaClient();
// ==========================================
// PUBLIC ENDPOINTS
// ==========================================
async function getTodayMenuPublic(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
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
    }
    catch (error) {
        next(error);
    }
}
// ==========================================
// OWNER CATALOG ENDPOINTS
// ==========================================
async function getCatalog(req, res, next) {
    try {
        const products = await prisma.product.findMany({
            orderBy: { name: 'asc' },
        });
        res.json({
            success: true,
            catalog: products,
        });
    }
    catch (error) {
        next(error);
    }
}
async function createCatalogItem(req, res, next) {
    try {
        const parsed = validators_1.productSchema.parse(req.body);
        const product = await prisma.product.create({
            data: parsed,
        });
        // Automatically add to today's menu if initialized
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
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
    }
    catch (error) {
        next(error);
    }
}
async function updateCatalogItem(req, res, next) {
    try {
        const { id } = req.params;
        const parsed = validators_1.productSchema.partial().parse(req.body);
        const product = await prisma.product.update({
            where: { id },
            data: parsed,
        });
        // Sync with today's menu item if it exists
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
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
    }
    catch (error) {
        next(error);
    }
}
async function deleteCatalogItem(req, res, next) {
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
            const businessDate = (0, timezone_1.getKolkataBusinessDate)();
            await prisma.menuItem.updateMany({
                where: { businessDate, productId: id },
                data: { isAvailable: false },
            });
            res.json({
                success: true,
                message: 'Product is linked to historical orders. Soft-deleted (marked unavailable) to preserve records.',
                product,
            });
        }
        else {
            // Safe to physical delete
            // First delete associated daily MenuItems that don't have order items
            const businessDate = (0, timezone_1.getKolkataBusinessDate)();
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
    }
    catch (error) {
        next(error);
    }
}
// ==========================================
// OWNER DAILY MENU ENDPOINTS
// ==========================================
async function getTodayMenuOwner(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
        const menuItems = await prisma.menuItem.findMany({
            where: { businessDate: state.businessDate },
            orderBy: { name: 'asc' },
        });
        res.json({
            success: true,
            businessDate: state.businessDate,
            menu: menuItems,
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateTodayMenuItem(req, res, next) {
    try {
        const { id } = req.params;
        const parsed = validators_1.menuItemUpdateSchema.parse(req.body);
        const menuItem = await prisma.menuItem.findUnique({
            where: { id },
        });
        if (!menuItem) {
            throw new error_1.AppError('Menu item not found', 404);
        }
        const businessDate = (0, timezone_1.getKolkataBusinessDate)();
        if (menuItem.businessDate !== businessDate) {
            throw new error_1.AppError('Cannot modify menu items from previous business days.', 400);
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
    }
    catch (error) {
        next(error);
    }
}
