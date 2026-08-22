"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shop_1 = require("../controllers/shop");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public route to check shop status
router.get('/status', shop_1.getPublicStatus);
// Protected owner routes
router.get('/owner/status', auth_1.protectOwner, shop_1.getOwnerStatus);
router.post('/owner/close', auth_1.protectOwner, shop_1.closeShop);
router.post('/owner/open', auth_1.protectOwner, shop_1.openShop);
router.patch('/owner/config', auth_1.protectOwner, shop_1.updateConfig);
exports.default = router;
