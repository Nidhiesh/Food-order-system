import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { studentApi } from '../../services/api';
import { Loader, AlertTriangle, ArrowLeft, RefreshCw, Clock, Ban, CheckCircle, Package } from 'lucide-react';

export const OrderDetails: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve token from route state or URL params
  const [token, setToken] = useState<string>(() => {
    const stateToken = (location.state as any)?.token;
    if (stateToken) return stateToken;
    
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('token') || '';
  });

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancellationCutoff, setCancellationCutoff] = useState<string>('11:00');

  const fetchShopStatus = async () => {
    try {
      const res = await studentApi.getShopStatus();
      if (res.success && res.cancellationCutoff) {
        setCancellationCutoff(res.cancellationCutoff);
      }
    } catch (err) {
      console.error('Failed to fetch shop status in order details', err);
    }
  };

  const fetchOrderDetails = async () => {
    if (!orderId || !token) {
      setError('Missing order ID or access token.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await studentApi.getOrderDetails(orderId, token);
      if (res.success) {
        setOrder(res.order);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
    fetchShopStatus();
  }, [orderId, token]);

  const handleCancelOrder = async () => {
    try {
      setCancelling(true);
      const res = await studentApi.cancelOrder(orderId!, token, cancelReason);
      if (res.success) {
        setShowCancelModal(false);
        fetchOrderDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Loader className="animate-spin mb-3" size={32} />
        <span className="text-sm font-medium">Fetching order status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 animate-fade-in">
        <AlertTriangle className="text-rose-500 mb-4" size={40} />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-xs mb-6 leading-relaxed">{error}</p>
        <Link
          to="/"
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-6 py-2.5 rounded-2xl shadow-md transition-all cursor-pointer"
        >
          Back to Menu
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-emerald-500 text-emerald-600 border-emerald-100';
      case 'CANCELLED': 
      case 'PAYMENT_FAILED': return 'bg-rose-500 text-rose-600 border-rose-100';
      case 'READY': return 'bg-amber-500 text-amber-600 border-amber-100';
      default: return 'bg-brand-600 text-brand-600 border-brand-100';
    }
  };

  // Determine if student can cancel the order
  const isCancellable = () => {
    if (!order) return false;
    const isCorrectStatus = order.orderStatus === 'CONFIRMED' || order.orderStatus === 'PENDING_PAYMENT';
    // Check if it belongs to today
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayStr = formatter.format(new Date());
    const isToday = order.businessDate === todayStr;
    
    if (!isCorrectStatus || !isToday) return false;

    // Enforce cancellation cutoff time using Kolkata timezone
    const [cutoffHour, cutoffMin] = cancellationCutoff.split(':').map(Number);
    const utcDate = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    const formatterTime = new Intl.DateTimeFormat('en-US', options);
    const parts = formatterTime.formatToParts(utcDate);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const hour = parseInt(getPart('hour'));
    const minute = parseInt(getPart('minute'));

    const currentMinutes = hour * 60 + minute;
    const cutoffMinutes = cutoffHour * 60 + cutoffMin;

    return currentMinutes < cutoffMinutes;
  };

  // Stepper statuses
  const steps = ['CONFIRMED', 'DELIVERED'];
  const getStepIndex = (status: string) => {
    if (status === 'PENDING_PAYMENT') return -1;
    if (status === 'CANCELLED' || status === 'PAYMENT_FAILED') return -2;
    return steps.indexOf(status);
  };

  const currentStepIndex = getStepIndex(order.orderStatus);

  return (
    <div className="animate-slide-up">
      {/* Back button header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/orders')}
            className="w-10 h-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">Order Details</h2>
            <span className="text-xs text-slate-400 font-semibold">{order.publicOrderId}</span>
          </div>
        </div>

        <button
          onClick={fetchOrderDetails}
          className="w-10 h-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
          title="Refresh status"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Dynamic Order Status Stepper */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium mb-6">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Order Status</span>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${getStatusColor(order.orderStatus)} bg-opacity-10`}>
            {order.orderStatus.replace(/_/g, ' ')}
          </span>
        </div>

        {currentStepIndex === -2 ? (
          // Cancelled view
          <div className="flex items-center gap-4 p-4 bg-rose-50 rounded-2xl text-rose-700">
            <Ban size={24} className="shrink-0" />
            <div className="text-left">
              <span className="font-extrabold text-sm block">Order Cancelled</span>
              <span className="text-xs text-rose-600 block leading-snug">
                Reason: {order.cancellationReason || 'No reason provided'}
              </span>
            </div>
          </div>
        ) : currentStepIndex === -1 ? (
          // Online payment pending view
          <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl text-amber-700">
            <Clock size={24} className="shrink-0 animate-pulse-slow" />
            <div className="text-left">
              <span className="font-extrabold text-sm block">Payment Pending</span>
              <span className="text-xs text-amber-600 block leading-snug">
                Please complete the payment callback via checkout.
              </span>
            </div>
          </div>
        ) : (
          // Standard stepper progress
          <div className="relative flex items-center justify-between w-full mt-4 mb-2">
            {/* Background line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 z-0"></div>
            {/* Active progress line */}
            <div 
              className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-brand-600 z-0 transition-all duration-500"
              style={{ width: `${currentStepIndex >= 0 ? (currentStepIndex / (steps.length - 1)) * 90 : 0}%` }}
            ></div>

            {steps.map((step, idx) => {
              const isActive = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step} className="flex flex-col items-center z-10 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive 
                      ? 'bg-brand-600 border-brand-600 text-white font-bold' 
                      : 'bg-white border-slate-200 text-slate-400'
                  } ${isCurrent ? 'ring-4 ring-brand-100 scale-110' : ''}`}>
                    {idx === 3 && isActive ? (
                      <CheckCircle size={14} className="stroke-[3]" />
                    ) : (
                      <span className="text-xs">{idx + 1}</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${
                    isActive ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {step === 'CONFIRMED' ? 'Placed' : step.toLowerCase()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium mb-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Order Items
        </h3>

        <div className="flex flex-col gap-3.5 pb-4 border-b border-slate-50 mb-4">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div className="text-slate-800">
                <span className="font-bold">{item.name}</span>
                <span className="text-slate-400 text-xs font-semibold ml-1.5">× {item.quantity}</span>
              </div>
              <span className="font-extrabold text-slate-900">₹{item.subtotal}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm font-semibold text-slate-600 mb-2">
          <span>Payment Method</span>
          <span className="text-slate-900 font-bold">{order.paymentMethod}</span>
        </div>

        <div className="flex items-center justify-between text-sm font-semibold text-slate-600 pb-4 border-b border-slate-50 mb-4">
          <span>Payment Status</span>
          <span className={`font-extrabold uppercase text-xs ${
            order.paymentStatus === 'PAID' ? 'text-emerald-500' : 'text-slate-400'
          }`}>
            {order.paymentStatus}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-900 text-sm">Total Paid</span>
          <span className="text-base font-black text-brand-700">₹{order.totalAmount}</span>
        </div>
      </div>

      {/* Student customer details */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium mb-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Delivery Details
        </h3>
        <p className="text-slate-800 text-sm font-bold mb-1">{order.customerName}</p>
        <p className="text-slate-500 text-xs font-semibold mb-2">{order.customerPhone}</p>
        {order.departmentClass && (
          <p className="text-slate-400 text-xs font-medium bg-slate-50 px-2.5 py-1 rounded-xl inline-block">
            {order.departmentClass}
          </p>
        )}
      </div>

      {/* Cancellation section */}
      {isCancellable() && (
        <button
          onClick={() => setShowCancelModal(true)}
          className="w-full py-4 border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold rounded-3xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Ban size={16} />
          Cancel Order
        </button>
      )}

      {/* CANCELLATION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 animate-slide-up text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-2">Cancel Order?</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Are you sure you want to cancel this order? This action will immediately release the reserved food items back to stock and cannot be undone.
            </p>

            <label className="text-xs font-bold text-slate-600 mb-1 block">Reason for cancellation</label>
            <input
              type="text"
              placeholder="Ex. Ordered wrong item"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 focus:border-rose-500 rounded-2xl text-xs font-medium transition-colors outline-none text-slate-900 mb-5"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Go Back
              </button>
              
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl hover:shadow-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                {cancelling ? (
                  <Loader className="animate-spin" size={12} />
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
