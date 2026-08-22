import React, { useEffect, useState } from 'react';
import { ownerApi } from '../../services/api';
import { 
  Loader, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Phone, 
  Building2, 
  X,
  CreditCard,
  Wallet,
  Calendar,
  AlertTriangle
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
}

export const OrdersTracker: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Filtering / Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Detail Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await ownerApi.getTodayOrders();
      if (res.success) {
        setOrders(res.orders || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch today\'s orders queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Filter logic
  useEffect(() => {
    let result = [...orders];

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(o => o.orderStatus === statusFilter);
    }

    // Search query
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
    try {
      setUpdatingStatus(true);
      await ownerApi.updateOrderStatus(orderId, newStatus);
      
      // Update local state for selected order and list
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
      if (selectedOrder) {
        setSelectedOrder(prev => prev ? { ...prev, orderStatus: newStatus } : null);
      }
      
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'CANCELLED':
      case 'PAYMENT_FAILED': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'READY': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PREPARING': return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'OUT_FOR_DELIVERY': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const allStatuses = [
    'PENDING_PAYMENT',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Orders Queue</h1>
        <p className="text-slate-400 text-xs mt-1">Live order dispatch & status management</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900 border border-slate-800 rounded-3xl p-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ID, name, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl text-xs font-semibold outline-none text-white placeholder:text-slate-600"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
          {['ALL', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'].map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {filter.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List Table */}
      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-slate-400">
          <Loader className="animate-spin mb-3" size={24} />
          <span className="text-xs">Fetching active queue...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl text-slate-500 text-xs font-semibold">
          No orders match the active filter or search criteria.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-slate-300 text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Order Status</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 font-bold text-white text-sm">
                      {order.publicOrderId}
                      <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-4 text-slate-200">
                      <span className="font-bold text-sm block">{order.customerName}</span>
                      <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                        {order.customerPhone} &bull; {order.departmentClass || 'No Department'}
                      </span>
                    </td>
                    <td className="p-4 font-extrabold text-white text-sm">₹{order.totalAmount}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {order.paymentMethod === 'ONLINE' ? (
                          <CreditCard size={14} className="text-sky-400" />
                        ) : (
                          <Wallet size={14} className="text-amber-400" />
                        )}
                        <span className={`text-[10px] font-extrabold uppercase ${
                          order.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(order.orderStatus)}`}>
                        {order.orderStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-white font-extrabold text-[10px] px-3.5 py-1.5 rounded-xl cursor-pointer transition-all"
                      >
                        Manage
                      </button>
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-5">
            {/* Title / Close */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-white">Order Details</h3>
                <span className="text-[10px] text-slate-500 font-bold">{selectedOrder.publicOrderId}</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stepper Status dropdown */}
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Update Order Stage
              </label>
              
              <select
                value={selectedOrder.orderStatus}
                onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                disabled={updatingStatus || selectedOrder.orderStatus === 'DELIVERED' || selectedOrder.orderStatus === 'CANCELLED'}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {allStatuses.map(status => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer information */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Customer</span>
                <span className="text-white font-bold flex items-center gap-1">
                  <User size={12} className="text-slate-400" />
                  {selectedOrder.customerName}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Phone</span>
                <span className="text-white font-bold flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  {selectedOrder.customerPhone}
                </span>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Department / Class</span>
                <span className="text-white font-bold flex items-center gap-1">
                  <Building2 size={12} className="text-slate-400" />
                  {selectedOrder.departmentClass || 'No Department'}
                </span>
              </div>
            </div>

            {/* Item list */}
            <div>
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider mb-2.5 block">Ordered Items</span>
              <div className="flex flex-col gap-3 bg-slate-950/20 p-4 border border-slate-800/60 rounded-2xl">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <div className="text-slate-200 font-bold">
                      {item.name}
                      <span className="text-slate-500 font-semibold ml-1.5">× {item.quantity}</span>
                    </div>
                    <span className="text-white font-black">₹{item.subtotal}</span>
                  </div>
                ))}

                <div className="border-t border-slate-800 mt-2 pt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-semibold">Total Invoice</span>
                  <span className="text-brand-400 font-black text-sm">₹{selectedOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Status logs */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-2 border-t border-slate-800">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Order Date: {selectedOrder.businessDate}
              </span>
              <span>
                Method: {selectedOrder.paymentMethod} ({selectedOrder.paymentStatus})
              </span>
            </div>

            {selectedOrder.cancellationReason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-400 leading-snug">
                <strong>Cancellation Reason:</strong> {selectedOrder.cancellationReason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
