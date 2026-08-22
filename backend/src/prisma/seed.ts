import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
  } else {
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
