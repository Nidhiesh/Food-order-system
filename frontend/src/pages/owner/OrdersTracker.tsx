import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerApi } from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import { pageCache } from '../../services/pageCache';
import { 
  Loader, 
  Search, 
  User, 
  Phone, 
  Building2, 
  X,
  CreditCard,
  Wallet,
  Calendar,
  AlertTriangle,
  History
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
  businessDate: string;
  customerName: string;
  customerPhone: string;
  departmentClass: string | null;
  totalAmount: number;
  paymentMethod: 'COD' | 'ONLINE';
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  items: OrderItem[];
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  payment?: {
    status: string;
    amount: number;
  } | null;
  hasOtherOrdersToday?: boolean;
}

export const OrdersTracker: React.FC = () => {
  const navigate = useNavigate();

  // Orders state
  const [orders, setOrders] = useState<Order[]>(
    () => pageCache.get<Order[]>('orders:today') ?? []
  );
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(
    () => pageCache.get<Order[]>('orders:today') ?? []
  );
  const [loading, setLoading] = useState<boolean>(!pageCache.has('orders:today'));
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Detail Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Cancel All Modal state
  const [showCancelAllModal, setShowCancelAllModal] = useState<boolean>(false);
  const [cancelAllReason, setCancelAllReason] = useState<string>('');
  const [cancellingAll, setCancellingAll] = useState<boolean>(false);

  const fetchOrders = useCallback(async (showLoading = false) => {
    try {
      if (showLoading && !pageCache.has('orders:today')) {
        setLoading(true);
        setError('');
      }
      const res = await ownerApi.getTodayOrders();
      if (res.success) {
        const data = res.orders || [];
        setOrders(data);
        pageCache.set('orders:today', data);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoading && !pageCache.has('orders:today')) {
        setError(err.response?.data?.message || 'Failed to fetch today\'s orders queue.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // SSE: refresh immediately when any order or shop event arrives
  useSSE({
    order_created:        () => fetchOrders(false),
    order_updated:        () => fetchOrders(false),
    order_cancelled:      () => fetchOrders(false),
    orders_cancelled_all: () => fetchOrders(false),
    shop_updated:         () => fetchOrders(false),
  });

  useEffect(() => {
    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Live queue filtering
  useEffect(() => {
    let result = [...orders];

    if (statusFilter === 'ALL') {
      result = result.filter(o => 
        o.orderStatus === 'CONFIRMED' || 
        o.orderStatus === 'PREPARING' || 
        o.orderStatus === 'PENDING_PAYMENT'
      );
    } else if (statusFilter === 'PREPARED') {
      result = result.filter(o => o.orderStatus === 'READY');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.publicOrderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q)
      );
    }

    setFilteredOrders(result);
  }, [orders, searchQuery, statusFilter]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const previousOrders = [...orders];
    const previousSelectedOrder = selectedOrder;

    // Optimistic UI updates
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, orderStatus: newStatus } : null);
    }

    try {
      setUpdatingStatus(true);
      await ownerApi.updateOrderStatus(orderId, newStatus);
      fetchOrders(false);
    } catch (err: any) {
      setOrders(previousOrders);
      setSelectedOrder(previousSelectedOrder);
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelAllOrders = async () => {
    if (!cancelAllReason.trim()) {
      alert('Please provide a reason for cancelling all orders.');
      return;
    }

    try {
      setCancellingAll(true);
      const res = await ownerApi.cancelAllOrders(cancelAllReason.trim());
      if (res.success) {
        alert(res.message);
        setShowCancelAllModal(false);
        setCancelAllReason('');
        fetchOrders();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to cancel all orders.');
    } finally {
      setCancellingAll(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'CANCELLED':
      case 'PAYMENT_FAILED': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'CONFIRMED': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'READY': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const allStatuses = [
    'CONFIRMED',
    'PREPARING',
    'READY',
    'DELIVERED',
    'CANCELLED'
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Orders Queue</h1>
          <p className="text-slate-500 text-xs mt-1">Live order dispatch & status management</p>
        </div>
        <button
          onClick={() => setShowCancelAllModal(true)}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
        >
          Cancel All Orders
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold outline-none text-slate-900 placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
          {['ALL', 'PREPARED'].map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {filter === 'ALL' ? 'All' : 'Prepared'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List Table */}
      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-slate-400">
          <Loader className="animate-spin mb-3 stroke-[1.5]" size={24} />
          <span className="text-xs">Fetching active queue...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-500" />
          <span>{error}</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl text-slate-400 text-xs font-semibold shadow-sm">
          No orders match the active filter or search criteria.
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-slate-700 text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer Name & Phone</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Order Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="p-4 font-bold text-slate-900 text-sm">
                      {order.publicOrderId}
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-4 text-slate-800">
                      <span className="font-bold text-sm block">{order.customerName}</span>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {order.customerPhone} &bull; {order.departmentClass || 'No Department'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/owner/student-history?phone=${encodeURIComponent(order.customerPhone)}`);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          title="Search full student history in sidebar"
                        >
                          <History size={10} />
                          History
                        </button>
                      </div>
                    </td>
                    <td className="p-4 font-extrabold text-slate-900 text-sm">₹{order.totalAmount}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {order.paymentMethod === 'ONLINE' ? (
                          <CreditCard size={14} className="text-sky-500" />
                        ) : (
                          <Wallet size={14} className="text-amber-500" />
                        )}
                        <span className={`text-[10px] font-extrabold uppercase ${
                          order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(order.orderStatus)}`}>
                        {order.orderStatus === 'READY' ? 'PREPARED' : order.orderStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {order.orderStatus === 'READY' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, 'CONFIRMED');
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-sm"
                        >
                          Not Prepared
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(order.id, 'READY');
                          }}
                          className="bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-sm"
                        >
                          Prepared
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDER DETAILS DIALOG */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-5">
            {/* Title / Close */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Order Details</h3>
                <span className="text-[10px] text-slate-400 font-bold">{selectedOrder.publicOrderId}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Ready / Not Prepared Action Button */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Order Status
                </span>
                <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(selectedOrder.orderStatus)}`}>
                  {selectedOrder.orderStatus === 'READY' ? 'PREPARED' : selectedOrder.orderStatus.replace(/_/g, ' ')}
                </span>
              </div>

              {selectedOrder.orderStatus === 'READY' ? (
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'CONFIRMED')}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  Not prepared
                </button>
              ) : (
                <button
                  type="button"
                  disabled={updatingStatus || selectedOrder.orderStatus === 'CANCELLED' || selectedOrder.orderStatus === 'DELIVERED'}
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'READY')}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  Ready
                </button>
              )}
            </div>

            {/* Customer information */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Customer</span>
                <span className="text-slate-900 font-bold flex flex-wrap items-center gap-1.5">
                  <User size={12} className="text-slate-400" />
                  {selectedOrder.customerName}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Phone</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  {selectedOrder.customerPhone}
                </span>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Department / Class</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  {selectedOrder.departmentClass || 'No Department'}
                </span>
              </div>
            </div>

            {/* Item list */}
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-2.5 block">Ordered Items</span>
              <div className="flex flex-col gap-3 bg-slate-50 p-4 border border-slate-100 rounded-2xl max-h-48 overflow-y-auto">
                {Object.values(
                  selectedOrder.items.reduce((acc, item) => {
                    if (!acc[item.name]) {
                      acc[item.name] = { name: item.name, quantity: 0, subtotal: 0 };
                    }
                    acc[item.name].quantity += item.quantity;
                    acc[item.name].subtotal += item.subtotal;
                    return acc;
                  }, {} as Record<string, { name: string; quantity: number; subtotal: number }>)
                ).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="text-slate-800 font-bold">
                      {item.name}
                      <span className="text-slate-400 font-semibold ml-1.5">× {item.quantity}</span>
                    </div>
                    <span className="text-slate-900 font-black">₹{item.subtotal}</span>
                  </div>
                ))}

                <div className="border-t border-slate-200 mt-2 pt-2 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Total Invoice</span>
                    <span className="text-brand-600 font-black text-sm">₹{selectedOrder.totalAmount}</span>
                  </div>
                  {selectedOrder.payment && selectedOrder.payment.status === 'PAID' && selectedOrder.paymentMethod === 'COD' && (
                    <>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Paid Online</span>
                        <span>₹{selectedOrder.payment.amount}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                        <span>Pending Cash</span>
                        <span>₹{Math.max(0, selectedOrder.totalAmount - selectedOrder.payment.amount)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status logs */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Order Date: {selectedOrder.businessDate}
              </span>
              <span>
                Method: {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})
              </span>
            </div>

            {selectedOrder.cancellationReason && (
              <div className="p-3 bg-rose-50 border border-rose-200/60 rounded-xl text-[11px] text-rose-600 leading-snug">
                <strong>Cancellation Reason:</strong> {selectedOrder.cancellationReason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CANCEL ALL ORDERS DIALOG */}
      {showCancelAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Cancel All Orders</h3>
                <span className="text-[10px] text-slate-400 font-bold">This will cancel all active orders for today</span>
              </div>
              <button
                onClick={() => {
                  setShowCancelAllModal(false);
                  setCancelAllReason('');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Reason for cancellation
              </label>
              <input
                type="text"
                placeholder="Enter cancellation reason (e.g. Shop Closing, Power Cut)..."
                value={cancelAllReason}
                onChange={(e) => setCancelAllReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white rounded-xl text-xs font-semibold outline-none text-slate-900 placeholder:text-slate-400 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setShowCancelAllModal(false);
                  setCancelAllReason('');
                }}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs rounded-xl border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelAllOrders}
                disabled={cancellingAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {cancellingAll ? (
                  <>
                    <Loader className="animate-spin" size={12} />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancel All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
