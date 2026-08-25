import React, { useEffect, useState } from 'react';
import { ownerApi } from '../../services/api';
import { useOutletContext } from 'react-router-dom';
import { Loader, Settings, Clock, HelpCircle, Store, ToggleLeft, ToggleRight, CheckCircle, ShieldAlert } from 'lucide-react';

export const ShopControl: React.FC = () => {
  const { 
    shopOpen, 
    setShopOpen, 
    setShopStatusText, 
    shopState, 
    setShopState, 
    fetchShopStatus 
  } = useOutletContext<{ 
    shopOpen: boolean;
    setShopOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setShopStatusText: React.Dispatch<React.SetStateAction<string>>;
    shopState: any;
    setShopState: React.Dispatch<React.SetStateAction<any>>;
    fetchShopStatus: () => Promise<void>;
  }>();
  
  const [loading, setLoading] = useState<boolean>(!shopState);
  const [error, setError] = useState<string>('');
  
  const [openTime, setOpenTime] = useState<string>('08:00');
  const [closeTime, setCloseTime] = useState<string>('11:00');
  const [cutoffTime, setCutoffTime] = useState<string>('11:00');
  
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (!shopState) {
      fetchShopStatus();
    }
  }, []);

  useEffect(() => {
    if (shopState) {
      setOpenTime(shopState.openingTime || '08:00');
      setCloseTime(shopState.closingTime || '11:00');
      setCutoffTime(shopState.cancellationCutoff || '11:00');
      setLoading(false);
    }
  }, [shopState]);

  const handleToggleManual = async () => {
    if (!shopState) return;

    const prevManualClosed = shopState.manualClosed;
    const nextManualClosed = !prevManualClosed;
    
    // 1. Optimistic local state update
    setShopState((prev: any) => prev ? { ...prev, manualClosed: nextManualClosed } : null);
    
    // 2. Optimistic shopOpen (sidebar status) update
    let isCurrentlyOpen = false;
    if (!nextManualClosed) {
      const now = new Date();
      // Adjust to IST
      const kolkataTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const hour = kolkataTime.getHours();
      const minute = kolkataTime.getMinutes();
      const currentMinutes = hour * 60 + minute;

      const [startHour, startMin] = openTime.split(':').map(Number);
      const [endHour, endMin] = closeTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      isCurrentlyOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    
    setShopOpen(isCurrentlyOpen);
    setShopStatusText(nextManualClosed ? 'The shop is currently not accepting orders.' : 'Shop Open');

    try {
      if (prevManualClosed) {
        await ownerApi.openShop();
      } else {
        await ownerApi.closeShop();
      }
      // Sync from backend in the background
      fetchShopStatus();
    } catch (err) {
      // Rollback on error
      setShopState((prev: any) => prev ? { ...prev, manualClosed: prevManualClosed } : null);
      setShopOpen(!prevManualClosed);
      setShopStatusText(prevManualClosed ? 'The shop is currently not accepting orders.' : 'Shop Open');
      alert('Failed to toggle manual shop override');
    }
  };

  const handleSaveTimes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const res = await ownerApi.updateShopConfig({
        openingTime: openTime,
        closingTime: closeTime,
        cancellationCutoff: cutoffTime,
      });

      if (res.success) {
        setSuccess('Operational hours and cut-offs updated successfully.');
        setShopState(res.shopState);
        await fetchShopStatus();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update shop timings.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !shopState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader className="animate-spin mb-3 stroke-[1.5]" size={32} />
        <span className="text-sm font-medium">Loading rules engine...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shop Controls & Rules</h1>
        <p className="text-slate-500 text-xs mt-1">Configure business date schedules and manual closure overrides</p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200/60 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Manual Override controls */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Store size={16} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Manual Override</h3>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Override scheduled timers</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              If you close the shop manually, student orders will be blocked immediately regardless of operational timers. 
              <strong> Manual closure overrides normal hours.</strong>
            </p>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs font-extrabold text-slate-900 block">Manual Shutdown</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider block mt-0.5 ${
                  shopState.manualClosed ? 'text-rose-600' : 'text-slate-400'
                }`}>
                  {shopState.manualClosed ? 'Closed Override Active' : 'Off (Following Schedule)'}
                </span>
              </div>
              
              <button
                onClick={handleToggleManual}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={shopState.manualClosed ? 'Open Shop' : 'Close Shop'}
              >
                {shopState.manualClosed ? (
                  <ToggleRight size={36} className="text-rose-500" />
                ) : (
                  <ToggleLeft size={36} className="text-slate-300" />
                )}
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 mt-8">
            <HelpCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-700 block uppercase mb-0.5">Rules Reset</span>
              <span className="text-[10px] text-slate-400 block leading-relaxed">
                Shop manual closure and stock quantities reset automatically at the start of each business date.
              </span>
            </div>
          </div>
        </div>

        {/* Timers configuration form */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Operational Schedulers</h3>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Configure daily automatic timing rules</p>
            </div>
          </div>

          <form onSubmit={handleSaveTimes} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Opening hour */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Automatic Opening Hour</label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold outline-none text-slate-900 transition-colors"
                  required
                />
              </div>

              {/* Closing hour */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Automatic Closing Hour</label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold outline-none text-slate-900 transition-colors"
                  required
                />
              </div>

              {/* Cancellation cutoff */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Order Cancellation Cut-off Hour</label>
                <input
                  type="time"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-2xl text-xs font-semibold outline-none text-slate-900 transition-colors"
                  required
                />
                <span className="text-[10px] text-slate-400 font-semibold block mt-1.5 leading-snug">
                  Students cannot cancel order items after this hour. Defaults to closing hour (11:00 AM).
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-2xl shadow-md shadow-brand-500/20 text-center transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  Updating schedulers...
                </>
              ) : (
                <>
                  <Settings size={16} />
                  Save Timing Rules
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
