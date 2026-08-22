import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';

// Layouts
import { StudentLayout } from './layouts/StudentLayout';
import { OwnerLayout } from './layouts/OwnerLayout';

// Student Pages
import { TodayMenu } from './pages/student/TodayMenu';
import { Cart } from './pages/student/Cart';
import { Checkout } from './pages/student/Checkout';
import { OrderDetails } from './pages/student/OrderDetails';
import { OrderHistory } from './pages/student/OrderHistory';
import { ShopClosed } from './pages/student/ShopClosed';

// Owner Pages
import { Login } from './pages/owner/Login';
import { Dashboard } from './pages/owner/Dashboard';
import { MenuManagement } from './pages/owner/MenuManagement';
import { OrdersTracker } from './pages/owner/OrdersTracker';
import { CodPending } from './pages/owner/CodPending';
import { SalesSummary } from './pages/owner/SalesSummary';
import { ShopControl } from './pages/owner/ShopControl';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Student Public Area */}
            <Route path="/" element={<StudentLayout />}>
              <Route index element={<TodayMenu />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="order/:orderId" element={<OrderDetails />} />
              <Route path="orders" element={<OrderHistory />} />
              <Route path="shop-closed" element={<ShopClosed />} />
            </Route>

            {/* Owner Auth Area */}
            <Route path="/owner/login" element={<Login />} />

            {/* Owner Protected Dashboard Area */}
            <Route path="/owner" element={<OwnerLayout />}>
              <Route index element={<Navigate to="/owner/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="menu" element={<MenuManagement />} />
              <Route path="orders" element={<OrdersTracker />} />
              <Route path="orders/cod-pending" element={<CodPending />} />
              <Route path="sales" element={<SalesSummary />} />
              <Route path="shop" element={<ShopControl />} />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
export { App };
