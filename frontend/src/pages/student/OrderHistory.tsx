import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { studentApi } from '../../services/api';
import { History, Loader, Calendar, ArrowLeft, ArrowRight, ClipboardList } from 'lucide-react';

interface OrderSummary {
  id: string;
  publicOrderId: string;
  businessDate: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  trackingToken: string;
  createdAt: string;
}

export const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchHistory = async () => {
    const existing = localStorage.getItem('college_food_order_tokens');
    const tokens = existing ? JSON.parse(existing) : [];

    if (tokens.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await studentApi.getOrderHistory(tokens);
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to retrieve order history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader className="animate-spin mb-3" size={32} />
        <span className="text-sm font-medium">Loading your order history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 animate-fade-in">
        <span className="text-rose-500 font-bold block mb-2">Error Loading History</span>
        <p className="text-slate-500 text-sm max-w-xs mb-6">{error}</p>
        <button
          onClick={fetchHistory}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-6 py-2.5 rounded-2xl cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Header back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Your Order History
        </h2>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <ClipboardList size={30} className="stroke-[1.5]" />
          </div>
          <p className="text-sm font-medium text-slate-500 mb-2">No Orders Found</p>
          <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
            You haven't placed any orders on this browser yet. Ready for some delicious food?
          </p>
          <Link
            to="/"
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
          >
            Order Now
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/order/${order.publicOrderId}`, { state: { token: order.trackingToken } })}
                className="bg-white border border-slate-100 rounded-3xl p-5 shadow-premium hover:border-brand-100 transition-all cursor-pointer flex justify-between items-center group"
              >
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-sm text-slate-900">
                      {order.publicOrderId}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      order.orderStatus === 'DELIVERED' 
                        ? 'bg-emerald-500/10 text-emerald-600' 
                        : order.orderStatus === 'CANCELLED' 
                        ? 'bg-rose-50/10 text-rose-500' 
                        : 'bg-brand-50 text-brand-600'
                    }`}>
                      {order.orderStatus.toLowerCase().replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-3">
                    <Calendar size={12} />
                    <span>{dateStr}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black text-brand-700 text-sm">₹{order.totalAmount}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">({order.paymentMethod})</span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center transition-all">
                  <ArrowRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
