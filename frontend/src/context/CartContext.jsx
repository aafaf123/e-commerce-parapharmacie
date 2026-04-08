// frontend/src/context/CartContext.jsx
import { createContext, useState, useContext, useEffect, useCallback } from 'react'
import api from '../api/axios'

const CartContext = createContext()

const TVA_RATE = 0.19 // 19% TVA
const FREE_SHIPPING_THRESHOLD = 300 // Livraison gratuite à partir de 300 DH

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([])
  const [promoCode, setPromoCode] = useState(null)
  const [promoError, setPromoError] = useState('')
  const [validating, setValidating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Get current user ID for per-user cart storage
  const getCurrentUserId = () => {
    const userStr = localStorage.getItem('user')
    try {
      const user = JSON.parse(userStr)
      return user?.id || null
    } catch {
      return null
    }
  }

  // Load cart from localStorage on mount (persistent cart)
  useEffect(() => {
    const userId = getCurrentUserId()
    const cartKey = userId ? `cart_${userId}` : 'cart_guest'
    const savedCart = localStorage.getItem(cartKey)
    const savedPromo = localStorage.getItem('promoCode')
    
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart)
        setCartItems(parsedCart)
      } catch (error) {
        console.error('Erreur lors du chargement du panier:', error)
      }
    }
    
    if (savedPromo) {
      try {
        setPromoCode(JSON.parse(savedPromo))
      } catch (error) {
        console.error('Erreur lors du chargement du code promo:', error)
      }
    }
  }, [])

  // Auto-save to localStorage whenever cart changes (persistent cart)
  useEffect(() => {
    const userId = getCurrentUserId()
    const cartKey = userId ? `cart_${userId}` : 'cart_guest'
    localStorage.setItem(cartKey, JSON.stringify(cartItems))
  }, [cartItems])

  // Sync cart to backend when user is logged in
  const syncCartToBackend = useCallback(async (cart) => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    try {
      await api.post('/user/cart', { cart }, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (error) {
      console.error('Erreur synchronisation panier:', error)
    }
  }, [])

  // Auto-save to backend when cart changes and user is logged in
  useEffect(() => {
    if (isSyncing) return
    
    const token = localStorage.getItem('token')
    if (!token) return
    
    setIsSyncing(true)
    const debounceTimer = setTimeout(() => {
      syncCartToBackend(cartItems)
      setIsSyncing(false)
    }, 1000) // Debounce 1 second
    
    return () => clearTimeout(debounceTimer)
  }, [cartItems, syncCartToBackend, isSyncing])

  // Save cart on page unload (before user leaves)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const token = localStorage.getItem('token')
      if (token) {
        // Synchronous save attempt
        navigator.sendBeacon('/api/user/cart', JSON.stringify({ cart: cartItems }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [cartItems])

  // Load cart from backend when user logs in
  const loadCartFromBackend = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    
    try {
      const response = await api.get('/user/cart', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.data.cart && response.data.cart.length > 0) {
        // Merge backend cart with local cart
        const localCart = cartItems
        const backendCart = response.data.cart
        
        // Create a map of local items by product id
        const localMap = new Map(localCart.map(item => [item.id, item]))
        
        // Merge: backend items + local items (local takes precedence for quantity)
        const mergedCart = backendCart.map(backendItem => {
          const localItem = localMap.get(backendItem.id)
          if (localItem) {
            localMap.delete(backendItem.id)
            return { ...backendItem, quantity: localItem.quantity }
          }
          return backendItem
        })
        
        // Add remaining local items
        localMap.forEach(item => mergedCart.push(item))
        
        setCartItems(mergedCart)
      }
    } catch (error) {
      console.error('Erreur chargement panier backend:', error)
    }
  }, [cartItems])

  useEffect(() => {
    if (promoCode) {
      localStorage.setItem('promoCode', JSON.stringify(promoCode))
    } else {
      localStorage.removeItem('promoCode')
    }
  }, [promoCode])

  const addToCart = (product) => {
    // Check if user is admin and prevent ordering
    const userStr = localStorage.getItem('user');
    let userRole = null;
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        userRole = user.role;
      } catch (e) {
        // ignore parsing errors
      }
    }
    
    if (userRole === 'ADMIN' || userRole === 'PREPARATEUR' || userRole === 'CAISSIER') {
      alert('⚠️ Vous êtes administrateur, vous ne pouvez pas commander.');
      return false;
    }

    // Check stock availability
    const availableStock = product.stock || 0;
    if (availableStock <= 0) {
      alert('❌ Ce produit est en rupture de stock.');
      return false;
    }

    // Check if product is already in cart - if yes, do not add more
    const existingItem = cartItems.find(item => item.id === product.id);
    if (existingItem) {
      alert('ℹ️ Ce produit est déjà dans votre panier. Utilisez le bouton "+" dans le panier pour augmenter la quantité.');
      return false;
    }
    
    // Add product with quantity 1 only
    setCartItems([...cartItems, { ...product, quantity: 1 }])
    return true;
  }

  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter(item => item.id !== productId))
  }

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId)
    } else {
      setCartItems(cartItems.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      ))
    }
  }

  const clearCart = () => {
    setCartItems([])
    setPromoCode(null)
  }

  // ← MODIFICATION ICI : Valider le code promo via l'API
  const applyPromoCode = async (code) => {
    const upperCode = code.toUpperCase().trim()
    
    if (!upperCode) {
      setPromoError('Veuillez entrer un code promo')
      return false
    }

    setValidating(true)
    setPromoError('')

    try {
      // Appeler l'API de validation
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
    return getSubtotalAfterDiscount() * TVA_RATE
  }

  const getTotalPrice = () => {
    return getSubtotalAfterDiscount() + getTVA()
  }

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const getShippingInfo = () => {
    const subtotal = getSubtotal()
    const remaining = FREE_SHIPPING_THRESHOLD - subtotal
    
    return {
      isFree: subtotal >= FREE_SHIPPING_THRESHOLD,
      threshold: FREE_SHIPPING_THRESHOLD,
      remaining: remaining > 0 ? remaining : 0,
      percentage: Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)
    }
  }

  const value = {
    cartItems,
    promoCode,
    promoError,
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
    TVA_RATE,
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