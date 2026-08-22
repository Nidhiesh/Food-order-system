"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const menu_1 = require("../controllers/menu");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.get('/today', menu_1.getTodayMenuPublic);
// Owner protected routes
router.get('/owner/catalog', auth_1.protectOwner, menu_1.getCatalog);
router.post('/owner/catalog', auth_1.protectOwner, menu_1.createCatalogItem);
router.patch('/owner/catalog/:id', auth_1.protectOwner, menu_1.updateCatalogItem);
router.delete('/owner/catalog/:id', auth_1.protectOwner, menu_1.deleteCatalogItem);
router.get('/owner/today', auth_1.protectOwner, menu_1.getTodayMenuOwner);
router.patch('/owner/today/:id', auth_1.protectOwner, menu_1.updateTodayMenuItem);
exports.default = router;
