import { create } from 'zustand'
import { CartItem, Product } from '../types/store.types'

interface LuxStoreState {
  cartItems: CartItem[]
  savedItems: string[]
  newProductsBadge: number

  addToCart: (product: Product) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  cartTotal: () => number
  cartCount: () => number

  toggleSave: (productId: string) => void
  isSaved: (productId: string) => boolean

  setNewProductsBadge: (count: number) => void
  clearNewProductsBadge: () => void
}

export const useLuxStore = create<LuxStoreState>((set, get) => ({
  cartItems: [],
  savedItems: [],
  newProductsBadge: 0,

  addToCart: (product) =>
    set((s) => {
      const existing = s.cartItems.find((i) => i.product.id === product.id)
      if (existing) {
        return {
          cartItems: s.cartItems.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: Math.min(i.quantity + 1, product.quantity) }
              : i,
          ),
        }
      }
      return { cartItems: [...s.cartItems, { product, quantity: 1 }] }
    }),

  removeFromCart: (productId) =>
    set((s) => ({ cartItems: s.cartItems.filter((i) => i.product.id !== productId) })),

  updateQuantity: (productId, quantity) =>
    set((s) => ({
      cartItems:
        quantity <= 0
          ? s.cartItems.filter((i) => i.product.id !== productId)
          : s.cartItems.map((i) =>
              i.product.id === productId ? { ...i, quantity } : i,
            ),
    })),

  clearCart: () => set({ cartItems: [] }),

  cartTotal: () =>
    get().cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0),

  cartCount: () =>
    get().cartItems.reduce((sum, i) => sum + i.quantity, 0),

  toggleSave: (productId) =>
    set((s) => ({
      savedItems: s.savedItems.includes(productId)
        ? s.savedItems.filter((id) => id !== productId)
        : [...s.savedItems, productId],
    })),

  isSaved: (productId) => get().savedItems.includes(productId),

  setNewProductsBadge: (count) => set({ newProductsBadge: count }),
  clearNewProductsBadge: () => set({ newProductsBadge: 0 }),
}))
