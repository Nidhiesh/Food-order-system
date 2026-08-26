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
exports.login = login;
exports.logout = logout;
exports.getMe = getMe;
const bcrypt = __importStar(require("bcrypt"));
const jwt = __importStar(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const validators_1 = require("../validators");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_for_local_testing_12345';
const NODE_ENV = process.env.NODE_ENV || 'development';
async function login(req, res, next) {
    try {
        // Validate request body
        const { email, password } = validators_1.loginSchema.parse(req.body);
        // Find owner
        const owner = await prisma.shopOwner.findUnique({
            where: { email },
        });
        if (!owner || !owner.isActive) {
            throw new error_1.AppError('Invalid email or password', 401);
        }
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, owner.passwordHash);
        if (!isPasswordValid) {
            throw new error_1.AppError('Invalid email or password', 401);
        }
        // Generate JWT
        const token = jwt.sign({ id: owner.id, email: owner.email }, JWT_SECRET, { expiresIn: '1d' });
        // Set cookie
        res.cookie('owner_token', token, {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });
        res.json({
            success: true,
            message: 'Login successful',
            token,
            owner: {
                id: owner.id,
                email: owner.email,
            },
        });
    }
    catch (error) {
        next(error);
    }
}
async function logout(req, res, next) {
    try {
        res.clearCookie('owner_token', {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
        });
        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        next(error);
    }
}
async function getMe(req, res, next) {
    try {
        if (!req.owner) {
            throw new error_1.AppError('Not authenticated', 401);
        }
        res.json({
            success: true,
            owner: req.owner,
        });
    }
    catch (error) {
        next(error);
    }
}
