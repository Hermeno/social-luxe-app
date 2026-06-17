import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { ShoppingBag, Search, Plus, Star, MapPin, X, ChevronRight, Sparkles, ChevronLeft } from 'lucide-react-native'
import { colors, fonts, spacing, radius } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { Product, ProductCategory } from '../../types/store.types'
import { useLuxStore } from '../../store/luxStore.store'
import * as storeService from '../../services/store.service'

const { width: W } = Dimensions.get('window')
const CARD_W = (W - 48) / 2
const HERO_H = 340

type Nav = StackNavigationProp<AppStackParams>

// ─── Hero Slide ───────────────────────────────────────────────────────────────
function HeroBanner({ products, onPress }: { products: Product[]; onPress: (p: Product) => void }) {
  const [active, setActive] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (products.length < 2) return
    const id = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % products.length
        scrollRef.current?.scrollTo({ x: next * W, animated: true })
        return next
      })
    }, 4000)
    return () => clearInterval(id)
  }, [products.length])

  if (products.length === 0) return <View style={{ height: HERO_H, backgroundColor: colors.gray100 }} />

  return (
    <View style={s.heroWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setActive(Math.round(e.nativeEvent.contentOffset.x / W))
        }
        scrollEventThrottle={16}
      >
        {products.map((p) => (
          <TouchableOpacity key={p.id} activeOpacity={0.95} onPress={() => onPress(p)} style={{ width: W }}>
            <View style={s.heroCard}>
              <Image
                source={{ uri: p.images[0] }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.75)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.heroContent}>
                <View style={s.heroCategoryPill}>
                  <Text style={s.heroCategoryText}>
                    {storeService.PRODUCT_CATEGORIES.find((c) => c.key === p.category)?.icon}{' '}
                    {storeService.PRODUCT_CATEGORIES.find((c) => c.key === p.category)?.label}
                  </Text>
                </View>
                <Text style={s.heroTitle} numberOfLines={2}>{p.title}</Text>
                <View style={s.heroMeta}>
                  <Text style={s.heroPrice}>{storeService.formatPrice(p.price, p.currency)}</Text>
                  {p.rating && (
                    <View style={s.heroRating}>
                      <Star size={12} color="#FFD700" fill="#FFD700" />
                      <Text style={s.heroRatingText}>{p.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Dots */}
      <View style={s.heroDots}>
        {products.map((_, i) => (
          <View key={i} style={[s.heroDot, i === active && s.heroDotActive]} />
        ))}
      </View>
    </View>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const saved = useLuxStore((s) => s.isSaved(product.id))
  const toggleSave = useLuxStore((s) => s.toggleSave)
  const scaleAnim = useRef(new Animated.Value(1)).current

  function handleSave() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()
    toggleSave(product.id)
  }

  const catInfo = storeService.PRODUCT_CATEGORIES.find((c) => c.key === product.category)

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.92}>
      <View style={s.cardImgWrap}>
        <Image
          source={{ uri: product.images[0] }}
          style={s.cardImg}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <TouchableOpacity style={s.cardSaveBtn} onPress={handleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View style={[s.cardSaveCircle, saved && s.cardSaveCircleActive]}>
              <ShoppingBag size={13} color={saved ? colors.white : colors.gray600} strokeWidth={2} />
            </View>
          </Animated.View>
        </TouchableOpacity>
        {product.quantity === 1 && (
          <View style={s.cardLastBadge}>
            <Text style={s.cardLastText}>Último</Text>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardCategory}>{catInfo?.icon} {catInfo?.label}</Text>
        <Text style={s.cardTitle} numberOfLines={2}>{product.title}</Text>
        <View style={s.cardFooter}>
          <Text style={s.cardPrice}>{storeService.formatPrice(product.price, product.currency)}</Text>
          {product.rating && (
            <View style={s.cardRating}>
              <Star size={11} color="#FFD700" fill="#FFD700" />
              <Text style={s.cardRatingText}>{product.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <View style={s.cardSeller}>
          <View style={s.cardSellerDot} />
          <Text style={s.cardSellerName} numberOfLines={1}>{product.sellerName}</Text>
          {product.sellerVerified && (
            <View style={s.verifiedDot} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Skills Row Card ──────────────────────────────────────────────────────────
function SkillCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.skillCard} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: product.images[0] }}
        style={s.skillImg}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
      <View style={s.skillContent}>
        <Text style={s.skillTitle} numberOfLines={2}>{product.title}</Text>
        <Text style={s.skillSeller} numberOfLines={1}>{product.sellerName}</Text>
        <Text style={s.skillPrice}>{storeService.formatPrice(product.price, product.currency)}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} style={s.seeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.seeAllText}>Ver todos</Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Manifesto Banner ────────────────────────────────────────────────────────
function ManifestoBanner({ onSell }: { onSell: () => void }) {
  return (
    <LinearGradient
      colors={['#CA2851', '#6B5BDE']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.manifesto}
    >
      <Sparkles size={20} color="rgba(255,255,255,0.9)" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.manifestoTitle}>Todos somos vendedores</Text>
        <Text style={s.manifestoSub}>
          Médico, professor, artesão ou músico — você sempre tem algo de valor. Começa a vender hoje.
        </Text>
      </View>
      <TouchableOpacity style={s.manifestoBtn} onPress={onSell} activeOpacity={0.85}>
        <Text style={s.manifestoBtnText}>Vender</Text>
      </TouchableOpacity>
    </LinearGradient>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StoreScreen() {
  const nav = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const cartCount = useLuxStore((s) => s.cartCount())
  const clearBadge = useLuxStore((s) => s.clearNewProductsBadge)

  const [products, setProducts]         = useState<Product[]>([])
  const [featured, setFeatured]         = useState<Product[]>([])
  const [activeCategory, setActiveCategory] = useState<ProductCategory | null>(null)
  const [searchMode, setSearchMode]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [refreshing, setRefreshing]     = useState(false)
  const [loading, setLoading]           = useState(true)

  const searchRef = useRef<TextInput>(null)

  const loadData = useCallback(async () => {
    try {
      const [all, feat] = await Promise.all([
        storeService.getProducts(activeCategory ?? undefined),
        storeService.getFeaturedProducts(),
      ])
      setProducts(all)
      setFeatured(feat)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeCategory])

  useEffect(() => { loadData() }, [loadData])

  useFocusEffect(useCallback(() => {
    clearBadge()
    loadData()
  }, [loadData]))

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const results = await storeService.searchProducts(q)
    setSearchResults(results)
  }

  function goToProduct(p: Product) {
    nav.navigate('ProductDetail', { productId: p.id })
  }

  const skills = products.filter((p) => p.type === 'habilidade' || p.type === 'digital')
  const physical = products.filter((p) => p.type === 'produto')
  const experiences = products.filter((p) => p.type === 'experiencia')

  return (
    <View style={s.container}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: top + 8 }]}>
        {searchMode ? (
          <View style={s.searchRow}>
            <View style={s.searchField}>
              <Search size={15} color={colors.gray400} strokeWidth={2} />
              <TextInput
                ref={searchRef}
                autoFocus
                placeholder="Buscar produtos, serviços..."
                placeholderTextColor={colors.gray400}
                value={searchQuery}
                onChangeText={handleSearch}
                style={s.searchInput}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={15} color={colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => { setSearchMode(false); setSearchQuery(''); setSearchResults([]) }}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => nav.goBack()} style={s.headerBackBtn} activeOpacity={0.7}>
              <ChevronLeft size={22} color={colors.gray800} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>luxee store</Text>
              <Text style={s.headerSub}>O mercado é de todos</Text>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity style={s.headerBtn} onPress={() => setSearchMode(true)} activeOpacity={0.7}>
                <Search size={22} color={colors.gray800} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={() => nav.navigate('MyStore')} activeOpacity={0.7}>
                <Plus size={22} color={colors.gray800} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerBtn} onPress={() => nav.navigate('Cart')} activeOpacity={0.7}>
                <View>
                  <ShoppingBag size={22} color={colors.gray800} strokeWidth={1.8} />
                  {cartCount > 0 && (
                    <View style={s.cartBadge}>
                      <Text style={s.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Search Results ──────────────────────────────────────────────── */}
      {searchMode && searchQuery.length >= 2 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(p) => p.id}
          contentContainerStyle={s.searchResultList}
          ListEmptyComponent={
            <View style={s.emptySearch}>
              <Text style={s.emptySearchText}>Nenhum resultado para "{searchQuery}"</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.searchResultRow} onPress={() => goToProduct(item)} activeOpacity={0.8}>
              <Image source={{ uri: item.images[0] }} style={s.searchResultImg} contentFit="cover" cachePolicy="memory-disk" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.searchResultTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.searchResultSeller} numberOfLines={1}>{item.sellerName}</Text>
                <Text style={s.searchResultPrice}>{storeService.formatPrice(item.price, item.currency)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData() }} tintColor={colors.primary} />
          }
        >
          {/* ── Category chips ─────────────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.catList}
          >
            <TouchableOpacity
              style={[s.catChip, !activeCategory && s.catChipActive]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[s.catChipText, !activeCategory && s.catChipTextActive]}>Tudo</Text>
            </TouchableOpacity>
            {storeService.PRODUCT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[s.catChip, activeCategory === cat.key && s.catChipActive]}
                onPress={() => setActiveCategory(cat.key)}
              >
                <Text style={[s.catChipText, activeCategory === cat.key && s.catChipTextActive]}>
                  {cat.icon} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Hero banner ─────────────────────────────────────────────── */}
          {!activeCategory && (
            <HeroBanner products={featured} onPress={goToProduct} />
          )}

          {/* ── Manifesto ───────────────────────────────────────────────── */}
          {!activeCategory && (
            <View style={s.sectionPad}>
              <ManifestoBanner onSell={() => nav.navigate('CreateListing')} />
            </View>
          )}

          {/* ── Skills & Services ───────────────────────────────────────── */}
          {skills.length > 0 && (
            <View style={s.section}>
              <SectionHeader
                title="Habilidades & Serviços"
                subtitle="Profissionais que vendem o que sabem fazer"
                onSeeAll={() => setActiveCategory('habilidades')}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.skillList}>
                {skills.map((p) => (
                  <SkillCard key={p.id} product={p} onPress={() => goToProduct(p)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Products Grid ────────────────────────────────────────────── */}
          {physical.length > 0 && (
            <View style={s.section}>
              <SectionHeader title="Produtos" subtitle="Itens à venda perto de você" />
              <View style={s.grid}>
                {physical.map((p) => (
                  <ProductCard key={p.id} product={p} onPress={() => goToProduct(p)} />
                ))}
              </View>
            </View>
          )}

          {/* ── Experiences ──────────────────────────────────────────────── */}
          {experiences.length > 0 && (
            <View style={s.section}>
              <SectionHeader title="Experiências" subtitle="Viva algo novo" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.skillList}>
                {experiences.map((p) => (
                  <SkillCard key={p.id} product={p} onPress={() => goToProduct(p)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── All products when category filter active ────────────────── */}
          {activeCategory && products.length > 0 && (
            <View style={s.section}>
              <SectionHeader title={storeService.PRODUCT_CATEGORIES.find((c) => c.key === activeCategory)?.label ?? ''} />
              <View style={s.grid}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} onPress={() => goToProduct(p)} />
                ))}
              </View>
            </View>
          )}

          {activeCategory && products.length === 0 && (
            <View style={s.emptyCategory}>
              <Text style={s.emptyCategoryIcon}>🛍️</Text>
              <Text style={s.emptyCategoryText}>Ainda não há produtos nesta categoria.</Text>
              <TouchableOpacity style={s.emptyCategoryBtn} onPress={() => nav.navigate('CreateListing')}>
                <Text style={s.emptyCategoryBtnText}>Sê o primeiro a vender</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.gray800, letterSpacing: -0.8 },
  headerSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray400, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 8, borderRadius: radius.md },
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.white,
  },
  cartBadgeText: { color: colors.white, fontSize: 9, fontFamily: fonts.extraBold, lineHeight: 11 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.gray800, padding: 0 },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },

  scroll: { paddingBottom: spacing.xl },

  catList: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    borderWidth: 1, borderColor: colors.gray200,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray600 },
  catChipTextActive: { color: colors.white },

  // Hero
  heroWrap: { width: W, height: HERO_H },
  heroCard: { width: W, height: HERO_H, backgroundColor: colors.gray200, overflow: 'hidden' },
  heroContent: {
    position: 'absolute', bottom: 28, left: 20, right: 20, gap: 8,
  },
  heroCategoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  heroCategoryText: { fontFamily: fonts.medium, fontSize: 12, color: colors.white },
  heroTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.white, letterSpacing: -0.5, lineHeight: 30 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroPrice: { fontFamily: fonts.bold, fontSize: 18, color: colors.white },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroRatingText: { fontFamily: fonts.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  heroDots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  heroDotActive: { width: 18, backgroundColor: colors.white },

  // Manifesto
  sectionPad: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  manifesto: {
    borderRadius: radius.xl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  manifestoTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white, letterSpacing: -0.3 },
  manifestoSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17 },
  manifestoBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 10,
    flexShrink: 0,
  },
  manifestoBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },

  // Sections
  section: { paddingTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.gray800, letterSpacing: -0.4 },
  sectionSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  seeAllText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },

  // Skills row
  skillList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  skillCard: {
    width: 220, height: 150, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.gray200,
  },
  skillImg: { ...StyleSheet.absoluteFillObject },
  skillContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, gap: 2 },
  skillTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.white, lineHeight: 18 },
  skillSeller: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  skillPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.white, marginTop: 4 },

  // Product grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  card: { width: CARD_W, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.gray200 },
  cardImgWrap: { position: 'relative', width: CARD_W, height: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W, backgroundColor: colors.gray100 },
  cardSaveBtn: { position: 'absolute', top: 8, right: 8 },
  cardSaveCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  cardSaveCircleActive: { backgroundColor: colors.primary },
  cardLastBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3,
  },
  cardLastText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.white },
  cardBody: { padding: 10, gap: 3 },
  cardCategory: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray500 },
  cardTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray800, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardRatingText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.gray600 },
  cardSeller: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  cardSellerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.secondary },
  cardSellerName: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray500, flex: 1 },
  verifiedDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#CA2851' },

  // Search results
  searchResultList: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  searchResultRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.gray200 },
  searchResultImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.gray100 },
  searchResultTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray800 },
  searchResultSeller: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },
  searchResultPrice: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  emptySearch: { paddingTop: 60, alignItems: 'center' },
  emptySearchText: { fontFamily: fonts.regular, fontSize: 15, color: colors.gray400 },

  // Empty category
  emptyCategory: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 },
  emptyCategoryIcon: { fontSize: 48 },
  emptyCategoryText: { fontFamily: fonts.regular, fontSize: 15, color: colors.gray500, textAlign: 'center' },
  emptyCategoryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyCategoryBtnText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.white },
})
