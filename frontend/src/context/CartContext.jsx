// frontend/src/context/CartContext.jsx
import { createContext, useState, useContext, useEffect } from 'react'
import api from '../api/axios'  // ← AJOUTER CET IMPORT

const CartContext = createContext()

const TVA_RATE = 0.19 // 19% TVA
const FREE_SHIPPING_THRESHOLD = 300 // Livraison gratuite à partir de 300 DH

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([])
  const [promoCode, setPromoCode] = useState(null)
  const [promoError, setPromoError] = useState('')
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    const savedCart = localStorage.getItem('cart')
    const savedPromo = localStorage.getItem('promoCode')
    
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
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

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems))
  }, [cartItems])

  useEffect(() => {
    if (promoCode) {
      localStorage.setItem('promoCode', JSON.stringify(promoCode))
    } else {
      localStorage.removeItem('promoCode')
    }
  }, [promoCode])

  const addToCart = (product) => {
    const existingItem = cartItems.find(item => item.id === product.id)
    
    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCartItems([...cartItems, { ...product, quantity: 1 }])
    }
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