import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { ChevronLeft, ChevronRight, Plus, X, Check, Camera, Truck, MapPin, Tag, Info, Lock } from 'lucide-react-native'
import { colors, fonts, spacing, radius } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { ProductCategory, ProductType, CreateListingPayload } from '../../types/store.types'
import { useAuthStore } from '../../store/auth.store'
import * as storeService from '../../services/store.service'
import { useSafeAreaInsets as _useSafeAreaInsets } from 'react-native-safe-area-context'

const { width: W } = Dimensions.get('window')
type Nav = StackNavigationProp<AppStackParams>

export default function CreateListingScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = _useSafeAreaInsets()
  return (
    <View style={[_u.container, { paddingTop: top, paddingBottom: bottom + 24 }]}>
      <View style={_u.iconWrap}>
        <Lock size={40} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={_u.title}>Em breve</Text>
      <Text style={_u.sub}>
        A funcionalidade de venda ainda não está disponível.{'\n'}Estamos a trabalhar para lançar em breve.
      </Text>
      <TouchableOpacity
        style={_u.btn}
        onPress={() => nav.navigate('Tabs', { screen: 'Feed' })}
        activeOpacity={0.85}
      >
        <Text style={_u.btnText}>Voltar ao feed</Text>
      </TouchableOpacity>
    </View>
  )
}
const _u = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF4FD', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:     { fontFamily: fonts.bold, fontSize: 22, color: colors.gray800, letterSpacing: -0.4, marginBottom: 10, textAlign: 'center' },
  sub:       { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, lineHeight: 22, textAlign: 'center', marginBottom: 36 },
  btn:       { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 40 },
  btnText:   { fontFamily: fonts.semiBold, fontSize: 15, color: colors.white },
})

const STEPS = ['Produto', 'Preço', 'Envio']

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <View style={sb.row}>
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <View style={sb.step}>
            <View style={[sb.circle, i <= current && sb.circleActive, i < current && sb.circleDone]}>
              {i < current
                ? <Check size={13} color={colors.white} strokeWidth={3} />
                : <Text style={[sb.circleText, i === current && sb.circleTextActive]}>{i + 1}</Text>
              }
            </View>
            <Text style={[sb.label, i === current && sb.labelActive]}>{label}</Text>
          </View>
          {i < STEPS.length - 1 && (
            <View style={[sb.line, i < current && sb.lineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  )
}
const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: 16 },
  step: { alignItems: 'center', gap: 4 },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray100, borderWidth: 2, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  circleActive: { borderColor: colors.primary, backgroundColor: colors.white },
  circleDone:   { backgroundColor: colors.primary, borderColor: colors.primary },
  circleText:   { fontFamily: fonts.semiBold, fontSize: 12, color: colors.gray400 },
  circleTextActive: { color: colors.primary },
  label:        { fontFamily: fonts.regular, fontSize: 11, color: colors.gray400 },
  labelActive:  { color: colors.primary, fontFamily: fonts.semiBold },
  line:         { flex: 1, height: 2, backgroundColor: colors.gray200, marginBottom: 16 },
  lineDone:     { backgroundColor: colors.primary },
})

