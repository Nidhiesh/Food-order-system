"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../controllers/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public login route
router.post('/login', auth_1.login);
// Protected routes
router.post('/logout', auth_2.protectOwner, auth_1.logout);
router.get('/me', auth_2.protectOwner, auth_1.getMe);
exports.default = router;
