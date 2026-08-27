import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerApi } from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import { pageCache } from '../../services/pageCache';
import { 
  Loader, 
  AlertTriangle, 
  CheckCircle, 
  CreditCard, 
  ShieldAlert, 
  User, 
  Phone, 
  School, 
  Search, 
  X, 
  CheckCheck,
  History,
  PackageCheck
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  id: string;
  publicOrderId: string;
  customerName: string;
  customerPhone: string;
  departmentClass: string | null;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  items: OrderItem[];
  payment?: {
    status: string;
    amount: number;
  } | null;
  hasOtherOrdersToday?: boolean;
  mergedOrderIds?: string[];
  isGrouped?: boolean;
}

export const OnlineOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>(
    () => pageCache.get<Order[]>('online:orders') ?? []
  );
  const [loading, setLoading] = useState<boolean>(!pageCache.has('online:orders'));
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Selected Order for Cart / Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Single Order Delivery Confirmation State
  const [orderToDeliver, setOrderToDeliver] = useState<Order | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // "Deliver All" Confirmation Modal State
  const [showDeliverAllModal, setShowDeliverAllModal] = useState<boolean>(false);
  const [deliveringAll, setDeliveringAll] = useState<boolean>(false);

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      order.customerName.toLowerCase().includes(query) ||
      order.customerPhone.includes(query) ||
      order.publicOrderId.toLowerCase().includes(query)
    );
  });

  const fetchOnlineOrders = useCallback(async (showLoading = false) => {
    try {
      if (showLoading && !pageCache.has('online:orders')) {
        setLoading(true);
        setError('');
      }
      const res = await ownerApi.getOnlineOrders();
      if (res.success) {
        const data = res.orders || [];
        setOrders(data);
        pageCache.set('online:orders', data);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoading && !pageCache.has('online:orders')) {
        setError(err.response?.data?.message || 'Failed to load online orders queue.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // SSE: update list instantly on any relevant events
  useSSE({
    order_created:        () => fetchOnlineOrders(false),
    order_updated:        () => fetchOnlineOrders(false),
    order_cancelled:      () => fetchOnlineOrders(false),
    orders_cancelled_all: () => fetchOnlineOrders(false),
    orders_delivered_all: () => fetchOnlineOrders(false),
  });

  useEffect(() => {
    fetchOnlineOrders(true);
    const interval = setInterval(() => fetchOnlineOrders(false), 30_000);
    return () => clearInterval(interval);
  }, [fetchOnlineOrders]);

  // Handle single order delivery
  const handleConfirmSingleDelivery = async () => {
    if (!orderToDeliver) return;
    const target = orderToDeliver;
    setOrderToDeliver(null);

    const previousOrders = [...orders];

    // Optimistic UI update
    setOrders(prev => prev.filter(o => o.id !== target.id));
    if (selectedOrder && selectedOrder.id === target.id) {
      setSelectedOrder(null);
    }

    setSuccessMsg(`Order ${target.publicOrderId} for ${target.customerName} marked as delivered!`);
    const successTimeout = setTimeout(() => setSuccessMsg(''), 3500);

    try {
      setActionId(target.id);
      setError('');
      await ownerApi.updateOrderStatus(target.id, 'DELIVERED');
      fetchOnlineOrders(false);
    } catch (err: any) {
      clearTimeout(successTimeout);
      setSuccessMsg('');
      setOrders(previousOrders);
      setError(err.response?.data?.message || 'Failed to mark order as delivered.');
    } finally {
      setActionId(null);
    }
  };

  // Handle Deliver All
  const handleConfirmDeliverAll = async () => {
    try {
      setDeliveringAll(true);
      setError('');
      const res = await ownerApi.deliverAllOnlineOrders();
      if (res.success) {
        setShowDeliverAllModal(false);
        setSuccessMsg(res.message || 'All online orders marked as delivered!');
        setTimeout(() => setSuccessMsg(''), 3500);
        fetchOnlineOrders(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to deliver all online orders.');
    } finally {
      setDeliveringAll(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY': return 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
      case 'CONFIRMED': return 'bg-sky-50 text-sky-700 border-sky-200/60';
      case 'PREPARING': return 'bg-amber-50 text-amber-700 border-amber-200/60';
      case 'DELIVERED': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100">
              <CreditCard size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Online Orders</h1>
              <p className="text-slate-500 text-xs mt-0.5">Manage prepaid online orders and verify dispatch</p>
            </div>
          </div>
        </div>

        {orders.length > 0 && (
          <button
            onClick={() => setShowDeliverAllModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCheck size={16} />
            Mark All as Delivered
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          <Search size={14} />
        </span>
        <input
          type="text"
          placeholder="Search by customer name, phone, or order ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-brand-500 rounded-2xl text-xs font-semibold outline-none text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors"
        />
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/60 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-slide-up">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-slide-up">
          <ShieldAlert size={16} className="text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Grid */}
      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-slate-400">
          <Loader className="animate-spin mb-3 stroke-[1.5]" size={24} />
          <span className="text-xs">Fetching active online orders...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2 shadow-sm">
          <CheckCircle className="text-emerald-500" size={32} />
          <span>No pending online orders! All clear.</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl text-slate-400 text-xs font-semibold flex flex-col items-center justify-center gap-2 shadow-sm">
          <Search className="text-slate-400" size={32} />
          <span>No online orders matching "{searchQuery}" found.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOrders.map((order) => (
            <div 
              key={order.id} 
              onClick={() => setSelectedOrder(order)}
              className="bg-white border border-slate-100 hover:border-slate-200 rounded-3xl p-5 flex flex-col justify-between gap-5 transition-all shadow-sm relative overflow-hidden cursor-pointer group"
            >
              {/* Top details */}
              <div className="text-left">
                <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{order.publicOrderId}</span>
                      {order.isGrouped && (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg text-[9px] font-extrabold">
                          Combined ({order.mergedOrderIds?.length || 1})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                      Placed at: {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border ${getStatusBadge(order.orderStatus)}`}>
                      {order.orderStatus === 'READY' ? 'PREPARED' : order.orderStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Customer info */}
                <div className="flex flex-col gap-2 text-base text-slate-700 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <User size={16} className="text-brand-600 shrink-0" />
                      <span className="font-black text-slate-900 text-base">{order.customerName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/owner/student-history?phone=${encodeURIComponent(order.customerPhone)}`);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 px-2 py-1 rounded-xl cursor-pointer transition-colors"
                      title="Search student history"
                    >
                      <History size={11} />
                      History
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <span className="font-extrabold text-slate-700">{order.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs">
                    <School size={14} className="text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-500">{order.departmentClass || 'No department specified'}</span>
                  </div>
                </div>

                {/* Items in order preview */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Ordered Items ({order.items.reduce((sum, item) => sum + item.quantity, 0)})
                    </span>
                    <span className="text-[10px] font-bold text-brand-600">Click for details</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-200/60 last:border-0">
                        <span className="font-bold text-slate-800 truncate pr-2">
                          {item.name}
                        </span>
                        <span className="font-black text-slate-900 shrink-0">
                          {item.quantity} × ₹{item.unitPrice}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-bold mt-1">
                        + {order.items.length - 3} more items...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="flex items-center justify-between gap-4 mt-auto pt-3 border-t border-slate-100">
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Payment Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase">
                      <CreditCard size={10} />
                      PAID ONLINE ₹{order.totalAmount}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrderToDeliver(order);
                  }}
                  disabled={actionId === order.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <PackageCheck size={14} />
                  Mark Delivered
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ORDER DETAILS (CART BREAKDOWN) MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Title / Close */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">Order Cart Details</h3>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold rounded-lg">
                    PAID ONLINE
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">{selectedOrder.publicOrderId}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer Information */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Customer Name</span>
                <span className="text-slate-900 font-black flex items-center gap-1.5 text-sm">
                  <User size={13} className="text-brand-600 shrink-0" />
                  {selectedOrder.customerName}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Phone</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <Phone size={12} className="text-slate-400 shrink-0" />
                  {selectedOrder.customerPhone}
                </span>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Department / Class</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <School size={12} className="text-slate-400 shrink-0" />
                  {selectedOrder.departmentClass || 'No Department Specified'}
                </span>
              </div>
            </div>

            {/* Detailed Item List */}
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-2.5 block">
                Cart Items & Breakdown
              </span>
              <div className="flex flex-col gap-2 bg-slate-50 p-4 border border-slate-100 rounded-2xl max-h-60 overflow-y-auto">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-2 border-b border-slate-200/60 last:border-0">
                    <div>
                      <span className="text-slate-900 font-bold block">{item.name}</span>
                      <span className="text-slate-400 text-[10px] font-semibold">
                        ₹{item.unitPrice} × {item.quantity}
                      </span>
                    </div>
                    <span className="text-slate-900 font-black text-sm">
                      ₹{item.subtotal || item.unitPrice * item.quantity}
                    </span>
                  </div>
                ))}

                <div className="border-t border-slate-200 mt-2 pt-3 flex justify-between items-center">
                  <span className="text-slate-600 font-extrabold text-xs">Total Amount Paid</span>
                  <span className="text-emerald-600 font-black text-base">₹{selectedOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedOrder;
                  setSelectedOrder(null);
                  setOrderToDeliver(target);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <PackageCheck size={15} />
                Mark as Delivered
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2ND CONFIRMATION MODAL: SINGLE ORDER DELIVERY */}
      {orderToDeliver && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <PackageCheck size={24} />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Confirm Order Delivery</h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Are you sure you want to mark order <span className="font-extrabold text-slate-900">{orderToDeliver.publicOrderId}</span> for <span className="font-extrabold text-slate-900">{orderToDeliver.customerName}</span> as <span className="text-emerald-600 font-bold">DELIVERED</span>?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDeliver(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelivery}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                Yes, Mark Delivered
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2ND CONFIRMATION MODAL: DELIVER ALL ORDERS */}
      {showDeliverAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <CheckCheck size={24} />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Deliver All Online Orders?</h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Are you sure you want to mark all <span className="font-extrabold text-slate-900">{orders.length}</span> active online orders as <span className="text-emerald-600 font-bold">DELIVERED</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deliveringAll}
                onClick={() => setShowDeliverAllModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deliveringAll}
                onClick={handleConfirmDeliverAll}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {deliveringAll ? (
                  <>
                    <Loader className="animate-spin" size={13} />
                    Processing...
                  </>
                ) : (
                  'Yes, Deliver All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
