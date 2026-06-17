import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { ChevronLeft, Trash2, ShoppingBag, Plus, Minus } from 'lucide-react-native'
import { colors, fonts, spacing, radius } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { CartItem } from '../../types/store.types'
import { useLuxStore } from '../../store/luxStore.store'
import * as storeService from '../../services/store.service'

type Nav = StackNavigationProp<AppStackParams>

function CartRow({ item }: { item: CartItem }) {
  const updateQuantity = useLuxStore((s) => s.updateQuantity)
  const removeFromCart = useLuxStore((s) => s.removeFromCart)

  function confirmRemove() {
    Alert.alert('Remover item', `Remover "${item.product.title}" do carrinho?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          removeFromCart(item.product.id)
        },
      },
    ])
  }

  return (
    <View style={s.row}>
      <Image
        source={{ uri: item.product.images[0] }}
        style={s.rowImg}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={2}>{item.product.title}</Text>
        <Text style={s.rowSeller}>{item.product.sellerName}</Text>
        <Text style={s.rowPrice}>{storeService.formatPrice(item.product.price, item.product.currency)}</Text>
        {item.product.hasShipping && item.product.shippingPrice ? (
          <Text style={s.rowShipping}>
            + {storeService.formatPrice(item.product.shippingPrice, item.product.currency)} envio
          </Text>
        ) : item.product.hasShipping ? (
          <Text style={s.rowShippingFree}>Envio incluído</Text>
        ) : (
          <Text style={s.rowShipping}>Sem envio — levantamento presencial</Text>
        )}
      </View>
      <View style={s.rowRight}>
        <TouchableOpacity onPress={confirmRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Trash2 size={17} color={colors.gray400} />
        </TouchableOpacity>
        <View style={s.qtyRow}>
          <TouchableOpacity
            style={s.qtyBtn}
            onPress={() => {
              Haptics.selectionAsync()
              updateQuantity(item.product.id, item.quantity - 1)
            }}
          >
            <Minus size={14} color={colors.gray600} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={s.qty}>{item.quantity}</Text>
          <TouchableOpacity
            style={s.qtyBtn}
            onPress={() => {
              if (item.quantity >= item.product.quantity) return
              Haptics.selectionAsync()
              updateQuantity(item.product.id, item.quantity + 1)
            }}
          >
            <Plus size={14} color={colors.gray600} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default function CartScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const cartItems  = useLuxStore((s) => s.cartItems)
  const cartTotal  = useLuxStore((s) => s.cartTotal())
  const clearCart  = useLuxStore((s) => s.clearCart)

  const shippingTotal = cartItems.reduce(
    (sum, i) => sum + (i.product.hasShipping && i.product.shippingPrice ? i.product.shippingPrice * i.quantity : 0),
    0,
  )
  const grandTotal = cartTotal + shippingTotal

  function handleCheckout() {
    Alert.alert(
      'Pedido enviado!',
      'O vendedor receberá a tua encomenda e entrará em contacto contigo em breve.',
      [{ text: 'OK', onPress: () => { clearCart(); nav.goBack() } }],
    )
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.gray800} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Carrinho</Text>
        {cartItems.length > 0 ? (
          <TouchableOpacity onPress={() => Alert.alert('Limpar carrinho', 'Remover todos os itens?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Limpar', style: 'destructive', onPress: clearCart },
          ])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.clearText}>Limpar</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {cartItems.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <ShoppingBag size={44} color={colors.gray300} />
          </View>
          <Text style={s.emptyTitle}>Carrinho vazio</Text>
          <Text style={s.emptySub}>Encontra algo na luxee store e adiciona aqui.</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => nav.goBack()} activeOpacity={0.88}>
            <Text style={s.emptyBtnText}>Explorar a loja</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={(i) => i.product.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <CartRow item={item} />}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />

          {/* Order summary */}
          <View style={[s.summary, { paddingBottom: bottom + 16 }]}>
            <View style={s.summaryRow}>
              <Text style={s.summaryKey}>Subtotal</Text>
              <Text style={s.summaryVal}>{storeService.formatPrice(cartTotal, 'MZN')}</Text>
            </View>
            {shippingTotal > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.summaryKey}>Envio</Text>
                <Text style={s.summaryVal}>{storeService.formatPrice(shippingTotal, 'MZN')}</Text>
              </View>
            )}
            <View style={[s.summaryRow, s.summaryTotal]}>
              <Text style={s.totalKey}>Total</Text>
              <Text style={s.totalVal}>{storeService.formatPrice(grandTotal, 'MZN')}</Text>
            </View>
            <TouchableOpacity style={s.checkoutBtn} onPress={handleCheckout} activeOpacity={0.88}>
              <Text style={s.checkoutText}>Finalizar pedido</Text>
            </TouchableOpacity>
            <Text style={s.checkoutHint}>
              O vendedor entrará em contacto para confirmar a entrega.
            </Text>
          </View>
        </>
      )}
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
  clearText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.accent },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.semiBold, fontSize: 20, color: colors.gray800, letterSpacing: -0.3 },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray400, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
  },
  emptyBtnText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },

  list: { padding: spacing.md },
  separator: { height: 1, backgroundColor: colors.gray100, marginVertical: 4 },

  row: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  rowImg: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.gray100 },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray800, lineHeight: 19 },
  rowSeller: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400 },
  rowPrice: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, marginTop: 2 },
  rowShipping: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray400 },
  rowShippingFree: { fontFamily: fonts.regular, fontSize: 11, color: colors.secondary },
  rowRight: { alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },
  qty: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.gray800, minWidth: 20, textAlign: 'center' },

  summary: {
    padding: spacing.md,
    borderTopWidth: 0.5, borderTopColor: colors.gray200,
    gap: 10,
    backgroundColor: colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryKey: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray600 },
  summaryVal: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray800 },
  summaryTotal: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.gray200 },
  totalKey: { fontFamily: fonts.bold, fontSize: 17, color: colors.gray800 },
  totalVal: { fontFamily: fonts.bold, fontSize: 17, color: colors.primary },
  checkoutBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  checkoutText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.white },
  checkoutHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, textAlign: 'center' },
})
