// frontend/src/routes/index.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../stores'
import App from '../App'
import PrivateRoute from '../components/PrivateRoute'
import AdminRoute from '../components/AdminRoute'

// Pages
import Login from '../pages/Login'
import Signup from '../pages/Signup'
import ForgotPassword from '../pages/ForgotPassword'
import ResetPassword from '../pages/ResetPassword'
import EditProfile from '../pages/EditProfile'
import Cart from '../pages/Cart'
import Checkout from '../pages/Checkout'
import TimeSlot from '../pages/TimeSlot'
import Confirmation from '../pages/Confirmation'
import DeliveryPage from '../pages/DeliveryPage'
import PromotionCheckout from '../pages/PromotionCheckout'
import Products from '../pages/Products'
import ProductDetail from '../pages/ProductDetail'
import SearchResults from '../pages/SearchResults'
import MyOrders from '../pages/MyOrders'
import PrivacyPolicy from '../pages/PrivacyPolicy'

// Admin
import AdminDashboard from '../pages/AdminDashboard'
import AdminProducts from '../pages/AdminProducts'
import AdminOrders from '../pages/AdminOrders'
import AdminUsers from '../pages/AdminUsers'
import AdminPromotions from '../pages/AdminPromotions'
import AdminTimeSlots from '../pages/AdminTimeSlots'
import AdminReports from '../pages/AdminReports'
import AdminNotifications from '../pages/AdminNotifications'
import AdminCategories from '../pages/AdminCategories'
import AdminSuppliers from '../pages/AdminSuppliers'
import AdminPurchaseOrders from '../pages/AdminPurchaseOrders'
import AdminSupplierProducts from '../pages/AdminSupplierProducts'
import AdminSupplierDiscounts from '../pages/AdminSupplierDiscounts'
import AdminReviews from '../pages/AdminReviews'
import AdminStock from '../pages/AdminStock'
import AdminSettings from '../pages/AdminSettings'
import EmployeeWelcome from '../pages/EmployeeWelcome'
import { EmployeeDashboardProvider } from '../context/EmployeeDashboardContext';

// Home components
import CategoryBar from '../components/CategoryBar'
import CatalogueSection from '../components/PromotionsSection'
import PromotionSlider from '../components/PromotionSlider'

const HomeContent = () => {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700" />
      </div>
    )
  }

  return (
    <>
      <CategoryBar />
      <PromotionSlider />
      <CatalogueSection />
    </>
  )
}

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        {/* Home - Page d'accueil publique pour tous les utilisateurs */}
        <Route index element={<HomeContent />} />

        {/* Public */}
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />

        {/* Auth */}
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        {/* Client sécurisé */}
        <Route path="cart" element={<PrivateRoute><Cart /></PrivateRoute>} />
        <Route path="edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
        <Route path="checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />
        <Route path="checkout/delivery" element={<PrivateRoute><DeliveryPage /></PrivateRoute>} />
        <Route path="checkout/time-slot" element={<PrivateRoute><TimeSlot /></PrivateRoute>} />
        <Route path="checkout/confirmation" element={<PrivateRoute><Confirmation /></PrivateRoute>} />
        <Route path="promotion/:id" element={<PromotionCheckout />} />
        <Route path="profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
        <Route path="my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/employee" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/admindashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
      <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
      <Route path="/admin/time-slots" element={<AdminRoute><AdminTimeSlots /></AdminRoute>} />
      <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
      <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
      <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
      <Route path="/admin/suppliers" element={<AdminRoute><AdminSuppliers /></AdminRoute>} />
      <Route path="/admin/suppliers/:supplierId/products" element={<AdminRoute><AdminSupplierProducts /></AdminRoute>} />
      <Route path="/admin/suppliers/:supplierId/discounts" element={<AdminRoute><AdminSupplierDiscounts /></AdminRoute>} />
      <Route path="/admin/purchase-orders" element={<AdminRoute><AdminPurchaseOrders /></AdminRoute>} />
      <Route path="/admin/reviews" element={<AdminRoute><AdminReviews /></AdminRoute>} />
      <Route path="/admin/stock" element={<AdminRoute><AdminStock /></AdminRoute>} />

      <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default AppRoutes