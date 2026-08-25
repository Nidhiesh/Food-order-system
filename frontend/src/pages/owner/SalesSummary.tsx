import React, { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import { pageCache } from '../../services/pageCache';
import { Loader, IndianRupee, CreditCard, Wallet, Calendar, TrendingUp, BarChart2 } from 'lucide-react';

interface SalesStats {
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  totalSales: number;
  codSales: number;
  onlineSales: number;
}

interface OrderItem {
  name: string;
  quantity: number;
}

interface PaidOrder {
  id: string;
  publicOrderId: string;
  customerName: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  items: OrderItem[];
}

export const SalesSummary: React.FC = () => {
  const [stats, setStats] = useState<SalesStats | null>(
    () => pageCache.get<SalesStats>('sales:stats') ?? null
  );
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>(
    () => pageCache.get<PaidOrder[]>('sales:orders') ?? []
  );
  const [loading, setLoading] = useState<boolean>(!pageCache.has('sales:stats'));
  const [error, setError] = useState<string>('');

  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading && !pageCache.has('sales:stats')) {
        setLoading(true);
        setError('');
      }

      const [statsRes, ordersRes] = await Promise.all([
        ownerApi.getSalesSummary(),
        ownerApi.getTodayOrders(),
      ]);

      if (statsRes.success) {
        setStats(statsRes.summary);
        pageCache.set('sales:stats', statsRes.summary);
      }

      if (ordersRes.success) {
        const paid = (ordersRes.orders || []).filter(
          (o: any) => o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED'
        );
        setPaidOrders(paid);
        pageCache.set('sales:orders', paid);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoading && !pageCache.has('sales:stats')) {
        setError(err.response?.data?.message || 'Failed to load sales information.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // SSE: refresh on any order change
  useSSE({
    order_updated:        () => loadData(false),
    order_cancelled:      () => loadData(false),
    orders_cancelled_all: () => loadData(false),
    order_created:        () => loadData(false),
  });

  useEffect(() => {
    loadData(true);
    // 30s fallback polling
    const interval = setInterval(() => loadData(false), 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader className="animate-spin mb-3 stroke-[1.5]" size={32} />
        <span className="text-sm font-medium">Computing sales sheet...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Ledger</h1>
        <p className="text-slate-500 text-xs mt-1">Today's completed revenue splits and receipts log</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Sales */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Gross Earnings</span>
            <span className="text-3xl font-black text-slate-900 block mb-1.5 flex items-center gap-0.5">
              <IndianRupee size={22} className="text-emerald-600" />
              {stats?.totalSales || 0}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Processed today</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Online Shares */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Online Payment Split</span>
            <span className="text-2xl font-black text-slate-900 block mb-1.5 flex items-center gap-0.5">
              <IndianRupee size={18} className="text-sky-600" />
              {stats?.onlineSales || 0}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Via Razorpay Gateway</span>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
            <CreditCard size={24} />
          </div>
        </div>

        {/* COD Shares */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Cash Payment Split</span>
            <span className="text-2xl font-black text-slate-900 block mb-1.5 flex items-center gap-0.5">
              <IndianRupee size={18} className="text-amber-600" />
              {stats?.codSales || 0}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Collected by delivery Omni</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      {/* Sales Log Table */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <BarChart2 size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Transactions Log</h3>
            <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Paid order records contributing to sales</p>
          </div>
        </div>

        {paidOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-semibold">
            No completed sales recorded for today's business date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-slate-700 text-left border-collapse">
              <thead>
                <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Items Snapshot</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paidOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-all">
                    <td className="py-3.5 font-bold text-slate-900 text-xs">
                      {order.publicOrderId}
                      <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-800 text-xs font-semibold">
                      {order.customerName}
                    </td>
                    <td className="py-3.5 text-[11px] text-slate-500 max-w-xs truncate">
                      {order.items.map(i => `${i.name} (${i.quantity})`).join(', ')}
                    </td>
                    <td className="py-3.5 text-[10px] font-extrabold uppercase text-slate-500">
                      {order.paymentMethod}
                    </td>
                    <td className="py-3.5 text-right font-black text-emerald-600 text-sm">
                      ₹{order.totalAmount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
