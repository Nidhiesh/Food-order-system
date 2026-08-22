import React, { useEffect, useState } from 'react';
import { ownerApi } from '../../services/api';
import { 
  ClipboardList, 
  IndianRupee, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert,
  Loader,
  ChefHat
} from 'lucide-react';

interface PrepSummaryItem {
  name: string;
  quantity: number;
}

interface SalesSummary {
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  totalSales: number;
  codSales: number;
  onlineSales: number;
}

export const Dashboard: React.FC = () => {
  const [prepSummary, setPrepSummary] = useState<PrepSummaryItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [codPendingCount, setCodPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [prepRes, salesRes, codRes] = await Promise.all([
        ownerApi.getPreparationSummary(),
        ownerApi.getSalesSummary(),
        ownerApi.getCodPendingOrders(),
      ]);

      if (prepRes.success) setPrepSummary(prepRes.summary || []);
      if (salesRes.success) setSalesSummary(salesRes.summary);
      if (codRes.success) setCodPendingCount(codRes.orders?.length || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !salesSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader className="animate-spin mb-3" size={32} />
        <span className="text-sm font-medium">Loading metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-sm flex items-center gap-2">
        <ShieldAlert size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Sales",
      value: `₹${salesSummary?.totalSales || 0}`,
      desc: "Delivered & paid orders",
      icon: IndianRupee,
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Total Orders",
      value: salesSummary?.totalOrders || 0,
      desc: `Confirmed: ${salesSummary?.confirmedOrders || 0}`,
      icon: ClipboardList,
      color: "bg-brand-500/10 text-brand-400 border-brand-500/20",
    },
    {
      title: "COD Pending",
      value: codPendingCount,
      desc: "Awaiting delivery confirmation",
      icon: TrendingDown,
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    {
      title: "Cancelled Orders",
      value: salesSummary?.cancelledOrders || 0,
      desc: "Restored to stock",
      icon: ShieldAlert,
      color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Today's Overview</h1>
        <p className="text-slate-400 text-xs mt-1">Live operational statistics & preparation summary</p>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx} 
              className={`bg-slate-900 border rounded-3xl p-6 flex items-center justify-between ${card.color} shadow-lg`}
            >
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block mb-1">{card.title}</span>
                <span className="text-2xl font-black text-white block mb-1">{card.value}</span>
                <span className="text-[10px] text-slate-500 font-semibold">{card.desc}</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-2xl">
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kitchen preparation summary card */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                <ChefHat size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Kitchen Preparation</h3>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Required item counts for today</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-brand-600/10 text-brand-400 text-[10px] font-bold">LIVE UPDATE</span>
          </div>

          {prepSummary.length === 0 ? (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center gap-2">
              <Flame className="stroke-[1.5]" size={36} />
              <span className="text-xs font-semibold">No food item preparation required yet.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {prepSummary.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl hover:border-slate-800 transition-all"
                >
                  <span className="font-extrabold text-sm text-slate-200">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-semibold">Quantity</span>
                    <span className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-black text-sm">
                      {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales split breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 mb-6">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Revenue Splits</h3>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">By Payment Gateway</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Online Paid */}
              <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block">Online (Razorpay)</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Instant settlement</span>
                </div>
                <span className="font-black text-white text-base">₹{salesSummary?.onlineSales || 0}</span>
              </div>

              {/* COD */}
              <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block">Cash on Delivery</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Paid upon receipt</span>
                </div>
                <span className="font-black text-white text-base">₹{salesSummary?.codSales || 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Aggregated local time</span>
            <span>Asia/Kolkata</span>
          </div>
        </div>
      </div>
    </div>
  );
};
