import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Store, Clock, RefreshCw } from 'lucide-react';
import { studentApi } from '../../services/api';

export const ShopClosed: React.FC = () => {
  const location = useLocation();
  const state = location.state as { 
    message?: string;
    openingTime?: string;
    closingTime?: string;
    cancellationCutoff?: string;
  } | null;

  const [message, setMessage] = useState<string>(state?.message || 'Ordering is currently unavailable.');
  const [openingTime, setOpeningTime] = useState<string>(state?.openingTime || '08:00');
  const [closingTime, setClosingTime] = useState<string>(state?.closingTime || '11:00');
  const [cancellationCutoff, setCancellationCutoff] = useState<string>(state?.cancellationCutoff || '11:00');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await studentApi.getShopStatus();
        if (res.success) {
          if (res.status.message) setMessage(res.status.message);
          if (res.openingTime) setOpeningTime(res.openingTime);
          if (res.closingTime) setClosingTime(res.closingTime);
          if (res.cancellationCutoff) setCancellationCutoff(res.cancellationCutoff);
        }
      } catch (err) {
        console.error('Failed to fetch shop status in closed page', err);
      }
    };
    fetchStatus();
  }, []);

  const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hourStr, minStr] = timeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minStr} ${ampm}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 shadow-inner">
        <Store size={40} className="stroke-[1.5]" />
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 text-xs font-bold uppercase tracking-wider mb-4 border border-rose-500/10">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
        Shop Closed
      </span>

      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-3">
        Ordering is Unavailable
      </h1>
      
      <p className="text-slate-500 max-w-xs text-sm leading-relaxed mb-8">
        {message}
      </p>

      {/* Operational Information card */}
      <div className="w-full bg-white border border-slate-100 rounded-3xl p-6 shadow-premium mb-8 text-left">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Clock size={14} />
          Normal Operating Hours
        </h3>
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
          <span className="text-sm font-medium text-slate-600">Daily Operations</span>
          <span className="text-sm font-bold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-xl">
            {formatTime12h(openingTime)} – {formatTime12h(closingTime)}
          </span>
        </div>
        
        <div className="flex items-center justify-between pt-3">
          <span className="text-sm font-medium text-slate-600">Cancellation Cutoff</span>
          <span className="text-sm font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-xl">
            Before {formatTime12h(cancellationCutoff)}
          </span>
        </div>
      </div>

      <button
        onClick={() => window.location.href = '/'}
        className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-semibold text-sm transition-colors cursor-pointer"
      >
        <RefreshCw size={16} />
        Check Status Again
      </button>
    </div>
  );
};
