// frontend/src/routes/index.jsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../stores'
import App from '../App'
import PrivateRoute from '../components/PrivateRoute'
import AdminRoute from '../components/AdminRoute'

// Pages publiques (chargées immédiatement — critiques pour le premier rendu)
import Products from '../pages/Products'
import ProductDetail from '../pages/ProductDetail'
import Login from '../pages/Login'
import Signup from '../pages/Signup'
import NotFound from '../pages/NotFound'

// Pages lazy (chargées à la demande)
const ForgotPassword     = lazy(() => import('../pages/ForgotPassword'))
const ResetPassword      = lazy(() => import('../pages/ResetPassword'))
const EditProfile        = lazy(() => import('../pages/EditProfile'))
const Cart               = lazy(() => import('../pages/Cart'))
const Checkout           = lazy(() => import('../pages/Checkout'))
const TimeSlot           = lazy(() => import('../pages/TimeSlot'))
const Confirmation       = lazy(() => import('../pages/Confirmation'))
const DeliveryPage       = lazy(() => import('../pages/DeliveryPage'))
const PromotionCheckout  = lazy(() => import('../pages/PromotionCheckout'))
const SearchResults      = lazy(() => import('../pages/SearchResults'))
const MyOrders           = lazy(() => import('../pages/MyOrders'))
const PrivacyPolicy      = lazy(() => import('../pages/PrivacyPolicy'))

// Admin — tout en lazy (jamais chargé par les clients)
const AdminLogin              = lazy(() => import('../pages/AdminLogin'))
const AdminLoginDebug         = lazy(() => import('../pages/AdminLoginDebug'))
const AdminDashboard          = lazy(() => import('../pages/AdminDashboard'))
const AdminProducts           = lazy(() => import('../pages/AdminProducts'))
const AdminOrders             = lazy(() => import('../pages/AdminOrders'))
const AdminUsers              = lazy(() => import('../pages/AdminUsers'))
const AdminPromotions         = lazy(() => import('../pages/AdminPromotions'))
const AdminTimeSlots          = lazy(() => import('../pages/AdminTimeSlots'))
const AdminReports            = lazy(() => import('../pages/AdminReports'))
const AdminNotifications      = lazy(() => import('../pages/AdminNotifications'))
const AdminCategories         = lazy(() => import('../pages/AdminCategories'))
const AdminSuppliers          = lazy(() => import('../pages/AdminSuppliers'))
const AdminPurchaseOrders     = lazy(() => import('../pages/AdminPurchaseOrders'))
const AdminSupplierProducts   = lazy(() => import('../pages/AdminSupplierProducts'))
const AdminSupplierDiscounts  = lazy(() => import('../pages/AdminSupplierDiscounts'))
const AdminReviews            = lazy(() => import('../pages/AdminReviews'))
const AdminStock              = lazy(() => import('../pages/AdminStock'))
const AdminSettings           = lazy(() => import('../pages/AdminSettings'))
const EmployeeWelcome         = lazy(() => import('../pages/EmployeeWelcome'))

import { EmployeeDashboardProvider } from '../context/EmployeeDashboardContext';

// Home components
import CategoryBar from '../components/CategoryBar'
import CatalogueSection from '../components/PromotionsSection'
import PromotionSlider from '../components/PromotionSlider'

const PageLoader = () => (
  <div className="flex justify-center items-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-700" />
  </div>
)

const HomeContent = () => {
  const { loading } = useAuth()

  if (loading) return <PageLoader />

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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<App />}>
          {/* Home */}
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
        <Route path="/admin/login" element={<AdminLogin />} />
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
        <Route path="/admin/login-debug" element={<AdminLoginDebug />} />

        {/* fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
