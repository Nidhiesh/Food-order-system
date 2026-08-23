import React, { useEffect, useState } from 'react';
import { ownerApi } from '../../services/api';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Loader, 
  AlertTriangle, 
  ToggleLeft, 
  ToggleRight, 
  Grid,
  CalendarDays
} from 'lucide-react';

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number;
  defaultQuantity: number;
  isAvailable: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  availableQuantity: number;
  initialQuantity: number;
  isAvailable: boolean;
  businessDate: string;
}

export const MenuManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'today'>('today');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [todayMenu, setTodayMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modal / Form state for Catalog
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [catPrice, setCatPrice] = useState<number>(0);
  const [catQty, setCatQty] = useState<number>(10);
  const [catAvail, setCatAvail] = useState<boolean>(true);
  const [submittingCat, setSubmittingCat] = useState<boolean>(false);

  // Edit State for today's menu inline
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQty, setEditQty] = useState<number>(0);
  const [updatingMenuId, setUpdatingMenuId] = useState<string | null>(null);

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError('');
      }
      if (activeTab === 'catalog') {
        const res = await ownerApi.getCatalog();
        if (res.success) setCatalog(res.catalog || []);
      } else {
        const res = await ownerApi.getTodayMenuOwner();
        if (res.success) setTodayMenu(res.menu || []);
      }
    } catch (err: any) {
      console.error(err);
      if (showLoading) {
        setError(err.response?.data?.message || 'Failed to load menu data.');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const openAddCatalogModal = () => {
    setEditingCatalogItem(null);
    setCatName('');
    setCatDesc('');
    setCatPrice(0);
    setCatQty(9999);
    setCatAvail(true);
    setShowCatalogModal(true);
  };

  const openEditCatalogModal = (item: CatalogItem) => {
    setEditingCatalogItem(item);
    setCatName(item.name);
    setCatDesc(item.description || '');
    setCatPrice(item.defaultPrice);
    setCatQty(9999);
    setCatAvail(item.isAvailable);
    setShowCatalogModal(true);
  };

  const handleSaveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      setSubmittingCat(true);
      const payload = {
        name: catName,
        description: catDesc || null,
        defaultPrice: Number(catPrice),
        defaultQuantity: Number(catQty),
        isAvailable: catAvail,
      };

      if (editingCatalogItem) {
        await ownerApi.updateCatalogItem(editingCatalogItem.id, payload);
      } else {
        await ownerApi.createCatalogItem(payload);
      }

      setShowCatalogModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save product to catalog');
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleDeleteCatalog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product? Historical orders will be preserved.')) return;
    try {
      const res = await ownerApi.deleteCatalogItem(id);
      alert(res.message || 'Product deleted');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete catalog item');
    }
  };

  const toggleTodayItemAvailability = async (item: MenuItem) => {
    // 1. Instantly flip the state locally (Optimistic Update)
    setTodayMenu(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i));

    try {
      // 2. Perform API call in background
      await ownerApi.updateTodayMenuItem(item.id, { isAvailable: !item.isAvailable });
    } catch (err: any) {
      // 3. Revert on failure
      setTodayMenu(prev => prev.map(i => i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i));
      alert('Failed to update item availability.');
    }
  };

  const startEditTodayItem = (item: MenuItem) => {
    setEditingMenuItemId(item.id);
    setEditPrice(item.price);
    setEditQty(item.availableQuantity);
  };

  const saveTodayItemChanges = async (item: MenuItem) => {
    try {
      setUpdatingMenuId(item.id);
      await ownerApi.updateTodayMenuItem(item.id, {
        price: Number(editPrice),
        availableQuantity: 9999,
        initialQuantity: 9999,
      });
      setEditingMenuItemId(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update menu item.');
    } finally {
      setUpdatingMenuId(null);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 text-left">
      {/* Header info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Menu Manager</h1>
          <p className="text-slate-400 text-xs mt-1">Configure your master catalog or customize today's active menu.</p>
        </div>

        {activeTab === 'catalog' && (
          <button
            onClick={openAddCatalogModal}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm px-4 py-2.5 rounded-2xl shadow-lg shadow-brand-500/10 cursor-pointer"
          >
            <Plus size={16} className="stroke-[3]" />
            Add New Product
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 p-0.5 gap-2 max-w-sm bg-slate-900 rounded-2xl border border-slate-800/80">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'today' 
              ? 'bg-brand-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarDays size={14} />
          Today's Menu
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'catalog' 
              ? 'bg-brand-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid size={14} />
          Master Catalog
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-400">
          <Loader className="animate-spin mb-3" size={28} />
          <span className="text-xs">Fetching menu configurations...</span>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {/* TODAY'S MENU TABLE */}
          {activeTab === 'today' && (
            <div className="overflow-x-auto">
              {todayMenu.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Today's menu list is empty. Add items to your Catalog to see them auto-populating!
                </div>
              ) : (
                <table className="w-full text-slate-300 text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="p-4">Item Name</th>
                      <th className="p-4">Daily Price</th>
                      <th className="p-4">Availability</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {todayMenu.map((item) => {
                      const isEditing = editingMenuItemId === item.id;
                      const isUpdating = updatingMenuId === item.id;

                      return (
                        <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 font-bold text-slate-100 max-w-xs truncate">
                            {item.name}
                            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5 max-w-full truncate">
                              {item.description || 'No description'}
                            </span>
                          </td>

                          <td className="p-4">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Math.max(1, Number(e.target.value)))}
                                className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-xs font-semibold outline-none text-white"
                              />
                            ) : (
                              <span className="font-extrabold text-sm text-white">₹{item.price}</span>
                            )}
                          </td>



                          <td className="p-4">
                            <button
                              onClick={() => toggleTodayItemAvailability(item)}
                              disabled={isUpdating}
                              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title={item.isAvailable ? 'Toggle Offline' : 'Toggle Online'}
                            >
                              {item.isAvailable ? (
                                <ToggleRight size={32} className="text-emerald-500" />
                              ) : (
                                <ToggleLeft size={32} className="text-slate-600" />
                              )}
                            </button>
                          </td>

                          <td className="p-4 text-right">
                            {isEditing ? (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => saveTodayItemChanges(item)}
                                  className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 cursor-pointer"
                                  title="Save"
                                >
                                  <Check size={14} className="stroke-[3]" />
                                </button>
                                <button
                                  onClick={() => setEditingMenuItemId(null)}
                                  className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditTodayItem(item)}
                                className="inline-flex items-center gap-1 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-800"
                              >
                                <Edit2 size={10} />
                                Edit Price
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* MASTER CATALOG TABLE */}
          {activeTab === 'catalog' && (
            <div className="overflow-x-auto">
              {catalog.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Your Catalog is empty. Add a product to get started!
                </div>
              ) : (
                <table className="w-full text-slate-300 text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Default Price</th>
                      <th className="p-4">Catalog Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {catalog.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 font-bold text-slate-100 max-w-xs truncate">
                          {item.name}
                          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5 max-w-full truncate">
                            {item.description || 'No description'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white">₹{item.defaultPrice}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.isAvailable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {item.isAvailable ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => openEditCatalogModal(item)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit product info"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteCatalog(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* CATALOG ADD/EDIT MODAL */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveCatalog} className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl shadow-2xl p-6 animate-slide-up text-left flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white">
                {editingCatalogItem ? 'Edit Product Details' : 'Add Product to Catalog'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Product Name</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex. Butter Naan"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-xs font-semibold outline-none text-white placeholder:text-slate-600"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Description (Optional)</label>
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Ex. Soft leavened clay-oven baked flatbread"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-xs font-semibold outline-none text-white placeholder:text-slate-600"
              />
            </div>

            {/* Default Price */}
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">Default Price (₹)</label>
              <input
                type="number"
                value={catPrice}
                onChange={(e) => setCatPrice(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl text-xs font-semibold outline-none text-white"
                required
              />
            </div>

            {/* Availability status */}
            <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-2xl mt-2">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Catalog Availability</span>
                <span className="text-[10px] text-slate-500 font-semibold block">Visible in catalog and menus when active</span>
              </div>
              <button
                type="button"
                onClick={() => setCatAvail(!catAvail)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {catAvail ? (
                  <ToggleRight size={30} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={30} className="text-slate-600" />
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCat}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                {submittingCat ? (
                  <Loader className="animate-spin" size={12} />
                ) : (
                  'Save Product'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
