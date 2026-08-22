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
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    const ownerEmail = process.env.INITIAL_OWNER_EMAIL || 'owner@collegefood.com';
    const ownerPassword = process.env.INITIAL_OWNER_PASSWORD || 'OwnerSecurePass123!';
    const existingOwner = await prisma.shopOwner.findFirst();
    if (!existingOwner) {
        const passwordHash = await bcrypt.hash(ownerPassword, 12);
        await prisma.shopOwner.create({
            data: {
                email: ownerEmail,
                passwordHash,
            },
        });
        console.log(`Created shop owner account: ${ownerEmail}`);
        console.log('NOTE: Initial password hashed and stored securely.');
    }
    else {
        console.log('Shop owner account already exists. Skipping owner creation.');
    }
    // Seed default products
    const defaultProducts = [
        { name: 'Veg Meals', description: 'Traditional South Indian thali', defaultPrice: 80, defaultQuantity: 40 },
        { name: 'Chicken Biryani', description: 'Fragrant Basmati rice with tender chicken', defaultPrice: 120, defaultQuantity: 30 },
        { name: 'Curd Rice', description: 'Cool and creamy curd rice', defaultPrice: 50, defaultQuantity: 20 },
        { name: 'Buttermilk', description: 'Spiced cooling buttermilk', defaultPrice: 20, defaultQuantity: 50 },
        { name: 'Samosa', description: 'Crispy potato-filled triangle pastry', defaultPrice: 15, defaultQuantity: 40 }
    ];
    for (const prod of defaultProducts) {
        const existingProduct = await prisma.product.findUnique({
            where: { name: prod.name }
        });
        if (!existingProduct) {
            await prisma.product.create({
                data: prod
            });
            console.log(`Seeded product: ${prod.name}`);
        }
    }
    console.log('Database seeding completed successfully.');
}
main()
    .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
