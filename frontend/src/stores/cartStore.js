import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useCartStore = create(
  persist(
    (set, get) => ({
      // État
      cartItems: [],
      promoCode: null,
      promoError: '',
      validating: false,
      editingOrder: null,

      // Actions - Gestion des items
      addToCart: (product, variantId = null) => {
        const { cartItems } = get()
        const existingItemIndex = cartItems.findIndex(
          item => item.id === product.id && item.variantId === variantId
        )

        if (existingItemIndex >= 0) {
          set({
            cartItems: cartItems.map((item, index) =>
              index === existingItemIndex
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          })
        } else {
          const cartItem = {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1,
            variantId,
            variantType: null,
            variantValue: null
          }

          // Si c'est une variante, ajouter les infos
          if (variantId && product.variants) {
            const variant = product.variants.find(v => v.id === variantId)
            if (variant) {
              cartItem.variantType = variant.type
              cartItem.variantValue = variant.value
              cartItem.price = variant.priceTTC || variant.price || product.price
            }
          }

          set({ cartItems: [...cartItems, cartItem] })
        }
      },

      removeFromCart: (productId, variantId = null) => {
        const { cartItems } = get()
        set({
          cartItems: cartItems.filter(
            item => !(item.id === productId && item.variantId === variantId)
          )
        })
      },

      updateQuantity: (productId, newQuantity, variantId = null) => {
        if (newQuantity <= 0) {
          get().removeFromCart(productId, variantId)
          return
        }

        const { cartItems } = get()
        set({
          cartItems: cartItems.map(item =>
            item.id === productId && item.variantId === variantId
              ? { ...item, quantity: newQuantity }
              : item
          )
        })
      },

      clearCart: () => set({ 
        cartItems: [], 
        promoCode: null, 
        promoError: '', 
        editingOrder: null 
      }),

      // Actions - Codes promo
      applyPromoCode: async (code) => {
        set({ validating: true, promoError: '' })
        
        try {
          const { cartItems } = get()
          const response = await fetch('/api/promo-codes/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              code,
              cartTotal: get().getTotalPrice(),
              items: cartItems
            })
          })

          const data = await response.json()

          if (response.ok) {
            set({ 
              promoCode: data.promoCode, 
              validating: false,
              promoError: '' 
            })
            return true
          } else {
            set({ 
              promoError: data.message, 
              validating: false 
            })
            return false
          }
        } catch (error) {
          set({ 
            promoError: 'Erreur lors de la validation', 
            validating: false 
          })
          return false
        }
      },

      removePromoCode: () => set({ 
        promoCode: null, 
        promoError: '' 
      }),

      // Actions - Commande en cours d'édition
      setEditingOrder: (order) => {
        if (order) {
          // Charger les items de la commande dans le panier
          const cartItems = order.items.map(item => ({
            id: item.productId,
            name: item.name || item.product?.name,
            price: item.price,
            image: item.product?.image,
            quantity: item.quantity,
            variantId: item.variantId,
            variantType: item.variantType,
            variantValue: item.variantValue
          }))
          
          set({ 
            editingOrder: order,
            cartItems,
            promoCode: null,
            promoError: ''
          })
        } else {
          set({ editingOrder: null })
        }
      },

      // Getters
      getTotalPrice: () => {
        const { cartItems, promoCode } = get()
        const subtotal = cartItems.reduce(
          (total, item) => total + item.price * item.quantity, 
          0
        )
        
        const discount = get().getDiscount()
        return Math.max(0, subtotal - discount)
      },

      getSubtotal: () => {
        const { cartItems } = get()
        return cartItems.reduce(
          (total, item) => total + item.price * item.quantity, 
          0
        )
      },

      getDiscount: () => {
        const { promoCode, cartItems } = get()
        if (!promoCode) return 0

        const subtotal = cartItems.reduce(
          (total, item) => total + item.price * item.quantity, 
          0
        )

        let discount = 0
        if (promoCode.discountType === 'percentage') {
          discount = (subtotal * promoCode.discountValue) / 100
        } else {
          discount = promoCode.discountValue
        }

        // Appliquer le montant maximum de réduction si défini
        if (promoCode.maxDiscountAmount) {
          discount = Math.min(discount, promoCode.maxDiscountAmount)
        }

        return Math.min(discount, subtotal)
      },

      getItemCount: () => {
        const { cartItems } = get()
        return cartItems.reduce((total, item) => total + item.quantity, 0)
      },

      getShippingInfo: () => {
        const subtotal = get().getSubtotal()
        const freeShippingThreshold = 500 // DH
        
        return {
          isFree: subtotal >= freeShippingThreshold,
          threshold: freeShippingThreshold,
          remaining: Math.max(0, freeShippingThreshold - subtotal)
        }
      },

      // Utilitaires
      isInCart: (productId, variantId = null) => {
        const { cartItems } = get()
        return cartItems.some(
          item => item.id === productId && item.variantId === variantId
        )
      },

      getCartItem: (productId, variantId = null) => {
        const { cartItems } = get()
        return cartItems.find(
          item => item.id === productId && item.variantId === variantId
        )
      }
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cartItems: state.cartItems,
        promoCode: state.promoCode
      })
    }
  )
)

export default useCartStore