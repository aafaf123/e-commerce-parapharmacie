// frontend/src/routes/index.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from '../context/AuthContext'  // ← Import AuthProvider
import { CartProvider } from '../context/CartContext'
import App from '../App'
import Login from '../pages/Login'

import Signup from '../pages/Signup'  // ← Changé de Register à Signup
import ForgotPassword from '../pages/ForgotPassword'
import ResetPassword from '../pages/ResetPassword'
import EditProfile from '../pages/EditProfile'
import Cart from '../pages/Cart'
import Checkout from '../pages/Checkout'
import TimeSlot from '../pages/TimeSlot'
import Confirmation from '../pages/Confirmation'
import Products from '../pages/Products'
import ProductDetail from '../pages/ProductDetail'
import SearchResults from '../pages/SearchResults'
import MyOrders from '../pages/MyOrders'
import Footer from '../components/Footer'

// Lazy loading pour les pages admin
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'))
const AdminOrders = lazy(() => import('../pages/AdminOrders'))
const AdminPromotions = lazy(() => import('../pages/AdminPromotions'))
const AdminTimeSlots = lazy(() => import('../pages/AdminTimeSlots'))
const AdminUsers = lazy(() => import('../pages/AdminUsers'))
const AdminReports = lazy(() => import('../pages/AdminReports'))

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-16 h-16 border-4 border-sky-700 border-t-transparent rounded-full animate-spin"></div>
  </div>
)

const Layout = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow">
        <Routes>
          {/* Route principale */}
          <Route path="/*" element={<App />} />
          
          {/* Routes d'authentification */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />  {/* ← Changé */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Routes protégées */}
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/time-slot" element={<TimeSlot />} />
          <Route path="/checkout/confirmation" element={<Confirmation />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/my-orders" element={<MyOrders />} />
          
          {/* Routes admin */}
          <Route path="/admin/dashboard" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminDashboard />
            </Suspense>
          } />
          <Route path="/admin" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminDashboard />
            </Suspense>
          } />
          <Route path="/admin/orders" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminOrders />
            </Suspense>
          } />
          <Route path="/admin/promotions" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminPromotions />
            </Suspense>
          } />
          <Route path="/admin/time-slots" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminTimeSlots />
            </Suspense>
          } />
          <Route path="/admin/users" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminUsers />
            </Suspense>
          } />
          <Route path="/admin/reports" element={
            <Suspense fallback={<LoadingSpinner />}>
              <AdminReports />
            </Suspense>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      {!isAdminRoute && !isAuthRoute && <Footer />}
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Router>
      <AuthProvider>  {/* ← AuthProvider doit être ici, autour de tout */}
        <CartProvider>  {/* ← CartProvider aussi */}
          <Layout />
        </CartProvider>
      </AuthProvider>
    </Router>
  )
}

export default AppRoutes