// ─── Main Screen (disabled — use CreateListingScreen above) ──────────────────
function _CreateListingScreenFull() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user } = useAuthStore()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 — Produto
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]     = useState<ProductCategory>('outros')
  const [type, setType]             = useState<ProductType>('produto')
  const [images, setImages]         = useState<string[]>([])

  // Step 2 — Preço
  const [price, setPrice]           = useState('')
  const [quantity, setQuantity]     = useState('1')

  // Step 3 — Envio
  const [city, setCity]             = useState('')
  const [hasShipping, setHasShipping] = useState(false)
  const [shippingPrice, setShippingPrice] = useState('')
  const [listingFeeMsg, setListingFeeMsg] = useState('')

  const slideAnim = useRef(new Animated.Value(0)).current

  function animateNext() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start()
  }

  function goNext() {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    if (step === 2) { handleSubmit(); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateNext()
    if (step === 1) loadListingFee()
    setStep((s) => s + 1)
  }

  function goPrev() {
    if (step === 0) { nav.goBack(); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateNext()
    setStep((s) => s - 1)
  }

  function validateStep0(): boolean {
    if (title.trim().length < 3) { Alert.alert('Título muito curto', 'Adiciona um título com pelo menos 3 caracteres.'); return false }
    if (description.trim().length < 10) { Alert.alert('Descrição necessária', 'Descreve melhor o teu produto.'); return false }
    return true
  }

  function validateStep1(): boolean {
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Preço inválido', 'Indica um preço válido.')
      return false
    }
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 1) {
      Alert.alert('Quantidade inválida', 'Indica uma quantidade válida.')
      return false
    }
    return true
  }

  async function loadListingFee() {
    const fee = await storeService.getListingFee('Mozambique')
    setListingFeeMsg(`Taxa de publicação: ${storeService.formatPrice(fee.baseFee, fee.currency)}`)
  }

  async function pickImage() {
    if (images.length >= 5) { Alert.alert('Máximo 5 imagens'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (!result.canceled && result.assets[0]) {
      setImages((prev) => [...prev, result.assets[0].uri])
    }
  }

  async function handleSubmit() {
    if (!city.trim()) { Alert.alert('Localização necessária', 'Indica a tua cidade.'); return }
    if (!user) { Alert.alert('Erro', 'Precisas de estar autenticado.'); return }
    setSubmitting(true)
    try {
      const payload: CreateListingPayload = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        currency: 'MZN',
        category,
        type,
        images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800'],
        quantity: Number(quantity),
        location: { city: city.trim(), country: 'Mozambique' },
        hasShipping,
        shippingPrice: hasShipping && shippingPrice ? Number(shippingPrice) : undefined,
        tags: [category, type],
      }
      await storeService.createListing(user.id, user.name, user.avatar ?? null, payload)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Publicado!', 'O teu produto já está na luxee store.', [
        { text: 'Ver loja', onPress: () => { nav.goBack(); nav.navigate('Store') } },
        { text: 'OK', onPress: () => nav.goBack() },
      ])
    } catch {
      Alert.alert('Erro', 'Não foi possível publicar o produto. Tenta novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={goPrev} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.gray800} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Criar Anúncio</Text>
        <View style={{ width: 38 }} />
      </View>

      <StepBar current={step} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>

          {/* ═══ STEP 0 — Produto ═════════════════════════════════════════ */}
          {step === 0 && (
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Conta-nos sobre o que vendes</Text>
              <Text style={s.stepSub}>Médico, professor, artesão, ou simplesmente tu — todos temos algo de valor.</Text>

              {/* Images */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>Fotos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {images.map((uri, i) => (
                    <View key={i} style={s.imgThumb}>
                      <Image source={{ uri }} style={s.imgThumbImg} contentFit="cover" />
                      <TouchableOpacity
                        style={s.imgRemove}
                        onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={12} color={colors.white} strokeWidth={3} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {images.length < 5 && (
                    <TouchableOpacity style={s.addImgBtn} onPress={pickImage} activeOpacity={0.8}>
                      <Camera size={24} color={colors.gray400} />
                      <Text style={s.addImgText}>Adicionar</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* Type selector */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>O que estás a vender?</Text>
                <View style={s.typeRow}>
                  {([
                    { key: 'produto',     icon: '📦', label: 'Produto' },
                    { key: 'habilidade',  icon: '⚡', label: 'Habilidade' },
                    { key: 'digital',     icon: '💻', label: 'Digital' },
                    { key: 'experiencia', icon: '🌍', label: 'Experiência' },
                  ] as { key: ProductType; icon: string; label: string }[]).map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.typeChip, type === t.key && s.typeChipActive]}
                      onPress={() => setType(t.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.typeIcon}>{t.icon}</Text>
                      <Text style={[s.typeLabel, type === t.key && s.typeLabelActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Title */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>Título *</Text>
                <TextInput
                  style={s.input}
                  placeholder="Ex: Aulas de guitarra, Vestido artesanal..."
                  placeholderTextColor={colors.gray400}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={80}
                  returnKeyType="next"
                />
                <Text style={s.charCount}>{title.length}/80</Text>
              </View>

              {/* Description */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>Descrição *</Text>
                <TextInput
                  style={[s.input, s.inputMulti]}
                  placeholder="Descreve o produto, os benefícios, o que está incluído..."
                  placeholderTextColor={colors.gray400}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={s.charCount}>{description.length}/500</Text>
              </View>

              {/* Category */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {storeService.PRODUCT_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[s.catChip, category === cat.key && s.catChipActive]}
                      onPress={() => setCategory(cat.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.catChipText, category === cat.key && s.catChipTextActive]}>
                        {cat.icon} {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* ═══ STEP 1 — Preço ═══════════════════════════════════════════ */}
          {step === 1 && (
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Define o teu preço</Text>
              <Text style={s.stepSub}>Sê justo consigo mesmo. O teu trabalho tem valor.</Text>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Preço (MZN) *</Text>
                <View style={s.priceInputWrap}>
                  <Text style={s.priceCurrency}>MZN</Text>
                  <TextInput
                    style={s.priceInput}
                    placeholder="0"
                    placeholderTextColor={colors.gray400}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Quantidade disponível *</Text>
                <View style={s.qtyRow}>
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => setQuantity((q) => String(Math.max(1, Number(q) - 1)))}
                  >
                    <Text style={s.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.qtyInput}
                    value={quantity}
                    onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => setQuantity((q) => String(Number(q) + 1))}
                  >
                    <Text style={s.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                {type === 'habilidade' || type === 'digital' ? (
                  <TouchableOpacity onPress={() => setQuantity('999')} style={s.unlimitedBtn}>
                    <Text style={s.unlimitedText}>Marcar como ilimitado</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {price && Number(price) > 0 && (
                <View style={s.previewCard}>
                  <Text style={s.previewLabel}>Resumo</Text>
                  <View style={s.previewRow}>
                    <Text style={s.previewKey}>Preço por unidade</Text>
                    <Text style={s.previewVal}>{storeService.formatPrice(Number(price), 'MZN')}</Text>
                  </View>
                  <View style={s.previewRow}>
                    <Text style={s.previewKey}>Quantidade</Text>
                    <Text style={s.previewVal}>{Number(quantity) >= 999 ? 'Ilimitado' : quantity}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ═══ STEP 2 — Envio ═══════════════════════════════════════════ */}
          {step === 2 && (
            <View style={s.stepContent}>
              <Text style={s.stepTitle}>Onde és e como entregamos?</Text>
              <Text style={s.stepSub}>A tua localização ajuda-nos a calcular o frete para o comprador.</Text>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Cidade *</Text>
                <View style={s.inputWithIcon}>
                  <MapPin size={16} color={colors.gray400} />
                  <TextInput
                    style={s.inputIconField}
                    placeholder="Ex: Maputo, Beira, Nampula..."
                    placeholderTextColor={colors.gray400}
                    value={city}
                    onChangeText={setCity}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Shipping toggle */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>Envio disponível?</Text>
                <View style={s.shippingRow}>
                  <TouchableOpacity
                    style={[s.shippingOpt, !hasShipping && s.shippingOptActive]}
                    onPress={() => setHasShipping(false)}
                  >
                    <Text style={[s.shippingOptText, !hasShipping && s.shippingOptTextActive]}>Não, só presencial</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.shippingOpt, hasShipping && s.shippingOptActive]}
                    onPress={() => setHasShipping(true)}
                  >
                    <Truck size={14} color={hasShipping ? colors.white : colors.gray500} />
                    <Text style={[s.shippingOptText, hasShipping && s.shippingOptTextActive]}>Sim, faço envio</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {hasShipping && (
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Custo de envio (MZN)</Text>
                  <View style={s.inputWithIcon}>
                    <Tag size={16} color={colors.gray400} />
                    <TextInput
                      style={s.inputIconField}
                      placeholder="Ex: 150 (deixa vazio se incluído no preço)"
                      placeholderTextColor={colors.gray400}
                      value={shippingPrice}
                      onChangeText={setShippingPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={s.hint}>A plataforma ajuda a calcular o frete com base na distância</Text>
                </View>
              )}

              {/* Listing fee info */}
              {listingFeeMsg ? (
                <View style={s.feeCard}>
                  <Info size={15} color={colors.primary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.feeTitle}>{listingFeeMsg}</Text>
                    <Text style={s.feeSub}>Cobrada ao publicar. Varia com a tua localização.</Text>
                  </View>
                </View>
              ) : null}

              {/* Final preview */}
              <View style={s.previewCard}>
                <Text style={s.previewLabel}>Resumo do anúncio</Text>
                <View style={s.previewRow}>
                  <Text style={s.previewKey}>Produto</Text>
                  <Text style={s.previewVal} numberOfLines={1}>{title}</Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewKey}>Preço</Text>
                  <Text style={s.previewVal}>{storeService.formatPrice(Number(price), 'MZN')}</Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewKey}>Quantidade</Text>
                  <Text style={s.previewVal}>{Number(quantity) >= 999 ? 'Ilimitado' : quantity}</Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewKey}>Cidade</Text>
                  <Text style={s.previewVal}>{city || '—'}</Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewKey}>Envio</Text>
                  <Text style={s.previewVal}>{hasShipping ? (shippingPrice ? `${shippingPrice} MZN` : 'Incluído') : 'Não'}</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <View style={[s.cta, { paddingBottom: bottom + 16 }]}>
        <TouchableOpacity
          style={[s.ctaBtn, submitting && { opacity: 0.6 }]}
          onPress={goNext}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {step < 2 ? (
            <>
              <Text style={s.ctaBtnText}>Continuar</Text>
              <ChevronRight size={18} color={colors.white} strokeWidth={2.5} />
            </>
          ) : (
            <>
              <Check size={18} color={colors.white} strokeWidth={2.5} />
              <Text style={s.ctaBtnText}>{submitting ? 'A publicar...' : 'Publicar anúncio'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.gray800, letterSpacing: -0.3 },

  scroll: { paddingHorizontal: spacing.md },
  stepContent: { gap: spacing.md, paddingTop: spacing.sm },
  stepTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.gray800, letterSpacing: -0.5 },
  stepSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.gray500, lineHeight: 20, marginTop: -6 },

  fieldGroup: { gap: 8 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray600 },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.regular, fontSize: 15, color: colors.gray800,
  },
  inputMulti: { minHeight: 100, paddingTop: 12 },
  charCount: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray400, alignSelf: 'flex-end' },

  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  inputIconField: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.gray800, padding: 0 },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: {
    flex: 1, minWidth: (W - 64) / 2,
    alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg,
    backgroundColor: colors.gray100, borderWidth: 2, borderColor: colors.gray200,
    gap: 6,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: '#EEF4FD' },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray600 },
  typeLabelActive: { color: colors.primary, fontFamily: fonts.semiBold },

  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.gray100,
    borderWidth: 1.5, borderColor: colors.gray200,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray600 },
  catChipTextActive: { color: colors.white },

  imgThumb: { width: 90, height: 90, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
  imgThumbImg: { width: 90, height: 90 },
  imgRemove: {
    position: 'absolute', top: 5, right: 5,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  addImgBtn: {
    width: 90, height: 90, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.gray300, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addImgText: { fontFamily: fonts.regular, fontSize: 11, color: colors.gray400 },

  priceInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md,
    overflow: 'hidden',
  },
  priceCurrency: {
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: colors.gray100,
    fontFamily: fonts.semiBold, fontSize: 15, color: colors.gray600,
    borderRightWidth: 1, borderRightColor: colors.gray200,
  },
  priceInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: fonts.bold, fontSize: 22, color: colors.gray800,
  },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.gray100, borderWidth: 1.5, borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontFamily: fonts.bold, fontSize: 20, color: colors.gray800 },
  qtyInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md,
    paddingVertical: 10, fontFamily: fonts.bold, fontSize: 18, color: colors.gray800,
  },
  unlimitedBtn: { alignSelf: 'flex-start' },
  unlimitedText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },

  shippingRow: { flexDirection: 'row', gap: 10 },
  shippingOpt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: radius.lg,
    backgroundColor: colors.gray100, borderWidth: 1.5, borderColor: colors.gray200,
  },
  shippingOptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  shippingOptText: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray600 },
  shippingOptTextActive: { color: colors.white, fontFamily: fonts.semiBold },

  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, lineHeight: 17 },

  feeCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#EEF4FD', borderRadius: radius.lg,
    padding: 14, borderWidth: 1, borderColor: '#C4D9F8',
  },
  feeTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  feeSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },

  previewCard: {
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    padding: 16, gap: 10, marginTop: 4,
  },
  previewLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray600, marginBottom: 2 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewKey: { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500 },
  previewVal: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray800, maxWidth: '60%' },

  cta: {
    paddingHorizontal: spacing.md, paddingTop: 14,
    borderTopWidth: 0.5, borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 16,
  },
  ctaBtnText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.white },
})
