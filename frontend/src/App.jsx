// frontend/src/App.jsx
import { useLocation } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import PromotionBanner from './components/PromotionBanner'
import CategoryBar from './components/CategoryBar'
import CatalogueSection from './components/PromotionsSection'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'
import ClientNotifications from './components/ClientNotifications'
import Footer from './components/Footer'

// Pages
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/EditProfile'
import Orders from './pages/MyOrders'
import AdminDashboard from './pages/AdminDashboard'
import AdminProducts from './pages/AdminProducts'
import AdminOrders from './pages/AdminOrders'
import AdminUsers from './pages/AdminUsers'
import AdminPromotions from './pages/AdminPromotions'
import AdminTimeSlots from './pages/AdminTimeSlots'
import Checkout from './pages/Checkout'
import TimeSlot from './pages/TimeSlot'
import Confirmation from './pages/Confirmation'
import Products from './pages/Products'
import SearchResults from './pages/SearchResults'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

function App() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const hideFooter = isAdminRoute || isAuthRoute

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-700"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Click & Collect Banner */}
      {!isAdminRoute && !isAuthRoute && (
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white py-1 px-4 text-center">
          <p className="text-sm md:text-base font-medium">
            Click & Collect : Choisissez vos produits et venez les récupérer en pharmacie
          </p>
        </div>
      )}

      {/* Navbar - Caché sur admin et auth */}
      {!isAdminRoute && !isAuthRoute && <Navbar />}

      {/* Main Content */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={
            <>
              <PromotionBanner />
              <CategoryBar />
              <CatalogueSection />
            </>
          } />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/category/:categoryId" element={<CatalogueSection />} />
          
          {/* Pages protégées */}
          <Route path="/cart" element={
            <PrivateRoute>
              <Cart />
            </PrivateRoute>
          } />
          <Route path="/edit-profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          <Route path="/checkout" element={
            <PrivateRoute>
              <Checkout />
            </PrivateRoute>
          } />
          <Route path="/checkout/time-slot" element={
            <PrivateRoute>
              <TimeSlot />
            </PrivateRoute>
          } />
          <Route path="/checkout/confirmation" element={
            <PrivateRoute>
              <Confirmation />
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          <Route path="/my-orders" element={
            <PrivateRoute>
              <Orders />
            </PrivateRoute>
          } />
          
          {/* Pages admin */}
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
          <Route path="/admin/dashboard" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
          <Route path="/admin/products" element={
            <AdminRoute>
              <AdminProducts />
            </AdminRoute>
          } />
          <Route path="/admin/orders" element={
            <AdminRoute>
              <AdminOrders />
            </AdminRoute>
          } />
          <Route path="/admin/users" element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          } />
          <Route path="/admin/promotions" element={
            <AdminRoute>
              <AdminPromotions />
            </AdminRoute>
          } />
          <Route path="/admin/time-slots" element={
            <AdminRoute>
              <AdminTimeSlots />
            </AdminRoute>
          } />
        </Routes>
      </main>
      
      <ClientNotifications />

      {/* Footer */}
      {!hideFooter && <Footer />}
    </div>
  )
}

export default App