import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send HTTP-Only cookies automatically
});

// Response interceptor to catch 401s and clean up local sessions
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Trigger clear local storage if unauthenticated
      if (window.location.pathname.startsWith('/owner') && window.location.pathname !== '/owner/login') {
        window.location.href = '/owner/login?message=session_expired';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ==========================================
// STUDENT SERVICES
// ==========================================
export const studentApi = {
  getShopStatus: async () => {
    const res = await api.get('/shop/status');
    return res.data;
  },

  getTodayMenu: async () => {
    const res = await api.get('/menu/today');
    return res.data;
  },

  createOrder: async (payload: {
    customerName: string;
    customerPhone: string;
    departmentClass?: string | null;
    paymentMethod: 'COD' | 'ONLINE';
    items: { menuItemId: string; quantity: number }[];
  }) => {
    const res = await api.post('/orders', payload);
    return res.data;
  },

  getOrderDetails: async (publicOrderId: string, token: string) => {
    const res = await api.get(`/orders/${publicOrderId}`, {
      params: { token },
    });
    return res.data;
  },

  cancelOrder: async (publicOrderId: string, token: string, reason?: string) => {
    const res = await api.post(`/orders/${publicOrderId}/cancel`, { reason }, {
      params: { token },
    });
    return res.data;
  },

  getOrderHistory: async (tokens: string[]) => {
    const res = await api.post('/orders/history', { tokens });
    return res.data;
  },

  verifyPayment: async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const res = await api.post('/payments/verify', payload);
    return res.data;
  },
};

// ==========================================
// OWNER SERVICES
// ==========================================
export const ownerApi = {
  login: async (payload: any) => {
    const res = await api.post('/auth/login', payload);
    return res.data;
  },

  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  // Catalog CRUD
  getCatalog: async () => {
    const res = await api.get('/menu/owner/catalog');
    return res.data;
  },

  createCatalogItem: async (payload: any) => {
    const res = await api.post('/menu/owner/catalog', payload);
    return res.data;
  },

  updateCatalogItem: async (id: string, payload: any) => {
    const res = await api.patch(`/menu/owner/catalog/${id}`, payload);
    return res.data;
  },

  deleteCatalogItem: async (id: string) => {
    const res = await api.delete(`/menu/owner/catalog/${id}`);
    return res.data;
  },

  // Today's Menu Adjustments
  getTodayMenuOwner: async () => {
    const res = await api.get('/menu/owner/today');
    return res.data;
  },

  updateTodayMenuItem: async (id: string, payload: any) => {
    const res = await api.patch(`/menu/owner/today/${id}`, payload);
    return res.data;
  },

  // Orders Management
  searchOrders: async (params: { phone?: string; date?: string; query?: string; status?: string }) => {
    const res = await api.get('/orders/owner/search', { params });
    return res.data;
  },

  getTodayOrders: async () => {
    const res = await api.get('/orders/owner/today');
    return res.data;
  },

  getCodPendingOrders: async () => {
    const res = await api.get('/orders/owner/cod-pending');
    return res.data;
  },

  getOnlineOrders: async () => {
    const res = await api.get('/orders/owner/online');
    return res.data;
  },

  deliverAllOnlineOrders: async () => {
    const res = await api.post('/orders/owner/deliver-all-online');
    return res.data;
  },

  markCodDelivered: async (id: string) => {
    const res = await api.patch(`/orders/owner/${id}/deliver-cod`);
    return res.data;
  },

  updateOrderStatus: async (id: string, status: string) => {
    const res = await api.patch(`/orders/owner/${id}/status`, { status });
    return res.data;
  },

  cancelAllOrders: async (reason: string) => {
    const res = await api.post('/orders/owner/cancel-all', { reason });
    return res.data;
  },

  getPreparationSummary: async () => {
    const res = await api.get('/orders/owner/summary');
    return res.data;
  },

  getSalesSummary: async () => {
    const res = await api.get('/orders/owner/sales/today');
    return res.data;
  },

  // Shop Status
  getShopStatusOwner: async () => {
    const res = await api.get('/shop/owner/status');
    return res.data;
  },

  closeShop: async () => {
    const res = await api.post('/shop/owner/close');
    return res.data;
  },

  openShop: async () => {
    const res = await api.post('/shop/owner/open');
    return res.data;
  },

  updateShopConfig: async (payload: {
    openingTime?: string;
    closingTime?: string;
    cancellationCutoff?: string;
  }) => {
    const res = await api.patch('/shop/owner/config', payload);
    return res.data;
  },
};
