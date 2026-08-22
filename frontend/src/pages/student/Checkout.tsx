import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { studentApi } from '../../services/api';
import { ArrowLeft, User, Phone, School, Wallet, CreditCard, ShieldCheck, Loader } from 'lucide-react';

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();

  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [deptClass, setDeptClass] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Mock modal state
  const [showMockModal, setShowMockModal] = useState<boolean>(false);
  const [mockOrderDetails, setMockOrderDetails] = useState<any>(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleOnlinePayment = async (orderRes: any) => {
    const isScriptLoaded = await loadRazorpayScript();
    
    // If Razorpay script fails or it's a mock order
    if (!isScriptLoaded || orderRes.razorpayOrder.isMock) {
      console.log('[Payments] Switched to Mock Payment dialog (mock mode or network offline).');
      setMockOrderDetails(orderRes);
      setShowMockModal(true);
      return;
    }

    // Real Razorpay integration
    const rzpOrder = orderRes.razorpayOrder;
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mock',
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: 'Campus Bites',
      description: 'College Lunch Order',
      order_id: rzpOrder.id,
      handler: async (response: any) => {
        try {
          setLoading(true);
          const verifyRes = await studentApi.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (verifyRes.success) {
            // Save token
            saveToken(orderRes.trackingToken);
            clearCart();
            navigate(`/order/${orderRes.publicOrderId}`, { state: { token: orderRes.trackingToken } });
          }
        } catch (err: any) {
          setError(err.response?.data?.message || 'Payment verification failed. Contact shop owner.');
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name,
        contact: phone,
      },
      theme: {
        color: '#c14157',
      },
    };

    const paymentObject = new (window as any).Razorpay(options);
    paymentObject.open();
  };

  const simulateMockPayment = async (success: boolean) => {
    setShowMockModal(false);
    if (!success) {
      setError('Payment cancelled by student.');
      return;
    }

    try {
      setLoading(true);
      const verifyRes = await studentApi.verifyPayment({
        razorpay_order_id: mockOrderDetails.razorpayOrder.id,
        razorpay_payment_id: 'pay_mock_success',
        razorpay_signature: 'mock_sig_hash_validated_locally',
      });

      if (verifyRes.success) {
        saveToken(mockOrderDetails.trackingToken);
        clearCart();
        navigate(`/order/${mockOrderDetails.publicOrderId}`, { state: { token: mockOrderDetails.trackingToken } });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mock payment verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const saveToken = (token: string) => {
    const existing = localStorage.getItem('college_food_order_tokens');
    const tokens = existing ? JSON.parse(existing) : [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      localStorage.setItem('college_food_order_tokens', JSON.stringify(tokens));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name');
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Please enter a valid 10-digit Indian mobile number');
    if (!deptClass.trim()) return setError('Please enter your Department/Class');

    try {
      setLoading(true);
      setError('');

      const payload = {
        customerName: name,
        customerPhone: phone,
        departmentClass: deptClass,
        paymentMethod,
        items: cartItems.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
      };

      const res = await studentApi.createOrder(payload);

      if (res.success) {
        if (paymentMethod === 'COD') {
          saveToken(res.trackingToken);
          clearCart();
          navigate(`/order/${res.publicOrderId}`, { state: { token: res.trackingToken } });
        } else {
          // Handle Online payment gateway
          await handleOnlinePayment(res);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to place order. Try again.');
    } finally {
      // Don't stop loading if mock modal is open
      if (!showMockModal) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="animate-slide-up relative">
      {/* Header back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/cart')}
          className="w-10 h-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Checkout Details
        </h2>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Customer Information Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Student Information
          </h3>

          {/* Name */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Full Name</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <User size={16} />
              </span>
              <input
                type="text"
                placeholder="Ex. Rahul Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:border-brand-500 rounded-2xl text-sm font-medium transition-colors outline-none text-slate-900"
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Mobile Number</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Phone size={16} />
              </span>
              <input
                type="tel"
                placeholder="Ex. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:border-brand-500 rounded-2xl text-sm font-medium transition-colors outline-none text-slate-900"
                required
              />
            </div>
          </div>

          {/* Department / Class */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Department & Class</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <School size={16} />
              </span>
              <input
                type="text"
                placeholder="Ex. CSE - 3rd Year"
                value={deptClass}
                onChange={(e) => setDeptClass(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:border-brand-500 rounded-2xl text-sm font-medium transition-colors outline-none text-slate-900"
                required
              />
            </div>
          </div>
        </div>

        {/* Payment Method Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Choose Payment Method
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* COD */}
            <label className={`border rounded-3xl p-4 flex flex-col gap-2 items-center cursor-pointer transition-all ${
              paymentMethod === 'COD' 
                ? 'border-brand-600 bg-brand-50/50 text-brand-900 shadow-sm' 
                : 'border-slate-100 hover:bg-slate-50 text-slate-600'
            }`}>
              <input
                type="radio"
                name="payment"
                value="COD"
                checked={paymentMethod === 'COD'}
                onChange={() => setPaymentMethod('COD')}
                className="sr-only"
              />
              <Wallet size={24} className={paymentMethod === 'COD' ? 'text-brand-600' : 'text-slate-400'} />
              <span className="text-xs font-bold">Cash on Delivery</span>
            </label>

            {/* Online */}
            <label className={`border rounded-3xl p-4 flex flex-col gap-2 items-center cursor-pointer transition-all ${
              paymentMethod === 'ONLINE' 
                ? 'border-brand-600 bg-brand-50/50 text-brand-900 shadow-sm' 
                : 'border-slate-100 hover:bg-slate-50 text-slate-600'
            }`}>
              <input
                type="radio"
                name="payment"
                value="ONLINE"
                checked={paymentMethod === 'ONLINE'}
                onChange={() => setPaymentMethod('ONLINE')}
                className="sr-only"
              />
              <CreditCard size={24} className={paymentMethod === 'ONLINE' ? 'text-brand-600' : 'text-slate-400'} />
              <span className="text-xs font-bold">UPI / Cards / Net</span>
            </label>
          </div>
        </div>

        {/* Place Order CTA Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-3xl shadow-lg shadow-brand-500/20 text-center transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] disabled:bg-slate-300 disabled:shadow-none"
        >
          {loading ? (
            <>
              <Loader className="animate-spin" size={18} />
              Processing...
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              Place Order (₹{getCartTotal()})
            </>
          )}
        </button>
      </form>

      {/* MOCK PAYMENT MODAL DIALOG */}
      {showMockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 animate-slide-up text-center">
            <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
              <CreditCard size={28} />
            </div>

            <h3 className="text-lg font-black text-slate-900 mb-1">Razorpay Sandbox</h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-4">
              Local Development Simulation
            </span>

            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              You are running in sandbox mode because mock key is configured. Select simulated payment action:
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => simulateMockPayment(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                Simulate Payment SUCCESS
              </button>
              
              <button
                onClick={() => simulateMockPayment(false)}
                className="w-full py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-sm rounded-2xl transition-all cursor-pointer"
              >
                Simulate Payment CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
