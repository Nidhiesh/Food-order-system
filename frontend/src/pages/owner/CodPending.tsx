import React, { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import { pageCache } from '../../services/pageCache';
import { Loader, AlertTriangle, CheckCircle, IndianRupee, ShieldAlert, User, Phone, School, Search } from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  publicOrderId: string;
  customerName: string;
  customerPhone: string;
  departmentClass: string | null;
  totalAmount: number;
  orderStatus: string;
  createdAt: string;
  items: OrderItem[];
  payment?: {
    status: string;
    amount: number;
  } | null;
  hasOtherOrdersToday?: boolean;
}

export const CodPending: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(
    () => pageCache.get<Order[]>('cod:pending') ?? []
  );
  const [loading, setLoading] = useState<boolean>(!pageCache.has('cod:pending'));
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [actionId, setActionId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      order.customerName.toLowerCase().includes(query) ||
      order.publicOrderId.toLowerCase().includes(query)
    );
  });

  const fetchCodPending = useCallback(async (showLoading = false) => {
    try {
      if (showLoading && !pageCache.has('cod:pending')) {
        setLoading(true);
        setError('');
      }
      const res = await ownerApi.getCodPendingOrders();
      if (res.success) {
        const data = res.orders || [];
        setOrders(data);
        pageCache.set('cod:pending', data);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoading && !pageCache.has('cod:pending')) {
        setError(err.response?.data?.message || 'Failed to load COD pending queue.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // SSE: update COD list instantly on relevant events
  useSSE({
    order_updated:        () => fetchCodPending(false),
    order_cancelled:      () => fetchCodPending(false),
    orders_cancelled_all: () => fetchCodPending(false),
  });

  useEffect(() => {
    fetchCodPending(true);
    // 30s fallback polling in case SSE drops
    const interval = setInterval(() => fetchCodPending(false), 30_000);
    return () => clearInterval(interval);
  }, [fetchCodPending]);

  const handleMarkDelivered = async (orderId: string, publicId: string) => {
    if (actionId) return;

    const previousOrders = [...orders];

    // 1. Optimistic UI update
    setOrders(prev => prev.filter(o => o.id !== orderId));
    setSuccessMsg(`Order ${publicId} marked delivered and paid!`);
    const successTimeout = setTimeout(() => setSuccessMsg(''), 3000);

    try {
      setActionId(orderId);
      setError('');
      await ownerApi.markCodDelivered(orderId);
      // Background sync
      fetchCodPending(false);
    } catch (err: any) {
      // Rollback on error
      clearTimeout(successTimeout);
      setSuccessMsg('');
      setOrders(previousOrders);
      setError(err.response?.data?.message || 'Failed to update delivery status.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">COD Pending Dispatch</h1>
        <p className="text-slate-500 text-xs mt-1">Manage Cash on Delivery orders. Confirm cash collection on delivery.</p>
      </div>

      {/* Search Bar */}
      {orders.length > 0 && (
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Search by customer name or order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-brand-500 rounded-2xl text-xs font-semibold outline-none text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors"
          />
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/60 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-slate-400">
          <Loader className="animate-spin mb-3 stroke-[1.5]" size={24} />
          <span className="text-xs">Fetching pending dispatches...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2 shadow-sm">
          <CheckCircle className="text-emerald-500" size={32} />
          <span>No pending COD deliveries! Good job.</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2 shadow-sm">
          <Search className="text-slate-400" size={32} />
          <span>No dispatches matching "{searchQuery}" found.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="bg-white border border-slate-100 rounded-3xl p-5 flex flex-col justify-between gap-5 hover:border-slate-200 transition-all shadow-sm relative overflow-hidden"
            >
              {/* Top details */}
              <div className="text-left">
                <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 block">{order.publicOrderId}</span>
                    <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                      Placed at: {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-xl text-[10px] font-extrabold uppercase tracking-wider">
                    {order.orderStatus}
                  </span>
                </div>

                {/* Customer info */}
                <div className="flex flex-col gap-2.5 text-base text-slate-700 mb-5">
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-brand-600" />
                    <span className="font-black text-slate-900 text-lg">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-slate-400" />
                    <span className="font-extrabold text-slate-700">{order.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <School size={18} className="text-slate-400" />
                    <span className="font-bold text-slate-500">{order.departmentClass || 'No class details'}</span>
                  </div>
                </div>

                {/* Items ordered */}
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Items</span>
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(
                      order.items.reduce((acc, item) => {
                        acc[item.name] = (acc[item.name] || 0) + item.quantity;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([name, quantity], idx) => (
                      <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-200/60 last:border-0">
                        <span className="font-black text-slate-900 text-base tracking-tight">
                          {name}
                        </span>
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg font-black bg-brand-600 text-white shadow-sm shrink-0">
                          {quantity}x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="flex items-center justify-between gap-4 mt-auto pt-3 border-t border-slate-100">
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Cash to Collect</span>
                  <span className="font-black text-lg text-emerald-600 flex items-center gap-0.5">
                    <IndianRupee size={16} />
                    {order.payment && order.payment.status === 'PAID'
                      ? Math.max(0, order.totalAmount - order.payment.amount)
                      : order.totalAmount}
                  </span>
                </div>

                <button
                  onClick={() => handleMarkDelivered(order.id, order.publicOrderId)}
                  disabled={actionId === order.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none flex items-center justify-center gap-1.5"
                >
                  {actionId === order.id ? (
                    <>
                      <Loader className="animate-spin" size={12} />
                      Updating...
                    </>
                  ) : (
                    'Mark Delivered'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
