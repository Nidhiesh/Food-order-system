"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicStatus = getPublicStatus;
exports.getOwnerStatus = getOwnerStatus;
exports.closeShop = closeShop;
exports.openShop = openShop;
exports.updateConfig = updateConfig;
const client_1 = require("@prisma/client");
const timezone_1 = require("../utils/timezone");
const shopState_1 = require("../services/shopState");
const validators_1 = require("../validators");
const prisma = new client_1.PrismaClient();
async function getPublicStatus(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
        const status = (0, timezone_1.determineShopStatus)(state.manualClosed, state.openingTime, state.closingTime);
        res.json({
            success: true,
            businessDate: state.businessDate,
            openingTime: state.openingTime,
            closingTime: state.closingTime,
            cancellationCutoff: state.cancellationCutoff,
            status,
        });
    }
    catch (error) {
        next(error);
    }
}
async function getOwnerStatus(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
        const status = (0, timezone_1.determineShopStatus)(state.manualClosed, state.openingTime, state.closingTime);
        res.json({
            success: true,
            shopState: state,
            status,
        });
    }
    catch (error) {
        next(error);
    }
}
async function closeShop(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
        const updated = await prisma.shopState.update({
            where: { id: state.id },
            data: { manualClosed: true },
        });
        res.json({
            success: true,
            message: 'Shop manually closed.',
            shopState: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
async function openShop(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
        const updated = await prisma.shopState.update({
            where: { id: state.id },
            data: { manualClosed: false },
        });
        res.json({
            success: true,
            message: 'Shop manually opened.',
            shopState: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
async function updateConfig(req, res, next) {
    try {
        const state = await (0, shopState_1.ensureActiveBusinessDay)();
        const parsed = validators_1.shopStateSchema.parse(req.body);
        const updated = await prisma.shopState.update({
            where: { id: state.id },
            data: parsed,
        });
        res.json({
            success: true,
            message: 'Operational configuration updated.',
            shopState: updated,
        });
    }
    catch (error) {
        next(error);
    }
}
