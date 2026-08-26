import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { studentApi } from '../services/api';
import { useSSE } from '../hooks/useSSE';

export interface CartItem {
  id: string; // MenuItem ID
  name: string;
  price: number;
  quantity: number;
  availableQuantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getTotalItemsCount: () => number;
  syncCartWithMenu: (menu: any[]) => void;
  removedItemsNotice: string[];
  clearRemovedItemsNotice: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('college_food_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [removedItemsNotice, setRemovedItemsNotice] = useState<string[]>([]);
  const cartItemsRef = useRef<CartItem[]>(cartItems);

  useEffect(() => {
    cartItemsRef.current = cartItems;
    localStorage.setItem('college_food_cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // Synchronize cart with an active list of today's menu items
  const syncCartWithMenu = useCallback((menu: any[]) => {
    if (!Array.isArray(menu)) return;

    setCartItems((prev) => {
      if (prev.length === 0) return prev;

      // Available items must exist in menu with isAvailable: true
      const availableMap = new Map<string, any>();
      menu.forEach((item) => {
        if (item.isAvailable !== false) {
          availableMap.set(item.id, item);
        }
      });

      const removedNames: string[] = [];
      const updatedCart: CartItem[] = [];
      let hasChanges = false;

      for (const item of prev) {
        const liveItem = availableMap.get(item.id);

        if (!liveItem) {
          // Item was removed, soft-deleted, or marked unavailable by owner
          removedNames.push(item.name);
          hasChanges = true;
        } else {
          // If price or name changed, sync them
          if (item.price !== liveItem.price || item.name !== liveItem.name) {
            hasChanges = true;
            updatedCart.push({
              ...item,
              name: liveItem.name,
              price: liveItem.price,
              availableQuantity: liveItem.availableQuantity ?? item.availableQuantity,
            });
          } else {
            updatedCart.push(item);
          }
        }
      }

      if (removedNames.length > 0) {
        setRemovedItemsNotice((old) => Array.from(new Set([...old, ...removedNames])));
      }

      return hasChanges ? updatedCart : prev;
    });
  }, []);

  // Fetch live menu from server and sync
  const refreshAndSyncCart = useCallback(async () => {
    try {
      const res = await studentApi.getTodayMenu();
      if (res?.success && Array.isArray(res.menu)) {
        syncCartWithMenu(res.menu);
      }
    } catch (e) {
      console.warn('[CartContext] Menu sync check skipped (network/offline).');
    }
  }, [syncCartWithMenu]);

  // Real-time synchronization via Server-Sent Events (SSE)
  useSSE({
    menu_updated: () => {
      refreshAndSyncCart();
    },
    shop_updated: () => {
      refreshAndSyncCart();
    },
  });

  // Also sync on initial mount and when user focuses tab
  useEffect(() => {
    refreshAndSyncCart();

    const handleFocus = () => {
      refreshAndSyncCart();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshAndSyncCart]);

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        const nextQty = existing.quantity + 1;
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getTotalItemsCount = () => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const clearRemovedItemsNotice = () => {
    setRemovedItemsNotice([]);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getTotalItemsCount,
        syncCartWithMenu,
        removedItemsNotice,
        clearRemovedItemsNotice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
