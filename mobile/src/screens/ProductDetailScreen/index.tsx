import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft, ShoppingBag, Heart, Star, MapPin, Truck, Check, Share2, Shield } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, fonts, spacing, radius } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { Product } from '../../types/store.types'
import { useLuxStore } from '../../store/luxStore.store'
import * as storeService from '../../services/store.service'

const { width: W } = Dimensions.get('window')
type Nav = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'ProductDetail'>

export default function ProductDetailScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()
  const { productId } = route.params

  const addToCart   = useLuxStore((s) => s.addToCart)
  const cartCount   = useLuxStore((s) => s.cartCount())
  const isSaved     = useLuxStore((s) => s.isSaved(productId))
  const toggleSave  = useLuxStore((s) => s.toggleSave)

  const [product, setProduct]       = useState<Product | null>(null)
  const [related, setRelated]       = useState<Product[]>([])
  const [activeImg, setActiveImg]   = useState(0)
  const [added, setAdded]           = useState(false)

  const btnScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    storeService.getProductById(productId).then((p) => {
      setProduct(p)
      if (p) {
        storeService.getProductsBySeller(p.sellerId).then((all) =>
          setRelated(all.filter((x) => x.id !== p.id).slice(0, 4)),
        )
      }
    })
  }, [productId])

  function handleAddToCart() {
    if (!product || product.status !== 'active') return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    addToCart(product)
    setAdded(true)
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.94, duration: 100, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true } as any),
    ]).start()
    setTimeout(() => setAdded(false), 2500)
  }

  function handleBuyNow() {
    if (!product) return
    handleAddToCart()
    nav.navigate('Cart')
  }

  if (!product) {
    return (
      <View style={[s.loading, { paddingTop: top }]}>
        <View style={s.loadingBar} />
        <View style={[s.loadingBar, { width: '60%', marginTop: 12 }]} />
      </View>
    )
  }

  const catInfo = storeService.PRODUCT_CATEGORIES.find((c) => c.key === product.category)

  return (
    <View style={s.container}>
      {/* ── Header overlay on image ──────────────────────────────────────── */}
      <View style={[s.headerOverlay, { paddingTop: top + 4 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()} activeOpacity={0.8}>
          <ChevronLeft size={22} color={colors.white} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleSave(productId) }}
            activeOpacity={0.8}
          >
            <Heart size={20} color={isSaved ? colors.accent : colors.white} fill={isSaved ? colors.accent : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => nav.navigate('Cart')} activeOpacity={0.8}>
            <ShoppingBag size={20} color={colors.white} />
            {cartCount > 0 && (
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + 120 }}>
        {/* ── Image gallery ────────────────────────────────────────────── */}
        <View style={s.gallery}>
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / W))}
          >
            {product.images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={s.galleryImg} contentFit="cover" cachePolicy="memory-disk" />
            ))}
          </ScrollView>
          {product.images.length > 1 && (
            <View style={s.galleryDots}>
              {product.images.map((_, i) => (
                <View key={i} style={[s.dot, i === activeImg && s.dotActive]} />
              ))}
            </View>
          )}
          {product.status === 'sold' && (
            <View style={s.soldOverlay}>
              <Text style={s.soldText}>Esgotado</Text>
            </View>
          )}
        </View>

        {/* ── Product info ─────────────────────────────────────────────── */}
        <View style={s.info}>
          {/* Category + rating row */}
          <View style={s.topRow}>
            <View style={s.catPill}>
              <Text style={s.catPillText}>{catInfo?.icon} {catInfo?.label}</Text>
            </View>
            {product.rating && (
              <View style={s.ratingRow}>
                <Star size={13} color="#FFD700" fill="#FFD700" />
                <Text style={s.ratingText}>{product.rating.toFixed(1)}</Text>
                <Text style={s.reviewCount}>({product.reviewCount} avaliações)</Text>
              </View>
            )}
          </View>

          <Text style={s.title}>{product.title}</Text>

          {/* Price */}
          <View style={s.priceRow}>
            <Text style={s.price}>{storeService.formatPrice(product.price, product.currency)}</Text>
            {product.quantity > 0 && product.quantity <= 5 && (
              <View style={s.stockBadge}>
                <Text style={s.stockText}>Apenas {product.quantity} restantes</Text>
              </View>
            )}
          </View>

          {/* Seller card */}
          <TouchableOpacity
            style={s.sellerCard}
            onPress={() => nav.navigate('Profile', { userId: product.sellerId })}
            activeOpacity={0.85}
          >
            <View style={s.sellerAvatar}>
              <Text style={s.sellerInitial}>{product.sellerName[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.sellerName}>{product.sellerName}</Text>
                {product.sellerVerified && (
                  <View style={s.verifiedBadge}>
                    <Check size={9} color={colors.white} strokeWidth={3} />
                  </View>
                )}
              </View>
              <Text style={s.sellerLabel}>Vendedor</Text>
            </View>
            <ChevronLeft size={16} color={colors.gray400} style={{ transform: [{ scaleX: -1 }] }} />
          </TouchableOpacity>

          {/* Location & shipping */}
          <View style={s.metaCards}>
            <View style={s.metaCard}>
              <MapPin size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.metaCardTitle}>Localização</Text>
                <Text style={s.metaCardValue}>{product.location.city}, {product.location.country}</Text>
              </View>
            </View>
            <View style={s.metaCard}>
              <Truck size={16} color={product.hasShipping ? colors.secondary : colors.gray400} />
              <View style={{ flex: 1 }}>
                <Text style={s.metaCardTitle}>Envio</Text>
                <Text style={s.metaCardValue}>
                  {product.hasShipping
                    ? product.shippingPrice
                      ? `${storeService.formatPrice(product.shippingPrice, product.currency)}`
                      : 'Incluído no preço'
                    : 'Apenas presencial'}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={s.descBlock}>
            <Text style={s.descTitle}>Descrição</Text>
            <Text style={s.desc}>{product.description}</Text>
          </View>

          {/* Tags */}
          {product.tags.length > 0 && (
            <View style={s.tagsRow}>
              {product.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Trust badges */}
          <View style={s.trustRow}>
            <View style={s.trustItem}>
              <Shield size={14} color={colors.secondary} />
              <Text style={s.trustText}>Compra protegida</Text>
            </View>
            <View style={s.trustItem}>
              <Check size={14} color={colors.secondary} />
              <Text style={s.trustText}>Vendedor verificado</Text>
            </View>
          </View>

          {/* Related products */}
          {related.length > 0 && (
            <View style={s.relatedSection}>
              <Text style={s.relatedTitle}>Mais deste vendedor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {related.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={s.relatedCard}
                    onPress={() => nav.replace('ProductDetail', { productId: p.id })}
                    activeOpacity={0.88}
                  >
                    <Image source={{ uri: p.images[0] }} style={s.relatedImg} contentFit="cover" cachePolicy="memory-disk" />
                    <Text style={s.relatedName} numberOfLines={2}>{p.title}</Text>
                    <Text style={s.relatedPrice}>{storeService.formatPrice(p.price, p.currency)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      {product.status === 'active' && (
        <View style={[s.cta, { paddingBottom: bottom + 16 }]}>
          <TouchableOpacity style={s.ctaSave} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleSave(productId) }} activeOpacity={0.8}>
            <Heart size={22} color={isSaved ? colors.accent : colors.gray600} fill={isSaved ? colors.accent : 'transparent'} />
          </TouchableOpacity>
          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: btnScale }] }]}>
            <TouchableOpacity style={[s.ctaBtn, added && s.ctaBtnDone]} onPress={handleAddToCart} activeOpacity={0.9}>
              {added ? (
                <>
                  <Check size={18} color={colors.white} strokeWidth={2.5} />
                  <Text style={s.ctaBtnText}>Adicionado!</Text>
                </>
              ) : (
                <>
                  <ShoppingBag size={18} color={colors.white} />
                  <Text style={s.ctaBtnText}>Adicionar ao carrinho</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={s.ctaBuyNow} onPress={handleBuyNow} activeOpacity={0.9}>
            <Text style={s.ctaBuyNowText}>Comprar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  loading: { flex: 1, paddingHorizontal: spacing.md, paddingTop: 100 },
  loadingBar: { height: 18, width: '80%', borderRadius: radius.sm, backgroundColor: colors.gray100 },

  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { color: colors.white, fontSize: 8, fontFamily: fonts.extraBold, lineHeight: 10 },

  gallery: { width: W, height: W * 1.05, backgroundColor: colors.gray100 },
  galleryImg: { width: W, height: W * 1.05 },
  galleryDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.25)' },
  dotActive: { width: 18, backgroundColor: colors.primary },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  soldText: { fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: 2 },

  info: { padding: spacing.md, gap: spacing.sm },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catPill: {
    backgroundColor: colors.gray100, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  catPillText: { fontFamily: fonts.medium, fontSize: 12, color: colors.gray600 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.bold, fontSize: 13, color: colors.gray800 },
  reviewCount: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400 },

  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.gray800, letterSpacing: -0.5, lineHeight: 28, marginTop: 4 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  price: { fontFamily: fonts.bold, fontSize: 26, color: colors.primary, letterSpacing: -0.5 },
  stockBadge: { backgroundColor: '#FFF3E0', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  stockText: { fontFamily: fonts.semiBold, fontSize: 11, color: '#E65100' },

  sellerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    padding: 14, marginTop: 4,
  },
  sellerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sellerInitial: { fontFamily: fonts.bold, fontSize: 18, color: colors.white },
  sellerName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.gray800 },
  sellerLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, marginTop: 1 },
  verifiedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  metaCards: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  metaCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.gray100, borderRadius: radius.lg, padding: 12,
  },
  metaCardTitle: { fontFamily: fonts.medium, fontSize: 11, color: colors.gray500 },
  metaCardValue: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.gray800, marginTop: 2 },

  descBlock: { gap: 6, marginTop: 4 },
  descTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.gray800 },
  desc: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray600, lineHeight: 22 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { backgroundColor: colors.gray100, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray600 },

  trustRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },

  relatedSection: { marginTop: spacing.sm, gap: spacing.sm },
  relatedTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.gray800 },
  relatedCard: { width: 130, gap: 6 },
  relatedImg: { width: 130, height: 130, borderRadius: radius.md, backgroundColor: colors.gray100 },
  relatedName: { fontFamily: fonts.medium, fontSize: 12, color: colors.gray800, lineHeight: 17 },
  relatedPrice: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },

  // CTA bar
  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    flexDirection: 'row', gap: 10, alignItems: 'center',
    borderTopWidth: 0.5, borderTopColor: colors.gray200,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12,
  },
  ctaSave: {
    width: 48, height: 48, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBtn: {
    flex: 1, height: 48, borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaBtnDone: { backgroundColor: colors.secondary },
  ctaBtnText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },
  ctaBuyNow: {
    height: 48, paddingHorizontal: 18, borderRadius: radius.md,
    backgroundColor: colors.gray800,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaBuyNowText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },
})
