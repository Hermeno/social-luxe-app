import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { ChevronLeft, Plus, Package, Eye, Heart, Pause, Play, Trash2, ChevronRight, Lock } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, fonts, spacing, radius } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { Product } from '../../types/store.types'
import { useAuthStore } from '../../store/auth.store'
import * as storeService from '../../services/store.service'

type Nav = StackNavigationProp<AppStackParams>

// ─── Temporarily unavailable screen ──────────────────────────────────────────
function UnavailableScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  return (
    <View style={[u.container, { paddingTop: top, paddingBottom: bottom + 24 }]}>
      <View style={u.iconWrap}>
        <Lock size={40} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={u.title}>Em breve</Text>
      <Text style={u.sub}>
        A funcionalidade de venda ainda não está disponível.{'\n'}Estamos a trabalhar para lançar em breve.
      </Text>
      <TouchableOpacity
        style={u.btn}
        onPress={() => nav.navigate('Tabs', { screen: 'Feed' })}
        activeOpacity={0.85}
      >
        <Text style={u.btnText}>Voltar ao feed</Text>
      </TouchableOpacity>
    </View>
  )
}
const u = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconWrap:   { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF4FD', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:      { fontFamily: fonts.bold, fontSize: 22, color: colors.gray800, letterSpacing: -0.4, marginBottom: 10, textAlign: 'center' },
  sub:        { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, lineHeight: 22, textAlign: 'center', marginBottom: 36 },
  btn:        { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 40 },
  btnText:    { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },
})

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={s.statCard}>
      <View style={s.statIcon}>{icon}</View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function ListingItem({ product, onPress, onTogglePause, onDelete }: {
  product: Product
  onPress: () => void
  onTogglePause: () => void
  onDelete: () => void
}) {
  const catInfo = storeService.PRODUCT_CATEGORIES.find((c) => c.key === product.category)

  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.88}>
      <Image
        source={{ uri: product.images[0] }}
        style={s.itemImg}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      {product.status === 'paused' && (
        <View style={s.pausedOverlay}>
          <Text style={s.pausedText}>Pausado</Text>
        </View>
      )}
      <View style={s.itemBody}>
        <Text style={s.itemTitle} numberOfLines={2}>{product.title}</Text>
        <Text style={s.itemCat}>{catInfo?.icon} {catInfo?.label}</Text>
        <Text style={s.itemPrice}>{storeService.formatPrice(product.price, product.currency)}</Text>
        <View style={s.itemMeta}>
          <View style={s.itemMetaItem}>
            <Eye size={12} color={colors.gray400} />
            <Text style={s.itemMetaText}>{product.views}</Text>
          </View>
          <View style={s.itemMetaItem}>
            <Heart size={12} color={colors.gray400} />
            <Text style={s.itemMetaText}>{product.saves}</Text>
          </View>
          <View style={s.itemMetaItem}>
            <Package size={12} color={colors.gray400} />
            <Text style={s.itemMetaText}>{product.quantity >= 999 ? '∞' : product.quantity}</Text>
          </View>
        </View>
      </View>
      <View style={s.itemActions}>
        <TouchableOpacity
          style={s.itemActionBtn}
          onPress={(e) => { e.stopPropagation(); onTogglePause() }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {product.status === 'paused'
            ? <Play size={16} color={colors.secondary} />
            : <Pause size={16} color={colors.gray500} />
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={s.itemActionBtn}
          onPress={(e) => { e.stopPropagation(); onDelete() }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={16} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function MyStoreScreen() { return <UnavailableScreen /> }

function _MyStoreScreenFull() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user } = useAuthStore()

  const [listings, setListings] = useState<Product[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const totalViews = listings.reduce((s, p) => s + p.views, 0)
  const totalSaves = listings.reduce((s, p) => s + p.saves, 0)
  const activeCount = listings.filter((p) => p.status === 'active').length

  async function loadListings() {
    if (!user) return
    const items = await storeService.getUserListings(user.id)
    setListings(items)
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { loadListings() }, [user?.id]))

  async function handleTogglePause(productId: string) {
    await storeService.pauseListing(productId)
    loadListings()
  }

  function handleDelete(product: Product) {
    Alert.alert('Eliminar anúncio', `Remover "${product.title}" da loja?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          if (!user) return
          await storeService.deleteListing(product.id, user.id)
          loadListings()
        },
      },
    ])
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.gray800} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>A Minha Loja</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={listings}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, { paddingBottom: bottom + 90 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadListings() }} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* Seller header */}
            <LinearGradient colors={['#CA2851', '#6B5BDE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sellerBanner}>
              <View style={s.sellerAvatar}>
                <Text style={s.sellerInitial}>{user?.name[0]?.toUpperCase() ?? 'V'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sellerName}>{user?.name ?? 'Vendedor'}</Text>
                <Text style={s.sellerTagline}>Todos somos vendedores</Text>
              </View>
              <TouchableOpacity
                style={s.sellerStoreBtn}
                onPress={() => nav.navigate('Store')}
                activeOpacity={0.85}
              >
                <Text style={s.sellerStoreBtnText}>Ver loja</Text>
                <ChevronRight size={14} color={colors.primary} />
              </TouchableOpacity>
            </LinearGradient>

            {/* Stats row */}
            <View style={s.statsRow}>
              <StatCard
                icon={<Package size={18} color={colors.primary} />}
                value={String(activeCount)}
                label="Ativos"
              />
              <StatCard
                icon={<Eye size={18} color={colors.secondary} />}
                value={String(totalViews)}
                label="Visualizações"
              />
              <StatCard
                icon={<Heart size={18} color={colors.accent} />}
                value={String(totalSaves)}
                label="Guardados"
              />
            </View>

            {/* Create button */}
            <TouchableOpacity
              style={s.createBtn}
              onPress={() => nav.navigate('CreateListing')}
              activeOpacity={0.88}
            >
              <Plus size={18} color={colors.white} />
              <Text style={s.createBtnText}>Novo anúncio</Text>
            </TouchableOpacity>

            {listings.length > 0 && (
              <Text style={s.listingsTitle}>Os meus anúncios ({listings.length})</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🛍️</Text>
            <Text style={s.emptyTitle}>A tua loja está vazia</Text>
            <Text style={s.emptySub}>
              Seja médico, professor ou artesão — todos temos algo de valor para vender. Começa já!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListingItem
            product={item}
            onPress={() => nav.navigate('ProductDetail', { productId: item.id })}
            onTogglePause={() => handleTogglePause(item.id)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.gray800, letterSpacing: -0.3 },

  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 0 },

  sellerBanner: {
    borderRadius: radius.xl, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginBottom: spacing.md,
  },
  sellerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  sellerInitial: { fontFamily: fonts.bold, fontSize: 20, color: colors.white },
  sellerName: { fontFamily: fonts.bold, fontSize: 16, color: colors.white, letterSpacing: -0.3 },
  sellerTagline: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  sellerStoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  sellerStoreBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.gray100, borderRadius: radius.lg,
    padding: 14, alignItems: 'center', gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.gray800 },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray500 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 14, marginBottom: spacing.lg,
  },
  createBtnText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },

  listingsTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.gray600, marginBottom: spacing.sm },

  item: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1, borderColor: colors.gray200,
    marginBottom: 8,
  },
  itemImg: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.gray100, position: 'relative' },
  pausedOverlay: {
    position: 'absolute', top: 0, left: 0, width: 72, height: 72,
    borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  pausedText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.white },
  itemBody: { flex: 1, gap: 3 },
  itemTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray800, lineHeight: 19 },
  itemCat: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray500 },
  itemPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  itemMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  itemMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemMetaText: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray400 },
  itemActions: { gap: 12, paddingTop: 4 },
  itemActionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, gap: 10 },
  emptyIcon: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.gray800, letterSpacing: -0.3 },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 21 },
})
