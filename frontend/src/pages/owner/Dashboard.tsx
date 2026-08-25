import React, { useEffect, useState, useCallback } from 'react';
import { ownerApi } from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import { pageCache } from '../../services/pageCache';
import { 
  ClipboardList, 
  IndianRupee, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert,
  Loader,
  ChefHat,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';

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
  grossAmount: number;
  totalLoss: number;
  outstandingCod: number;
  businessDate: string;
}

export const Dashboard: React.FC = () => {
  const [prepSummary, setPrepSummary] = useState<PrepSummaryItem[]>(
    () => pageCache.get<PrepSummaryItem[]>('dashboard:prep') ?? []
  );
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(
    () => pageCache.get<SalesSummary>('dashboard:sales') ?? null
  );
  const [codPendingCount, setCodPendingCount] = useState<number>(
    () => pageCache.get<number>('dashboard:cod') ?? 0
  );
  // Only show spinner on genuine first load (cache empty)
  const [loading, setLoading] = useState<boolean>(!pageCache.has('dashboard:sales'));
  const [error, setError] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      // Only show full spinner on first load
      if (!pageCache.has('dashboard:sales')) setLoading(true);
      setError('');

      const [prepRes, salesRes, codRes] = await Promise.all([
        ownerApi.getPreparationSummary(),
        ownerApi.getSalesSummary(),
        ownerApi.getCodPendingOrders(),
      ]);

      if (prepRes.success) {
        const prep = prepRes.summary || [];
        setPrepSummary(prep);
        pageCache.set('dashboard:prep', prep);
      }
      if (salesRes.success) {
        const sales = { ...salesRes.summary, businessDate: salesRes.businessDate };
        setSalesSummary(sales);
        pageCache.set('dashboard:sales', sales);
      }
      if (codRes.success) {
        const count = codRes.orders?.length || 0;
        setCodPendingCount(count);
        pageCache.set('dashboard:cod', count);
      }
    } catch (err: any) {
      console.error(err);
      if (!pageCache.has('dashboard:sales')) {
        setError(err.response?.data?.message || 'Failed to load dashboard metrics.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE: refresh dashboard numbers instantly on any relevant event
  useSSE({
    order_created:        () => loadData(),
    order_updated:        () => loadData(),
    order_cancelled:      () => loadData(),
    orders_cancelled_all: () => loadData(),
  });

  useEffect(() => {
    loadData();
    // 30s fallback polling in case SSE connection drops
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const downloadPDFReport = () => {
    if (!salesSummary) return;

    const reportDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const reportTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // -------------------------------------------------------------
    // HEADER BANNER
    // -------------------------------------------------------------
    // Slate-900 Background banner
    doc.setFillColor(15, 23, 42);
    doc.rect(20, 15, 170, 22, 'F');

    // Title left
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('CAMPUS BITES', 25, 23);
    
    // Subtitle left
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text('College Food Ordering System', 25, 29);

    // Title right
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('DAILY OPERATIONS LEDGER', 185, 23, { align: 'right' });

    // Date right
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Date: ${reportDate}`, 185, 29, { align: 'right' });

    // -------------------------------------------------------------
    // METADATA BOX
    // -------------------------------------------------------------
    // Slate-50 Background, Slate-200 Border
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(20, 42, 170, 16, 'FD');

    // Meta labels and values
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('GENERATION TIME', 25, 48);
    doc.text('BUSINESS DATE', 85, 48);
    doc.text('SYSTEM STATUS', 145, 48);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`${reportTime} (Asia/Kolkata)`, 25, 53);
    doc.text(`${salesSummary.businessDate}`, 85, 53);
    doc.text('OPERATIONAL', 145, 53);

    // -------------------------------------------------------------
    // METRICS GRID (Cards)
    // -------------------------------------------------------------
    // Card 1: Total Sales (Paid)
    doc.setFillColor(240, 253, 250); // emerald-50
    doc.setDrawColor(204, 251, 241); // emerald-100
    doc.rect(20, 64, 53, 20, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(13, 148, 136); // emerald-600
    doc.text('TOTAL REALISED INCOME', 24, 70);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${salesSummary.totalSales.toLocaleString('en-IN')}`, 24, 78);

    // Card 2: Total Orders Placed
    doc.setFillColor(240, 249, 255); // sky-50
    doc.setDrawColor(224, 242, 254); // sky-100
    doc.rect(78.5, 64, 53, 20, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(3, 105, 161); // sky-700
    doc.text('TOTAL ORDERS PLACED', 82.5, 70);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${salesSummary.totalOrders} Orders`, 82.5, 78);

    // Card 3: COD Pending Orders
    doc.setFillColor(255, 251, 235); // amber-50
    doc.setDrawColor(254, 243, 199); // amber-100
    doc.rect(137, 64, 53, 20, 'FD');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('COD PENDING ORDERS', 141, 70);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${codPendingCount} Orders`, 141, 78);

    // -------------------------------------------------------------
    // FINANCIAL BREAKDOWN TABLE
    // -------------------------------------------------------------
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('FINANCIAL BREAKDOWN & REVENUE SPLITS', 20, 92);
    
    // Header underline
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(20, 94, 190, 94);

    // Table Header Row
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(20, 97, 170, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('Revenue Stream', 24, 102);
    doc.text('Description / Method', 70, 102);
    doc.text('Amount (INR)', 185, 102, { align: 'right' });

    // Table Data Rows
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.setLineWidth(0.1);
    doc.setDrawColor(226, 232, 240); // slate-200

    // Row 1: Online Payments
    doc.text('Online Payments', 24, 109);
    doc.setTextColor(100, 116, 139);
    doc.text('Razorpay Settlement (Realised)', 70, 109);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${salesSummary.onlineSales.toLocaleString('en-IN')}`, 185, 109, { align: 'right' });
    doc.line(20, 112, 190, 112);

    // Row 2: Cash on Delivery
    doc.text('Cash on Delivery (COD)', 24, 117);
    doc.setTextColor(100, 116, 139);
    doc.text('Cash Collected (Realised)', 70, 117);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${salesSummary.codSales.toLocaleString('en-IN')}`, 185, 117, { align: 'right' });
    doc.line(20, 120, 190, 120);

    // Row 3: Outstanding COD
    doc.text('Outstanding COD', 24, 125);
    doc.setTextColor(100, 116, 139);
    doc.text('Awaiting dispatch / delivery', 70, 125);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${salesSummary.outstandingCod.toLocaleString('en-IN')}`, 185, 125, { align: 'right' });
    doc.line(20, 128, 190, 128);

    // Row 4: Loss/Failed
    doc.text('Failed Checkout Loss', 24, 133);
    doc.setTextColor(100, 116, 139);
    doc.text('Payment Failed / Abandoned orders', 70, 133);
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${salesSummary.totalLoss.toLocaleString('en-IN')}`, 185, 133, { align: 'right' });
    doc.line(20, 136, 190, 136);

    // Row 5: Gross Value (Total)
    doc.setFont('Helvetica', 'bold');
    doc.text('Gross Orders Value', 24, 142);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Aggregate value of all orders combined', 70, 142);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`INR ${salesSummary.grossAmount.toLocaleString('en-IN')}`, 185, 142, { align: 'right' });
    doc.line(20, 145, 190, 145);

    // -------------------------------------------------------------
    // KITCHEN PREPARATION TABLE
    // -------------------------------------------------------------
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('KITCHEN PREPARATION REQUIRED TODAY', 20, 155);
    
    // Header underline
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(20, 157, 190, 157);

    // Table Header Row
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 160, 170, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('S.No.', 24, 165);
    doc.text('Food Item Name', 40, 165);
    doc.text('Quantity Required', 185, 165, { align: 'right' });

    let yOffset = 171;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.setLineWidth(0.1);
    doc.setDrawColor(226, 232, 240);

    if (prepSummary.length === 0) {
      doc.text('No preparation items recorded for today.', 24, yOffset);
      doc.line(20, yOffset + 3, 190, yOffset + 3);
    } else {
      prepSummary.forEach((item, index) => {
        if (yOffset <= 255) {
          doc.text(`${index + 1}`, 24, yOffset);
          doc.text(item.name, 40, yOffset);
          doc.setFont('Helvetica', 'bold');
          doc.text(`${item.quantity} units`, 185, yOffset, { align: 'right' });
          doc.setFont('Helvetica', 'normal');
          
          doc.line(20, yOffset + 3, 190, yOffset + 3);
          yOffset += 8;
        }
      });
      
      if (prepSummary.length * 8 + 171 > 255) {
        doc.setFontSize(7.5);
        doc.setTextColor(185, 28, 28);
        doc.text('* Some preparation items were truncated due to page limits.', 24, yOffset);
      }
    }

    // -------------------------------------------------------------
    // FOOTER
    // -------------------------------------------------------------
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(20, 272, 190, 272);

    doc.setFontSize(7.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('This is a computer-generated operations ledger document. Confidential.', 20, 278);
    doc.text('Campus Bites Systems', 185, 278, { align: 'right' });

    // Save/Download PDF
    doc.save(`Daily_Report_${salesSummary.businessDate}.pdf`);
  };

  if (loading && !salesSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader className="animate-spin mb-3 stroke-[1.5]" size={32} />
        <span className="text-sm font-medium">Loading metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200/60 text-rose-600 rounded-2xl text-sm flex items-center gap-2">
        <ShieldAlert size={18} className="text-rose-500" />
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
      color: "bg-emerald-50 text-emerald-700 border-emerald-100",
      iconBg: "bg-emerald-100/70 text-emerald-600",
    },
    {
      title: "Total Orders",
      value: salesSummary?.totalOrders || 0,
      desc: `Confirmed: ${salesSummary?.confirmedOrders || 0}`,
      icon: ClipboardList,
      color: "bg-brand-50 text-brand-700 border-brand-100",
      iconBg: "bg-brand-100/70 text-brand-600",
    },
    {
      title: "COD Pending",
      value: codPendingCount,
      desc: "Awaiting delivery confirmation",
      icon: TrendingDown,
      color: "bg-amber-50 text-amber-700 border-amber-100",
      iconBg: "bg-amber-100/70 text-amber-600",
    },
    {
      title: "Cancelled Orders",
      value: salesSummary?.cancelledOrders || 0,
      desc: "Restored to stock",
      icon: ShieldAlert,
      color: "bg-rose-50 text-rose-700 border-rose-100",
      iconBg: "bg-rose-100/70 text-rose-600",
    },
  ];

  return (
    <div className="animate-fade-in flex flex-col gap-8 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Today's Overview</h1>
          <p className="text-slate-500 text-xs mt-1">Live operational statistics & preparation summary</p>
        </div>
        <button
          onClick={downloadPDFReport}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Download size={14} />
          Download Daily Report
        </button>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div 
              key={idx} 
              className={`bg-white border rounded-3xl p-6 flex items-center justify-between ${card.color} shadow-sm`}
            >
              <div className="text-left">
                <span className="text-xs text-slate-500 font-bold block mb-1">{card.title}</span>
                <span className="text-2xl font-black text-slate-900 block mb-1">{card.value}</span>
                <span className="text-[10px] text-slate-400 font-semibold">{card.desc}</span>
              </div>
              <div className={`p-3 rounded-2xl ${card.iconBg}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content splits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kitchen preparation summary card */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <ChefHat size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Kitchen Preparation</h3>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Required item counts for today</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold border border-brand-200/60">LIVE UPDATE</span>
          </div>

          {prepSummary.length === 0 ? (
            <div className="text-center py-12 text-slate-400 flex flex-col items-center justify-center gap-2">
              <Flame className="stroke-[1.5]" size={36} />
              <span className="text-xs font-semibold">No food item preparation required yet.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {prepSummary.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-200 transition-all"
                >
                  <span className="font-extrabold text-sm text-slate-800">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-semibold">Quantity</span>
                    <span className="px-4 py-1.5 rounded-xl bg-brand-600 text-white font-black text-sm shadow-sm">
                      {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales split breakdown */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-left flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Revenue Splits</h3>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">By Payment Gateway</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Online Paid */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 font-bold block">Online (Razorpay)</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Instant settlement</span>
                </div>
                <span className="font-black text-slate-900 text-base">₹{salesSummary?.onlineSales || 0}</span>
              </div>

              {/* COD */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-700 font-bold block">Cash on Delivery</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Paid upon receipt</span>
                </div>
                <span className="font-black text-slate-900 text-base">₹{salesSummary?.codSales || 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Aggregated local time</span>
            <span>Asia/Kolkata</span>
          </div>
        </div>
      </div>
    </div>
  );
};
