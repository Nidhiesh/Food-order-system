import React, { useEffect, useState } from 'react';
import { ownerApi } from '../../services/api';
import { Loader, AlertTriangle, CheckCircle, IndianRupee, ShieldAlert, User, Phone, School } from 'lucide-react';

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
}

export const CodPending: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  const [actionId, setActionId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchCodPending = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await ownerApi.getCodPendingOrders();
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load COD pending queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodPending();
    const interval = setInterval(fetchCodPending, 20000); // refresh every 20s
    return () => clearInterval(interval);
  }, []);

  const handleMarkDelivered = async (orderId: string, publicId: string) => {
    if (actionId) return; // prevent duplicate clicks

    try {
      setActionId(orderId);
      setError('');
      const res = await ownerApi.markCodDelivered(orderId);
      if (res.success) {
        setSuccessMsg(`Order ${publicId} marked delivered and paid!`);
        // Remove from local list instantly
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update delivery status.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">COD Pending Dispatch</h1>
        <p className="text-slate-400 text-xs mt-1">Manage Cash on Delivery orders. Confirm cash collection on delivery.</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-slate-400">
          <Loader className="animate-spin mb-3" size={24} />
          <span className="text-xs">Fetching pending dispatches...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl text-slate-500 text-xs font-semibold flex flex-col items-center justify-center gap-2">
          <CheckCircle className="text-emerald-500/50" size={32} />
          <span>No pending COD deliveries! Good job.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {orders.map((order) => (
            <div 
              key={order.id} 
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between gap-5 hover:border-slate-700 transition-all shadow-md relative overflow-hidden"
            >
              {/* Top details */}
              <div className="text-left">
                <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-800/80">
                  <div>
                    <span className="font-extrabold text-sm text-white block">{order.publicOrderId}</span>
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                      Placed at: {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-extrabold uppercase tracking-wider">
                    {order.orderStatus}
                  </span>
                </div>

                {/* Customer info */}
                <div className="flex flex-col gap-1.5 text-xs text-slate-300 mb-4">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-500" />
                    <span className="font-bold text-slate-200">{order.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-slate-500" />
                    <span className="font-semibold text-slate-400">{order.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <School size={12} className="text-slate-500" />
                    <span className="font-medium text-slate-400">{order.departmentClass || 'No class details'}</span>
                  </div>
                </div>

                {/* Items ordered */}
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-850/60 mb-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Items</span>
                  <div className="flex flex-col gap-1.5 text-xs">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-300">
                        <span className="font-bold text-slate-200">
                          {item.name} <span className="text-slate-500 text-[10px] font-semibold">× {item.quantity}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="flex items-center justify-between gap-4 mt-auto pt-3 border-t border-slate-800/80">
                <div className="text-left">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Cash to Collect</span>
                  <span className="font-black text-lg text-emerald-400 flex items-center gap-0.5">
                    <IndianRupee size={16} />
                    {order.totalAmount}
                  </span>
                </div>

                <button
                  onClick={() => handleMarkDelivered(order.id, order.publicOrderId)}
                  disabled={actionId === order.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-1.5"
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
