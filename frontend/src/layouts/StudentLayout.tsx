import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ShoppingBag, History, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';

export const StudentLayout: React.FC = () => {
  const { getTotalItemsCount } = useCart();
  const cartCount = getTotalItemsCount();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20">
              C
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Campus Bites
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              to="/orders"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors"
              title="Order History"
            >
              <History size={20} />
            </Link>

            <Link
              to="/cart"
              className="relative p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors"
              title="Cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area (Limited to mobile-first width: max-w-md) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6 pb-20">
        <Outlet />
      </main>

      {/* Bottom Footer or Info */}
      <footer className="w-full bg-white border-t border-slate-100 py-4 text-center text-slate-400 text-xs mt-auto">
        <div className="max-w-md mx-auto px-4 flex items-center justify-center gap-1.5">
          <Store size={12} />
          <span>College Food Court &bull; Fresh & Fast</span>
        </div>
      </footer>
    </div>
  );
};
