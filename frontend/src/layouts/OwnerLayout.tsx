import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ClipboardList, 
  IndianRupee, 
  Settings, 
  LogOut, 
  Menu as MenuIcon, 
  AlertCircle,
  Clock,
  CheckCircle,
  ChefHat,
  X
} from 'lucide-react';
import { ownerApi } from '../services/api';

export const OwnerLayout: React.FC = () => {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shopOpen, setShopOpen] = useState<boolean>(false);
  const [shopStatusText, setShopStatusText] = useState<string>('Loading...');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const fetchShopStatus = async () => {
    try {
      const data = await ownerApi.getShopStatusOwner();
      if (data?.success) {
        setShopOpen(data.status.isOpen);
        setShopStatusText(data.status.message);
      }
    } catch (error) {
      console.error('Failed to fetch shop status for header', error);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/owner/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchShopStatus();
      // Poll shop status every 60s
      const timer = setInterval(fetchShopStatus, 60000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  const toggleShopManual = async () => {
    try {
      if (shopOpen) {
        await ownerApi.closeShop();
      } else {
        await ownerApi.openShop();
      }
      await fetchShopStatus();
    } catch (error) {
      alert('Failed to update shop status');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl border-4 border-slate-700 border-t-brand-500 animate-spin"></div>
          <span className="text-slate-400 text-sm font-medium">Verifying Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { label: 'Dashboard', path: '/owner/dashboard', icon: LayoutDashboard },
    { label: 'Orders Tracker', path: '/owner/orders', icon: ClipboardList },
    { label: 'COD Pending', path: '/owner/orders/cod-pending', icon: IndianRupee },
    { label: 'Menu Catalog', path: '/owner/menu', icon: ChefHat },
    { label: 'Sales & Stats', path: '/owner/sales', icon: IndianRupee },
    { label: 'Shop Rules', path: '/owner/shop', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row relative">
      {/* Mobile Header Bar */}
      <header className="md:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Toggle Sidebar"
          >
            <MenuIcon size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-black text-xs">
              OB
            </div>
            <span className="font-extrabold text-sm text-white">Owner Portal</span>
          </div>
        </div>
        
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          shopOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${shopOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
          {shopOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Side Navigation Bar */}
      <aside className={`fixed md:sticky top-0 left-0 bottom-0 z-50 md:z-30 w-64 h-screen md:h-auto bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 shrink-0 transition-transform duration-300 md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div>
          {/* Logo / Header */}
          <div className="flex items-center justify-between mb-8 px-2 py-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-black shadow-lg shadow-brand-500/20">
                OB
              </div>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-white block">
                  Owner Portal
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Campus Bites V1
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 text-slate-500 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick status bar */}
          <div className="mb-6 p-3 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Shop Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                shopOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${shopOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                {shopOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <button
              onClick={toggleShopManual}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                shopOpen 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {shopOpen ? 'Force Close Shop' : 'Open Shop Now'}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout Section */}
        <div className="pt-4 border-t border-slate-800 mt-6 md:mt-0">
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Dashboard Panel */}
      <main className="flex-grow p-6 md:p-8 overflow-y-auto max-w-full">
        <Outlet context={{ fetchShopStatus }} />
      </main>
    </div>
  );
};
