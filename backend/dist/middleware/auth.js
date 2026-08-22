"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectOwner = protectOwner;
const jwt = __importStar(require("jsonwebtoken"));
const error_1 = require("./error");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_for_local_testing_12345';
async function protectOwner(req, res, next) {
    try {
        let token = req.cookies?.owner_token;
        // Support Authorization header as fallback (for testing/development ease)
        if (!token && req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            throw new error_1.AppError('Not authenticated. Please log in as shop owner.', 401);
        }
        // Verify JWT
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch (err) {
            throw new error_1.AppError('Session expired or invalid token. Please log in again.', 401);
        }
        // Verify owner exists in DB
        const owner = await prisma.shopOwner.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, isActive: true },
        });
        if (!owner || !owner.isActive) {
            throw new error_1.AppError('User account is no longer active or exists.', 401);
        }
        // Attach owner to request context
        req.owner = {
            id: owner.id,
            email: owner.email,
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
