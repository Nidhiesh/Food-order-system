import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ownerApi } from '../../services/api';
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
  RotateCcw,
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
}

const getTodayStr = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

const getYesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};

export const StudentHistory: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPhone = searchParams.get('phone') || '';

  const todayStr = useMemo(() => getTodayStr(), []);
  const yesterdayStr = useMemo(() => getYesterdayStr(), []);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [historyPhone, setHistoryPhone] = useState<string>(initialPhone);
  const [historyDate, setHistoryDate] = useState<string>('');
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [searchingHistory, setSearchingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>('');
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  const handleSearch = async (e?: React.FormEvent, phoneOverride?: string, dateOverride?: string) => {
    if (e) e.preventDefault();
    const phone = phoneOverride !== undefined ? phoneOverride : historyPhone;
    const date = dateOverride !== undefined ? dateOverride : historyDate;

    if (!phone.trim()) {
      alert('Please enter a student phone number (mandatory).');
      return;
    }

    try {
      setSearchingHistory(true);
      setHistoryError('');
      setHasSearched(true);
      const res = await ownerApi.searchOrders({
        phone: phone.trim(),
        date: date.trim() || undefined,
      });
      if (res.success) {
        setHistoryOrders(res.orders || []);
      }
    } catch (err: any) {
      console.error(err);
      setHistoryError(err.response?.data?.message || 'Failed to search student order history.');
    } finally {
      setSearchingHistory(false);
    }
  };

  // Auto-search if initial phone param is present
  useEffect(() => {
    if (initialPhone.trim()) {
      handleSearch(undefined, initialPhone, '');
    }
  }, [initialPhone]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const previousOrders = [...historyOrders];
    const previousSelected = selectedOrder;

    setHistoryOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, orderStatus: newStatus } : null);
    }

    try {
      setUpdatingStatus(true);
      await ownerApi.updateOrderStatus(orderId, newStatus);
    } catch (err: any) {
      setHistoryOrders(previousOrders);
      setSelectedOrder(previousSelected);
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return dateObj.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
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
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
          <History className="text-brand-500" size={26} />
          Student Order History
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Look up complete past order records, payments, and timeline for any specific student
        </p>
      </div>

      {/* Search Form Card */}
      <form 
        onSubmit={(e) => handleSearch(e)}
        className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col gap-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Search size={16} className="text-brand-600" />
            Search Filter
          </span>
          {(historyPhone || historyDate) && (
            <button
              type="button"
              onClick={() => {
                setHistoryPhone('');
                setHistoryDate('');
                setHistoryOrders([]);
                setHasSearched(false);
                setHistoryError('');
                setSearchParams({});
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              Reset Fields
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Student Phone Number Field (Mandatory) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={13} className="text-brand-600" />
                Student Phone Number
              </label>
              <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200/60 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                Mandatory
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="tel"
                required
                placeholder="Enter student phone number (e.g. 9876543210)..."
                value={historyPhone}
                onChange={(e) => {
                  const val = e.target.value;
                  setHistoryPhone(val);
                  if (!val.trim()) {
                    setHistoryOrders([]);
                    setHasSearched(false);
                    setHistoryError('');
                    setSearchParams({});
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400 transition-colors"
              />
              {historyPhone && (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPhone('');
                    setHistoryOrders([]);
                    setHasSearched(false);
                    setHistoryError('');
                    setSearchParams({});
                  }}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date Filter (Optional) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-600" />
                Filter by Date (Optional)
              </label>
              {historyDate && (
                <button
                  type="button"
                  onClick={() => setHistoryDate('')}
                  className="text-[10px] font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
                >
                  All Dates
                </button>
              )}
            </div>

            {/* Date Input Bar */}
            <div className="relative flex items-center">
              <input
                ref={dateInputRef}
                type="date"
                max={todayStr}
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold text-slate-900 outline-none transition-colors cursor-pointer"
              />

              {historyDate && (
                <button
                  type="button"
                  onClick={() => setHistoryDate('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="Clear date filter"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Formatted Date Feedback */}
            {historyDate && (
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1 pt-0.5">
                <span>Selected Date: <strong className="text-brand-600">{formatDisplayDate(historyDate)}</strong></span>
              </div>
            )}

            {/* Quick Date Pills */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHistoryDate('')}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ${
                  historyDate === ''
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Dates
              </button>

              <button
                type="button"
                onClick={() => setHistoryDate(todayStr)}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ${
                  historyDate === todayStr
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setHistoryDate(yesterdayStr)}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ${
                  historyDate === yesterdayStr
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Yesterday
              </button>
            </div>
          </div>
        </div>

        {/* Search Trigger Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={searchingHistory || !historyPhone.trim()}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-500/20 transition-all cursor-pointer flex items-center gap-2"
          >
            {searchingHistory ? (
              <>
                <Loader size={14} className="animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search size={14} />
                Search Student History
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results View */}
      {searchingHistory ? (
        <div className="flex flex-col items-center justify-center min-h-[25vh] text-slate-400">
          <Loader className="animate-spin mb-3 stroke-[1.5]" size={24} />
          <span className="text-xs font-semibold">Searching order database...</span>
        </div>
      ) : historyError ? (
        <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-500" />
          <span>{historyError}</span>
        </div>
      ) : hasSearched && historyPhone.trim() && historyOrders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Search size={22} />
          </div>
          <p className="text-sm font-extrabold text-slate-900 mb-1">No Orders Found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No orders were found for student phone <strong>{historyPhone}</strong>{' '}
            {historyDate ? `on ${formatDisplayDate(historyDate)}` : 'across all dates'}.
          </p>
        </div>
      ) : hasSearched && historyPhone.trim() && historyOrders.length > 0 ? (
        <div className="flex flex-col gap-4">
          {/* Summary Ribbon */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-black text-sm">
                {historyOrders.length}
              </div>
              <div>
                <span className="font-extrabold text-xs text-slate-900 block">
                  Found {historyOrders.length} order{historyOrders.length !== 1 ? 's' : ''} for {historyOrders[0]?.customerName || 'Student'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  Phone: {historyPhone} &bull; Date: {historyDate ? formatDisplayDate(historyDate) : 'All Dates'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount Spent</span>
              <span className="font-black text-brand-600 text-sm">
                ₹{historyOrders.reduce((sum, o) => sum + o.totalAmount, 0)}
              </span>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-slate-700 text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4">Order ID & Date</th>
                    <th className="p-4">Student Details</th>
                    <th className="p-4">Items Ordered</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Order Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyOrders.map((order) => {
                    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    const itemsSummary = order.items && order.items.length > 0
                      ? order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')
                      : 'No items recorded';

                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="p-4 font-bold text-slate-900 text-sm">
                          {order.publicOrderId}
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            {dateStr}
                          </span>
                        </td>
                        <td className="p-4 text-slate-800">
                          <span className="font-bold text-sm block">{order.customerName}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            {order.customerPhone} &bull; {order.departmentClass || 'No Department'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 text-xs max-w-[200px] truncate">
                          {itemsSummary}
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
                              order.orderStatus === 'CANCELLED'
                                ? 'text-rose-500 dark:text-rose-400'
                                : order.paymentStatus === 'PAID' || (order.paymentMethod === 'COD' && order.orderStatus === 'DELIVERED')
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              {order.orderStatus === 'CANCELLED'
                                ? 'CANCELLED'
                                : (order.paymentStatus === 'PAID' || (order.paymentMethod === 'COD' && order.orderStatus === 'DELIVERED') ? 'PAID' : 'PENDING')}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(order.orderStatus)}`}>
                            {order.orderStatus === 'READY' ? 'PREPARED' : order.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-extrabold text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Phone size={22} />
          </div>
          <p className="text-sm font-extrabold text-slate-900 mb-1">Search Student Orders</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Enter a student's phone number above (mandatory) and optionally filter by date to retrieve and view their complete order history.
          </p>
        </div>
      )}

      {/* Order Details Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-5">
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

            {/* Stepper Status dropdown */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Update Order Stage
              </label>
              
              <select
                value={selectedOrder.orderStatus}
                onChange={(e) => handleUpdateStatus(selectedOrder.id, e.target.value)}
                disabled={updatingStatus || selectedOrder.orderStatus === 'DELIVERED' || selectedOrder.orderStatus === 'CANCELLED'}
                className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

                <div className="border-t border-slate-200 dark:border-slate-800 mt-2 pt-2 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Total Invoice</span>
                    <span className="text-brand-600 dark:text-brand-400 font-black text-sm">₹{selectedOrder.totalAmount}</span>
                  </div>

                  {/* Proper Payment Method & Status Breakdown */}
                  {selectedOrder.orderStatus === 'CANCELLED' ? (
                    <div className="flex justify-between items-center text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-200/60 dark:border-rose-500/20">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-rose-500" />
                        {selectedOrder.paymentMethod === 'ONLINE' && selectedOrder.paymentStatus === 'PAID'
                          ? 'Order Cancelled (Payment Refunded)'
                          : 'Order Cancelled (No Cash Due)'}
                      </span>
                      <span className="line-through text-slate-400 dark:text-slate-500">₹{selectedOrder.totalAmount}</span>
                    </div>
                  ) : selectedOrder.paymentMethod === 'COD' ? (
                    selectedOrder.paymentStatus === 'PAID' || selectedOrder.orderStatus === 'DELIVERED' ? (
                      <div className="flex justify-between items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1.5">
                          <Wallet size={12} className="text-emerald-600 dark:text-emerald-400" />
                          Cash Paid (COD)
                        </span>
                        <span>₹{selectedOrder.totalAmount}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1.5">
                          <Wallet size={12} className="text-amber-600 dark:text-amber-400" />
                          Cash to Collect (COD)
                        </span>
                        <span>₹{selectedOrder.totalAmount}</span>
                      </div>
                    )
                  ) : (
                    selectedOrder.paymentStatus === 'PAID' ? (
                      <div className="flex justify-between items-center text-[10px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider bg-sky-50 dark:bg-sky-500/10 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1.5">
                          <CreditCard size={12} className="text-sky-600 dark:text-sky-400" />
                          Paid Online (Razorpay)
                        </span>
                        <span>₹{selectedOrder.totalAmount}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] text-rose-500 dark:text-rose-400 font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg">
                        <span className="flex items-center gap-1.5">
                          <CreditCard size={12} className="text-rose-500 dark:text-rose-400" />
                          Online Payment Pending
                        </span>
                        <span>₹{selectedOrder.totalAmount}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Status logs */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Order Date: {selectedOrder.businessDate}
              </span>
              <span className="flex items-center gap-1 font-bold">
                {selectedOrder.paymentMethod === 'ONLINE' ? (
                  <CreditCard size={12} className="text-sky-500" />
                ) : (
                  <Wallet size={12} className="text-amber-500" />
                )}
                <span>Method: {selectedOrder.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Online Payment'}</span>
                {selectedOrder.orderStatus === 'CANCELLED' ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20 font-bold">
                    CANCELLED
                  </span>
                ) : (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                    selectedOrder.paymentStatus === 'PAID' || (selectedOrder.paymentMethod === 'COD' && selectedOrder.orderStatus === 'DELIVERED')
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {selectedOrder.paymentStatus === 'PAID' || (selectedOrder.paymentMethod === 'COD' && selectedOrder.orderStatus === 'DELIVERED') ? 'PAID' : 'PENDING'}
                  </span>
                )}
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
    </div>
  );
};
