import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from './api'
import { Product, CreateListingPayload, ListingFee, ProductCategory } from '../types/store.types'

const CACHE_KEY  = '@store_products_v1'
const CACHE_TTL  = 5 * 60 * 1000 // 5 min

interface CacheEntry {
  data: Product[]
  ts: number
}

async function readCache(): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry
  } catch { return null }
}

async function writeCache(data: Product[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getProducts(category?: ProductCategory): Promise<Product[]> {
  const url = category ? `/store?category=${category}` : '/store'
  try {
    const res = await api.get(url)
    const products: Product[] = res.data.data ?? res.data ?? []
    if (!category) writeCache(products)
    return products
  } catch {
    // Offline fallback: return cache regardless of TTL
    const cached = await readCache()
    if (cached) {
      return category
        ? cached.data.filter((p) => p.category === category)
        : cached.data
    }
    return []
  }
}

export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await api.get('/store?limit=5')
    return res.data.data ?? []
  } catch {
    const cached = await readCache()
    return cached ? cached.data.slice(0, 5) : []
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const res = await api.get(`/store/${id}`)
    return res.data.data ?? null
  } catch {
    const cached = await readCache()
    return cached?.data.find((p) => p.id === id) ?? null
  }
}

export async function getProductsBySeller(sellerId: string): Promise<Product[]> {
  try {
    const res = await api.get(`/store/seller/${sellerId}`)
    return res.data.data ?? []
  } catch {
    const cached = await readCache()
    return cached?.data.filter((p) => p.sellerId === sellerId) ?? []
  }
}

export async function getUserListings(userId: string): Promise<Product[]> {
  return getProductsBySeller(userId)
}

export async function createListing(
  _userId: string,
  _userName: string,
  _userAvatar: string | null,
  payload: CreateListingPayload,
): Promise<Product> {
  const { location, ...rest } = payload
  const body = { ...rest, city: location.city, country: location.country }
  const res = await api.post('/store', body)
  const product: Product = res.data.data
  // Invalidate cache so new listing appears
  const cached = await readCache()
  if (cached) await writeCache([product, ...cached.data])
  return product
}

export async function deleteListing(productId: string, _userId: string): Promise<void> {
  await api.delete(`/store/${productId}`)
  const cached = await readCache()
  if (cached) await writeCache(cached.data.filter((p) => p.id !== productId))
}

export async function pauseListing(productId: string): Promise<void> {
  await api.patch(`/store/${productId}/toggle`)
  const cached = await readCache()
  if (cached) {
    await writeCache(cached.data.map((p) =>
      p.id === productId ? { ...p, status: p.status === 'active' ? 'paused' : 'active' } : p,
    ))
  }
}

export async function searchProducts(query: string): Promise<Product[]> {
  try {
    const res = await api.get(`/store?q=${encodeURIComponent(query)}`)
    return res.data.data ?? []
  } catch {
    const q = query.toLowerCase()
    const cached = await readCache()
    if (!cached) return []
    return cached.data.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
  }
}

export async function getListingFee(_country: string): Promise<ListingFee> {
  // Hardcoded for now; extend with API call later if needed
  return { baseFee: 50, currency: 'MZN', description: 'Taxa de publicação' }
}

export async function calculateShipping(fromCity: string, toCity: string, _country: string): Promise<number> {
  if (fromCity.toLowerCase() === toCity.toLowerCase()) return 0
  return 200
}

// ─── Non-API helpers ─────────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES: { key: ProductCategory; label: string; icon: string }[] = [
  { key: 'moda',        label: 'Moda',         icon: '👗' },
  { key: 'tecnologia',  label: 'Tecnologia',   icon: '💻' },
  { key: 'habilidades', label: 'Habilidades',  icon: '⚡' },
  { key: 'cursos',      label: 'Cursos',       icon: '📚' },
  { key: 'arte',        label: 'Arte',         icon: '🎨' },
  { key: 'beleza',      label: 'Beleza',       icon: '✨' },
  { key: 'alimentos',   label: 'Alimentos',    icon: '🍽️' },
  { key: 'experiencias',label: 'Experiências', icon: '🌍' },
  { key: 'musica',      label: 'Música',       icon: '🎵' },
  { key: 'esportes',    label: 'Esportes',     icon: '⚽' },
  { key: 'casa',        label: 'Casa',         icon: '🏠' },
  { key: 'outros',      label: 'Outros',       icon: '📦' },
]

export function formatPrice(price: number, currency: string): string {
  if (currency === 'MZN') return `${price.toLocaleString('pt-MZ')} MZN`
  if (currency === 'EUR') return `€${price.toFixed(2)}`
  if (currency === 'USD') return `$${price.toFixed(2)}`
  if (currency === 'BRL') return `R$${price.toFixed(2)}`
  return `${price} ${currency}`
}
