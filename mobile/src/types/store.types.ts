export type ProductCategory =
  | 'moda'
  | 'tecnologia'
  | 'arte'
  | 'casa'
  | 'beleza'
  | 'habilidades'
  | 'cursos'
  | 'experiencias'
  | 'alimentos'
  | 'esportes'
  | 'musica'
  | 'outros'

export type ProductType = 'produto' | 'habilidade' | 'digital' | 'experiencia'

export type ProductStatus = 'active' | 'sold' | 'paused'

export interface ProductLocation {
  city: string
  country: string
  lat?: number
  lng?: number
}

export interface Product {
  id: string
  sellerId: string
  sellerName: string
  sellerAvatar: string | null
  sellerVerified?: boolean
  title: string
  description: string
  price: number
  currency: string
  category: ProductCategory
  type: ProductType
  images: string[]
  quantity: number
  location: ProductLocation
  hasShipping: boolean
  shippingPrice?: number
  tags: string[]
  createdAt: string
  status: ProductStatus
  views: number
  saves: number
  rating?: number
  reviewCount?: number
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface ListingFee {
  baseFee: number
  currency: string
  description: string
}

export interface CreateListingPayload {
  title: string
  description: string
  price: number
  currency: string
  category: ProductCategory
  type: ProductType
  images: string[]
  quantity: number
  location: ProductLocation
  hasShipping: boolean
  shippingPrice?: number
  tags: string[]
}
