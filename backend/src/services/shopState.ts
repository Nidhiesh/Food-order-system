import { PrismaClient, ShopState } from '@prisma/client';
import { getKolkataBusinessDate } from '../utils/timezone';

const prisma = new PrismaClient();

/**
 * Ensures that the ShopState and MenuItems for today's business date are initialized.
 * If a new day has started, this will automatically perform the daily reset workflow:
 * - Creates a new ShopState for the new business date.
 * - Copies active products from the catalog to today's MenuItems (resetting quantities).
 * - Resets manual closure override for today.
 */
export async function ensureActiveBusinessDay(): Promise<ShopState> {
  const businessDate = getKolkataBusinessDate();

  // Try to find today's state
  let state = await prisma.shopState.findUnique({
    where: { businessDate },
  });

  if (state) {
    return state;
  }

  // Today's state does not exist - this is the first interaction of a new business day!
  // Use a transaction to perform the daily initialization atomically.
  console.log(`[Daily Reset] Initializing new business day: ${businessDate}`);

  return await prisma.$transaction(async (tx) => {
    // 1. Double check inside transaction to avoid race conditions
    let stateInside = await tx.shopState.findUnique({
      where: { businessDate },
    });

    if (stateInside) {
      return stateInside;
    }

    // 2. Create today's ShopState
    const newState = await tx.shopState.create({
      data: {
        businessDate,
        manualClosed: false,
        openingTime: "08:00",
        closingTime: "11:00",
        cancellationCutoff: "11:00",
      },
    });

    // 3. Load active products from the master catalog
    const activeProducts = await tx.product.findMany({
      where: { isAvailable: true },
    });

    // 4. Populate today's MenuItems based on catalog products
    for (const product of activeProducts) {
      // Check if menu item already exists (safety)
      const existingMenuItem = await tx.menuItem.findUnique({
        where: {
          businessDate_name: {
            businessDate,
            name: product.name,
          },
        },
      });

      if (!existingMenuItem) {
        await tx.menuItem.create({
          data: {
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
    }

    console.log(`[Daily Reset] Initialized menu items for ${businessDate}`);
    return newState;
  });
}
