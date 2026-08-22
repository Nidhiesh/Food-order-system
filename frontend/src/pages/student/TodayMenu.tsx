import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { studentApi } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { Plus, Minus, ShoppingBag, Loader, AlertTriangle, ChefHat } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  availableQuantity: number;
  isAvailable: boolean;
}

export const TodayMenu: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, addToCart, updateQuantity, getCartTotal, getTotalItemsCount } = useCart();
  
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const initPage = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 1. Verify shop status first
      const statusRes = await studentApi.getShopStatus();
      if (!statusRes?.status?.isOpen) {
        navigate('/shop-closed', { state: { message: statusRes.status.message } });
        return;
      }

      // 2. Fetch active menu
      const menuRes = await studentApi.getTodayMenu();
      if (menuRes?.success) {
        setMenu(menuRes.menu || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to connect to campus food server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initPage();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader className="animate-spin mb-3 stroke-[1.5]" size={36} />
        <span className="text-sm font-medium">Checking today's fresh menu...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 animate-fade-in">
        <AlertTriangle className="text-amber-500 mb-4" size={40} />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Something Went Wrong</h2>
        <p className="text-slate-500 text-sm max-w-xs mb-6 leading-relaxed">{error}</p>
        <button
          onClick={initPage}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-2.5 rounded-2xl shadow-md transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`animate-slide-up ${getTotalItemsCount() > 0 ? 'pb-28' : ''}`}>
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-850 to-brand-800 rounded-3xl p-6 text-white shadow-xl shadow-brand-950/10 mb-8 border border-white/5">
        <div className="relative z-10">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider mb-3">
            Fresh Today
          </span>
          <h2 className="text-xl font-extrabold tracking-tight mb-1">
            Skip the WhatsApp Line!
          </h2>
          <p className="text-brand-200 text-xs max-w-xs leading-relaxed">
            Order your college lunch directly here and pick it up hot at the food counter.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
          <ChefHat size={140} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
          Today's Specials
        </h3>
        <span className="text-slate-400 text-xs font-semibold">
          {menu.length} items available
        </span>
      </div>

      {/* Menu List */}
      {menu.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <span className="text-slate-400 text-sm font-medium">Today's menu hasn't been posted yet.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {menu.map((item) => {
            const cartItem = cartItems.find((i) => i.id === item.id);
            const inCartCount = cartItem?.quantity || 0;
            const isSoldOut = item.availableQuantity <= 0;

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-100 rounded-3xl p-4 flex gap-4 shadow-premium shadow-premium-hover relative overflow-hidden"
              >
                {/* Food info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-slate-900 leading-snug">{item.name}</h4>
                    <span className="font-black text-brand-700 text-sm shrink-0">
                      ₹{item.price}
                    </span>
                  </div>
                  
                  {item.description && (
                    <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-3 pr-2">
                      {item.description}
                    </p>
                  )}

                  {/* Stock tag */}
                  <div className="flex items-center gap-1.5 mt-auto">
                    {isSoldOut ? (
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Sold Out
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        item.availableQuantity <= 5 
                          ? 'text-amber-600 bg-amber-50' 
                          : 'text-slate-400 bg-slate-100'
                      }`}>
                        {item.availableQuantity} left
                      </span>
                    )}
                  </div>
                </div>

                {/* Add to Cart Actions */}
                <div className="flex flex-col items-center justify-center shrink-0 w-24">
                  {isSoldOut ? (
                    <button
                      disabled
                      className="w-full py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-2xl cursor-not-allowed uppercase"
                    >
                      Sold Out
                    </button>
                  ) : inCartCount > 0 ? (
                    <div className="flex items-center justify-between w-full bg-brand-50 border border-brand-100 rounded-2xl p-1 text-brand-700 font-bold shadow-inner">
                      <button
                        onClick={() => updateQuantity(item.id, inCartCount - 1)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-brand-100/50 transition-colors"
                      >
                        <Minus size={14} className="stroke-[2.5]" />
                      </button>
                      <span className="text-sm">{inCartCount}</span>
                      <button
                        onClick={() => updateQuantity(item.id, inCartCount + 1)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-brand-100/50 transition-colors"
                      >
                        <Plus size={14} className="stroke-[2.5]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        availableQuantity: item.availableQuantity,
                      })}
                      className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-brand-500/10 flex items-center justify-center gap-1 transition-all cursor-pointer hover:scale-[1.02]"
                    >
                      <Plus size={12} className="stroke-[3]" />
                      ADD
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {getTotalItemsCount() > 0 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-40">
          <div className="w-full max-w-md bg-slate-900 text-white p-4 rounded-3xl shadow-xl flex items-center justify-between gap-4 animate-slide-up border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-bold">
                <ShoppingBag size={18} />
              </div>
              <div>
                <span className="block text-xs text-slate-400 font-medium">{getTotalItemsCount()} item(s)</span>
                <span className="block text-sm font-black">₹{getCartTotal()}</span>
              </div>
            </div>

            <Link
              to="/cart"
              className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm px-6 py-2.5 rounded-2xl transition-all hover:scale-[1.02] cursor-pointer"
            >
              View Cart
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
