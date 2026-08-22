"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_1 = require("../controllers/payments");
const router = (0, express_1.Router)();
// Public routes for payment gateway callbacks
router.post('/verify', payments_1.verifyPayment);
router.post('/webhook', payments_1.handleWebhook);
exports.default = router;
