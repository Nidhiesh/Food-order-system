import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';

export const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-6">
          <ShoppingBag size={36} className="stroke-[1.5]" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">Your Cart is Empty</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-8">
          Browse today's specials to add some delicious meals to your cart.
        </p>
        <Link
          to="/"
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition-all cursor-pointer"
        >
          Explore Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Header Back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Review Your Order
        </h2>
      </div>

      {/* Cart Items List */}
      <div className="flex flex-col gap-4 mb-6">
        {cartItems.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-100 rounded-3xl p-4 flex items-center justify-between gap-4 shadow-premium"
          >
            {/* Food info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 leading-snug truncate">{item.name}</h4>
              <span className="text-xs font-semibold text-slate-400 block mt-0.5">
                ₹{item.price} each
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md inline-block mt-2">
                Stock: {item.availableQuantity}
              </span>
            </div>

            {/* Qty Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl p-1 text-slate-700 font-bold shadow-inner">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-200/50 transition-colors"
                >
                  <Minus size={12} className="stroke-[2.5]" />
                </button>
                <span className="text-sm px-2">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-200/50 transition-colors"
                >
                  <Plus size={12} className="stroke-[2.5]" />
                </button>
              </div>

              <button
                onClick={() => removeFromCart(item.id)}
                className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors cursor-pointer"
                title="Remove item"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill Details */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium mb-8">
        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">
          Bill Details
        </h3>
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <span className="text-sm text-slate-500">Item Total</span>
          <span className="text-sm font-bold text-slate-800">₹{getCartTotal()}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-950">Grand Total</span>
          <span className="text-lg font-black text-brand-700">₹{getCartTotal()}</span>
        </div>
      </div>

      {/* Checkout button */}
      <button
        onClick={() => navigate('/checkout')}
        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-3xl shadow-lg shadow-brand-500/20 text-center transition-all hover:scale-[1.01] cursor-pointer"
      >
        Proceed to Checkout
      </button>
    </div>
  );
};
