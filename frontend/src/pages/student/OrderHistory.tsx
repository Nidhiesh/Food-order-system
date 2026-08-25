import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { studentApi } from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import { pageCache } from '../../services/pageCache';
import {
  Loader,
  Calendar,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  Ban,
  X
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

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
  items?: OrderItem[];
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

export const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderSummary[]>(
    () => pageCache.get<OrderSummary[]>('student:history') ?? []
  );
  const [loading, setLoading] = useState<boolean>(!pageCache.has('student:history'));
  const [error, setError] = useState<string>('');

  const todayStr = useMemo(() => getTodayStr(), []);
  const yesterdayStr = useMemo(() => getYesterdayStr(), []);
  
  // Selected date defaults to Today
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStr());

  const fetchHistory = useCallback(async (showLoading = false) => {
    const existing = localStorage.getItem('college_food_order_tokens');
    const tokens = existing ? JSON.parse(existing) : [];

    if (tokens.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      if (showLoading && !pageCache.has('student:history')) {
        setLoading(true);
        setError('');
      }
      const res = await studentApi.getOrderHistory(tokens);
      if (res.success) {
        const allOrders = res.orders || [];
        setOrders(allOrders);
        pageCache.set('student:history', allOrders);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoading && !pageCache.has('student:history')) {
        setError(err.response?.data?.message || 'Failed to retrieve order history.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // SSE: refresh instantly when any order changes
  useSSE({
    order_updated:       () => fetchHistory(false),
    order_cancelled:     () => fetchHistory(false),
    orders_cancelled_all:() => fetchHistory(false),
    order_created:       () => fetchHistory(false),
  });

  useEffect(() => {
    fetchHistory(true);
    // 30s fallback polling in case SSE drops
    const interval = setInterval(() => {
      fetchHistory(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const isOrderOnDate = (order: OrderSummary, targetDate: string) => {
    if (!targetDate) return false;
    if (order.businessDate && order.businessDate === targetDate) {
      return true;
    }
    const localDate = new Date(order.createdAt).toLocaleDateString('en-CA');
    return localDate === targetDate;
  };

  const todayOrders = useMemo(() => {
    return orders.filter((order) => isOrderOnDate(order, todayStr));
  }, [orders, todayStr]);

  const yesterdayOrders = useMemo(() => {
    return orders.filter((order) => isOrderOnDate(order, yesterdayStr));
  }, [orders, yesterdayStr]);

  const filteredOrders = useMemo(() => {
    if (!selectedDate) return [];
    return orders.filter((order) => isOrderOnDate(order, selectedDate));
  }, [orders, selectedDate]);

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
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <CheckCircle2 size={10} className="stroke-[2.5]" />
            Delivered
          </span>
        );
      case 'CANCELLED':
      case 'PAYMENT_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-600 border border-rose-200/60">
            <Ban size={10} className="stroke-[2.5]" />
            {status.toLowerCase().replace(/_/g, ' ')}
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200/60">
            Ready
          </span>
        );
      case 'PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200/60">
            <Clock size={10} className="stroke-[2.5]" />
            Payment Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-50 text-brand-700 border border-brand-200/60">
            {status.toLowerCase().replace(/_/g, ' ')}
          </span>
        );
    }
  };

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
          onClick={() => fetchHistory(true)}
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
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          title="Back to menu"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Your Order History
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            {selectedDate === todayStr
              ? `${todayOrders.length} order${todayOrders.length !== 1 ? 's' : ''} placed today`
              : selectedDate === yesterdayStr
              ? `${yesterdayOrders.length} order${yesterdayOrders.length !== 1 ? 's' : ''} placed yesterday`
              : selectedDate
              ? `${filteredOrders.length} order${filteredOrders.length !== 1 ? 's' : ''} on ${formatDisplayDate(selectedDate)}`
              : 'Search orders by past date'}
          </p>
        </div>
      </div>

      {/* Date Search Card at the Top */}
      {orders.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-premium mb-5">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Search size={14} className="text-brand-600" />
              Search by Date
            </span>
            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} />
                Today
              </button>
            )}
          </div>

          {/* Date Picker Input Bar */}
          <div className="relative flex items-center mb-3.5">
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold text-slate-800 outline-none transition-colors"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Reset to today"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs: Today & Yesterday directly below search input */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedDate === todayStr
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Today</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedDate === todayStr
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {todayOrders.length}
              </span>
            </button>

            <button
              onClick={() => setSelectedDate(yesterdayStr)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedDate === yesterdayStr
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Yesterday</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedDate === yesterdayStr
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {yesterdayOrders.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Orders List / Empty States */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center px-4 bg-white border border-slate-100 rounded-3xl shadow-premium">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <ClipboardList size={30} className="stroke-[1.5]" />
          </div>
          <p className="text-sm font-bold text-slate-700 mb-1">No Orders Found</p>
          <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
            You haven't placed any orders on this device yet. Ready for some delicious food?
          </p>
          <Link
            to="/"
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-brand-500/20 transition-all"
          >
            Order Now
          </Link>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4 bg-white border border-slate-100 rounded-3xl shadow-premium">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3">
            <Search size={24} />
          </div>
          <p className="text-sm font-extrabold text-slate-800 mb-1">
            {selectedDate === todayStr
              ? 'No Orders Today'
              : selectedDate === yesterdayStr
              ? 'No Orders Yesterday'
              : selectedDate
              ? `No Orders on ${formatDisplayDate(selectedDate)}`
              : 'Please Select a Date'}
          </p>
          <p className="text-slate-400 text-xs max-w-xs mb-5 leading-relaxed">
            {selectedDate === todayStr
              ? "You haven't placed any orders today yet."
              : selectedDate === yesterdayStr
              ? 'No orders were found for yesterday.'
              : selectedDate
              ? `No orders found on this device for ${formatDisplayDate(selectedDate)}.`
              : 'Pick any past date to view orders placed on that day.'}
          </p>

          {selectedDate === todayStr ? (
            <Link
              to="/"
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-brand-500/20 transition-all"
            >
              Order Now
            </Link>
          ) : (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md shadow-brand-500/20 transition-all"
            >
              View Today's Orders {todayOrders.length > 0 ? `(${todayOrders.length})` : ''}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {selectedDate && selectedDate !== todayStr && selectedDate !== yesterdayStr && (
            <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
              <span>
                Showing {filteredOrders.length} order{filteredOrders.length > 1 ? 's' : ''} for{' '}
                <strong className="text-slate-800">{formatDisplayDate(selectedDate)}</strong>
              </span>
            </div>
          )}

          {filteredOrders.map((order) => {
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
              : null;

            return (
              <div
                key={order.id}
                onClick={() =>
                  navigate(`/order/${order.publicOrderId}`, {
                    state: { token: order.trackingToken },
                  })
                }
                className="bg-white border border-slate-100 rounded-3xl p-5 shadow-premium hover:border-brand-200 hover:shadow-md transition-all cursor-pointer flex justify-between items-center group"
              >
                <div className="text-left flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-black text-sm text-slate-900 tracking-tight">
                      {order.publicOrderId}
                    </span>
                    {getStatusBadge(order.orderStatus)}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-2">
                    <Calendar size={12} className="shrink-0" />
                    <span>{dateStr}</span>
                  </div>

                  {itemsSummary && (
                    <p className="text-xs text-slate-600 font-medium truncate mb-2.5 max-w-[260px]">
                      {itemsSummary}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <span className={`font-black text-sm ${order.orderStatus === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-brand-700'}`}>
                      ₹{order.totalAmount}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {order.orderStatus === 'CANCELLED' ? (
                        <span className="text-rose-500 font-extrabold uppercase text-[9px] tracking-wider bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50">
                          {order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID' ? 'Refunded' : 'Cancelled'}
                        </span>
                      ) : order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING' ? (
                        <span className="text-amber-600 font-extrabold uppercase text-[9px] tracking-wider bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                          Cash on Delivery
                        </span>
                      ) : (
                        `(${order.paymentMethod})`
                      )}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center transition-all shrink-0">
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
