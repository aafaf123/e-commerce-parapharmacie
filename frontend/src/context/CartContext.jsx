// frontend/src/context/CartContext.jsx
import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'

const CartContext = createContext()

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([])
  const [promoCode, setPromoCode] = useState(null)
  const [promoError, setPromoError] = useState('')
  const [validating, setValidating] = useState(false)
  const [stockError, setStockError] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(300)
  const [tvaRate, setTvaRate] = useState(0.19)
  const [deliveryFee, setDeliveryFee] = useState(25)
  const [expressDeliveryFee, setExpressDeliveryFee] = useState(5.90)

  const { user, isAdmin, isAuthenticated } = useAuth()
  const [editingOrder, setEditingOrder] = useState(null)
  
  const prevUserIdRef = useRef(null)

  // Fetch settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/settings')
        if (data.FREE_SHIPPING_THRESHOLD) setFreeShippingThreshold(parseFloat(data.FREE_SHIPPING_THRESHOLD))
        if (data.TVA_RATE) setTvaRate(parseFloat(data.TVA_RATE))
        if (data.DELIVERY_FEE) setDeliveryFee(parseFloat(data.DELIVERY_FEE))
        if (data.EXPRESS_DELIVERY_FEE) setExpressDeliveryFee(parseFloat(data.EXPRESS_DELIVERY_FEE))
      } catch (error) {
        console.error('Erreur lors de la récupération des paramètres:', error)
      }
    }
    fetchSettings()
  }, [])

  // Get current user ID for per-user cart storage
  const getCurrentUserId = useCallback(() => {
    return user?.id || null
  }, [user])

  // Load cart from backend when user logs in
  const loadCartFromBackend = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    try {
      const response = await api.get('/user/cart')
      
      if (response.data.cart && response.data.cart.length > 0) {
        setCartItems(response.data.cart)
        const userId = user?.id
        if (userId) {
          localStorage.setItem(`cart_${userId}`, JSON.stringify(response.data.cart))
        }
      }
    } catch (error) {
      console.error('Erreur chargement panier backend:', error)
    }
  }, [user?.id])

  // Load cart from localStorage or backend - run when user changes
  useEffect(() => {
    const userId = getCurrentUserId()
    const prevUserId = prevUserIdRef.current
    
    // Detect user change (login or logout)
    const userChanged = prevUserId !== userId
    
    // Update ref
    prevUserIdRef.current = userId
    
    // Skip if no user change
    if (!userChanged) return
    
    // If user logged out
    if (!isAuthenticated) {
      setCartItems([])
      setEditingOrder(null)
      setPromoCode(null)
      
      const guestCart = localStorage.getItem('cart_guest')
      if (guestCart) {
        try {
          setCartItems(JSON.parse(guestCart))
        } catch (e) {
          setCartItems([])
        }
      } else {
        setCartItems([])
      }
      return
    }
    
    // If user logged in (or switched account)
    if (userId) {
      // Try to load from localStorage first
      const cartKey = `cart_${userId}`
      const savedCart = localStorage.getItem(cartKey)
      
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart)
          const cleanedCart = parsedCart.filter(item => !String(item.id).startsWith('promo-'))
          setCartItems(cleanedCart)
        } catch (error) {
          console.error('Erreur chargement panier local:', error)
          loadCartFromBackend()
        }
      } else {
        // No localStorage, try backend
        loadCartFromBackend()
      }
    }
  }, [isAuthenticated, user?.id, loadCartFromBackend, getCurrentUserId])

  // Auto-save to localStorage whenever cart changes
  useEffect(() => {
    if (!isAuthenticated) return
    
    const userId = getCurrentUserId()
    if (!userId) return
    
    localStorage.setItem(`cart_${userId}`, JSON.stringify(cartItems))
  }, [cartItems, isAuthenticated, user?.id])

  // Sync cart to backend when user is logged in
  const syncCartToBackend = useCallback(async (cart) => {
    if (!isAuthenticated) {
      console.log('Sync skipped: not authenticated')
      return
    }
    
    try {
      console.log('Syncing to backend:', cart)
      await api.post('/user/cart', { cart })
      console.log('Sync successful')
    } catch (error) {
      console.error('Erreur synchronisation panier:', error)
    }
  }, [isAuthenticated])

  // Auto-save to backend when cart changes and user is logged in
  useEffect(() => {
    if (!isAuthenticated || cartItems.length === 0) return
    
    const timer = setTimeout(() => {
      console.log('Syncing cart to backend:', cartItems)
      syncCartToBackend(cartItems)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [cartItems, syncCartToBackend, isAuthenticated])

  // Force sync after addToCart
  const forceSyncCart = useCallback(async () => {
    if (!isAuthenticated || cartItems.length === 0) return
    try {
      await api.post('/user/cart', { cart: cartItems })
    } catch (error) {
      console.error('Force sync error:', error)
    }
  }, [isAuthenticated, cartItems])

  // Save cart on page unload (before user leaves)
  useEffect(() => {
    if (!isAuthenticated) return
    
    const handleBeforeUnload = () => {
      const token = localStorage.getItem('token')
      if (token) {
        navigator.sendBeacon('/api/user/cart', JSON.stringify({ cart: cartItems }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [cartItems, isAuthenticated])

  // Load promo code from localStorage on mount
  useEffect(() => {
    const savedPromo = localStorage.getItem('promoCode')
    if (savedPromo) {
      try {
        setPromoCode(JSON.parse(savedPromo))
      } catch (e) {
        localStorage.removeItem('promoCode')
      }
    }
  }, [])

  // Save promo code to localStorage when it changes
  useEffect(() => {
    if (promoCode) {
      localStorage.setItem('promoCode', JSON.stringify(promoCode))
    } else {
      localStorage.removeItem('promoCode')
    }
  }, [promoCode])

  const addToCart = (product, qty = 1) => {
    setStockError('')

    if (!isAuthenticated) {
      alert('🔒 Veuillez vous connecter pour ajouter des produits au panier.')
      return false;
    }

    if (isAuthenticated && isAdmin) {
      alert('⚠️ Vous êtes administrateur, vous ne pouvez pas commander.')
      return false;
    }

    // For variants, use variantId; for regular products, use productId
    // This ensures each variant of the same product is a separate cart item
    const itemId = product.variantId || product.id
    const existingItem = cartItems.find(item => (item.variantId || item.id) === itemId)

    const stock = product.stock || 0
    
    if (existingItem) {
      const newQty = existingItem.quantity + qty
      if (newQty > stock) {
        const itemName = product.variantValue 
          ? `${product.name} (${product.variantValue})`
          : product.name
        setStockError(`Stock insuffisant pour "${itemName}". Il ne reste que ${stock} unité(s) disponible(s).`)
        return false
      }
      setCartItems(cartItems.map(item =>
        (item.variantId || item.id) === itemId ? { ...item, quantity: newQty } : item
      ))
    } else {
      setCartItems([...cartItems, { ...product, quantity: qty }])
    }
    
    // Force sync immediately
    setTimeout(() => forceSyncCart(), 100)
    
    return true;
  }

  const removeFromCart = (productId, variantId = null) => {
    // Remove item by considering both productId and variantId if present
    setCartItems(cartItems.filter(item => {
      if (variantId) {
        return !(item.id === productId && item.variantId === variantId)
      }
      return item.id !== productId
    }))
  }

  const updateQuantity = (itemId, quantity, variantId = null) => {
    setStockError('')
    if (quantity <= 0) {
      removeFromCart(itemId, variantId)
      return
    }
    setCartItems(cartItems.map(i => {
      // For items with variants, match by variantId or itemId
      // For regular items, match by id
      const isTarget = i.variantId ? (i.variantId === itemId || i.id === itemId) : i.id === itemId
      return isTarget ? { ...i, quantity } : i
    }))
  }

  const clearCart = () => {
    setCartItems([])
    setPromoCode(null)
  }

  const applyPromoCode = async (code) => {
    const upperCode = code.toUpperCase().trim()
    
    if (!upperCode) {
      setPromoError('Veuillez entrer un code promo')
      return false
    }

    setValidating(true)
    setPromoError('')

    try {
      const response = await api.post('/promo-codes/validate', { code: upperCode })
      
      if (response.data) {
        const promoData = response.data
        setPromoCode({
          code: promoData.code,
          type: promoData.discountType,
          value: promoData.discountValue,
          description: promoData.description || `${promoData.discountValue}${promoData.discountType === 'percentage' ? '%' : ' DH'} de réduction`
        })
        setPromoError('')
        return true
      }
      return false
    } catch (error) {
      console.error('Erreur validation code promo:', error)
      setPromoError(error.response?.data?.error || 'Code promo invalide')
      return false
    } finally {
      setValidating(false)
    }
  }

  const removePromoCode = () => {
    setPromoCode(null)
    setPromoError('')
  }

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  const getDiscount = () => {
    if (!promoCode) return 0
    
    const subtotal = getSubtotal()
    
    if (promoCode.type === 'percentage') {
      return (subtotal * promoCode.value) / 100
    } else if (promoCode.type === 'fixed') {
      return Math.min(promoCode.value, subtotal)
    }
    
    return 0
  }

  const getSubtotalAfterDiscount = () => {
    return getSubtotal() - getDiscount()
  }

  const getTVA = () => {
    return 0
  }

  const getTotalPrice = () => {
    return getSubtotalAfterDiscount()
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const getShippingInfo = () => {
    const subtotal = getSubtotal()
    const remaining = freeShippingThreshold - subtotal
    const isFree = subtotal >= freeShippingThreshold
    
    return {
      isFree,
      threshold: freeShippingThreshold,
      remaining: remaining > 0 ? remaining : 0,
      percentage: Math.min((subtotal / freeShippingThreshold) * 100, 100),
      fee: deliveryFee,
      expressFee: expressDeliveryFee || 5.90,
      isExpress: false,
      currentFee: isFree ? 0 : deliveryFee
    }
  }

  const value = {
    cartItems,
    setCartItems,
    promoCode,
    promoError,
    stockError,
    validating,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    applyPromoCode,
    removePromoCode,
    getSubtotal,
    getDiscount,
    getSubtotalAfterDiscount,
    getTVA,
    getTotalPrice,
    getTotalItems,
    getShippingInfo,
    editingOrder,
    setEditingOrder,
    tvaRate,
    freeShippingThreshold,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart doit être utilisé dans CartProvider')
  }
  return context
}