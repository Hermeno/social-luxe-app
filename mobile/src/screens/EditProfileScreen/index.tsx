import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { searchUsers, UserSummary } from '../../services/user.service'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'
import { API_BASE } from '../../config'

function resolveAvatar(url: string | null) {
  if (!url) return null
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

type Nav = StackNavigationProp<AppStackParams>

const AVAILABILITY = [
  { label: 'Disponível', value: 'Disponível' },
  { label: 'Ocupado',    value: 'Ocupado'    },
  { label: 'Ausente',    value: 'Ausente'    },
]

const FOLLOW_DURATIONS = [
  { label: '1 dia',      value: '1d'      },
  { label: '1 semana',   value: '1w'      },
  { label: '1 mês',      value: '1m'      },
  { label: '1 ano',      value: '1y'      },
  { label: 'Para sempre', value: 'forever' },
]

const RELATIONSHIP_STATUS = [
  { label: 'Solteiro/a',    value: 'single'          },
  { label: 'Casado/a',      value: 'married'         },
  { label: 'Relacionamento', value: 'in_relationship' },
]

export default function EditProfileScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user, refreshUser } = useAuthStore()

  const [name,                 setName]                 = useState(user?.name ?? '')
  const [bio,                  setBio]                  = useState(user?.bio ?? '')
  const [contact,              setContact]              = useState(user?.contact ?? '')
  const [avail,                setAvail]                = useState(user?.availability ?? 'Disponível')
  const [followDuration,       setFollowDuration]       = useState(user?.defaultFollowDuration ?? 'forever')
  const [relStatus,            setRelStatus]            = useState(user?.relationshipStatus ?? '')
  const [partnerName,          setPartnerName]          = useState(user?.partnerName ?? '')
  const [partnerId,            setPartnerId]            = useState(user?.partnerId ?? '')
  const [district,             setDistrict]             = useState(user?.district ?? '')
  const [city,                 setCity]                 = useState(user?.city ?? '')
  const [autoReply,            setAutoReply]            = useState(user?.autoReply ?? '')
  const [viewsPublic,          setViewsPublic]          = useState(user?.viewsPublic ?? false)
  const [saving,               setSaving]               = useState(false)

  // Partner search
  const [partnerQuery,    setPartnerQuery]    = useState(user?.partnerName ?? '')
  const [partnerResults,  setPartnerResults]  = useState<UserSummary[]>([])
  const [partnerSearching,setPartnerSearching]= useState(false)
  const [partnerSelected, setPartnerSelected] = useState(!!user?.partnerId)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (partnerSelected || partnerQuery.trim().length < 2) {
      setPartnerResults([])
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setPartnerSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchUsers(partnerQuery.trim())
        setPartnerResults(results.filter((u) => u.id !== user?.id).slice(0, 5))
      } catch {}
      setPartnerSearching(false)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [partnerQuery, partnerSelected])

  function selectPartner(u: UserSummary) {
    setPartnerName(u.name)
    setPartnerId(u.id)
    setPartnerQuery(u.name)
    setPartnerSelected(true)
    setPartnerResults([])
  }

  function clearPartner() {
    setPartnerName('')
    setPartnerId('')
    setPartnerQuery('')
    setPartnerSelected(false)
    setPartnerResults([])
  }

  const showPartnerFields = relStatus === 'married' || relStatus === 'in_relationship'
  const showPartnerInfo   = relStatus === 'married' && partnerId.trim().length > 0

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Por favor insere o teu nome.')
      return
    }
    setSaving(true)
    try {
      // Save all profile fields EXCEPT partnerId (handled separately via request flow)
      await api.put('/users/profile', {
        name:                  name.trim(),
        bio:                   bio.trim(),
        contact:               contact.trim() || null,
        availability:          avail,
        defaultFollowDuration: followDuration,
        relationshipStatus:    relStatus || null,
        district:              district.trim() || null,
        city:                  city.trim() || null,
        autoReply:             autoReply.trim() || null,
        viewsPublic,
      })

      // If a NEW partner was selected (different from current), send a partner request
      const newPartnerId = showPartnerFields ? partnerId.trim() : ''
      const currentPartnerId = user?.partnerId ?? ''
      if (newPartnerId && newPartnerId !== currentPartnerId) {
        try {
          await api.post('/users/partner-request', { receiverId: newPartnerId })
          Alert.alert('Pedido enviado 💑', `O pedido de associação foi enviado para ${partnerName}. Aguarda a aceitação.`)
        } catch (e: any) {
          const msg = e?.response?.data?.message ?? 'Não foi possível enviar o pedido de associação.'
          Alert.alert('Pedido de associação', msg)
        }
      }

      await refreshUser()
      nav.goBack()
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar as alterações.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[s.root, { paddingTop: top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => nav.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Editar Perfil</Text>
        <TouchableOpacity
          style={[s.saveHeaderBtn, saving && s.saveHeaderBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={s.saveHeaderBtnText}>Guardar</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.scroll, { paddingBottom: bottom + spacing.xl }]}
        >

          {/* ── Informações básicas ── */}
          <SectionHeader title="Informações básicas" />
          <View style={s.section}>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Nome"
              placeholderTextColor={colors.gray400}
              returnKeyType="next"
            />
            <View style={s.divider} />
            <TextInput
              style={[s.input, s.multilineInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Bio"
              placeholderTextColor={colors.gray400}
              multiline
              returnKeyType="done"
            />
            <View style={s.divider} />
            <TextInput
              style={s.input}
              value={contact}
              onChangeText={setContact}
              placeholder="Telefone, email ou rede social"
              placeholderTextColor={colors.gray400}
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="next"
            />
          </View>

          {/* ── Disponibilidade ── */}
          <SectionHeader title="Disponibilidade" />
          <View style={s.pillSection}>
            {AVAILABILITY.map((a) => (
              <TouchableOpacity
                key={a.value}
                style={[s.pill, avail === a.value && s.pillActive]}
                onPress={() => setAvail(a.value)}
                activeOpacity={0.75}
              >
                <Text style={[s.pillText, avail === a.value && s.pillTextActive]}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Duração padrão de seguimento ── */}
          <SectionHeader title="Duração padrão de seguimento" />
          <Text style={s.descText}>
            Quando alguém te segue, quanto tempo dura por defeito?
          </Text>
          <View style={s.pillSection}>
            {FOLLOW_DURATIONS.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[s.pill, followDuration === d.value && s.pillActive]}
                onPress={() => setFollowDuration(d.value)}
                activeOpacity={0.75}
              >
                <Text style={[s.pillText, followDuration === d.value && s.pillTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Estado civil ── */}
          <SectionHeader title="Estado civil" />
          <View style={s.pillSection}>
            {RELATIONSHIP_STATUS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[s.pill, relStatus === r.value && s.pillActive]}
                onPress={() => setRelStatus(relStatus === r.value ? '' : r.value)}
                activeOpacity={0.75}
              >
                <Text style={[s.pillText, relStatus === r.value && s.pillTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {showPartnerFields && (
            <View style={{ marginTop: spacing.sm }}>
              {/* Search field */}
              <View style={s.section}>
                <View style={s.partnerSearchRow}>
                  <TextInput
                    style={[s.input, { flex: 1, backgroundColor: 'transparent' }]}
                    value={partnerQuery}
                    onChangeText={(t) => { setPartnerQuery(t); setPartnerSelected(false) }}
                    placeholder="Pesquisar parceiro/a..."
                    placeholderTextColor={colors.gray400}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {partnerSearching && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />}
                  {partnerSelected && (
                    <TouchableOpacity onPress={clearPartner} style={{ marginRight: 12 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={colors.gray400} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Selected partner chip */}
                {partnerSelected && partnerId ? (
                  <View style={s.partnerChip}>
                    <Ionicons name="heart" size={13} color={colors.primary} />
                    <Text style={s.partnerChipText} numberOfLines={1}>{partnerName}</Text>
                    <Text style={s.partnerChipId} numberOfLines={1}>associado</Text>
                  </View>
                ) : null}
              </View>

              {/* Search results dropdown */}
              {partnerResults.length > 0 && (
                <View style={s.dropdown}>
                  {partnerResults.map((u, i) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[s.dropdownItem, i < partnerResults.length - 1 && s.dropdownDivider]}
                      onPress={() => selectPartner(u)}
                      activeOpacity={0.7}
                    >
                      {u.avatar ? (
                        <Image
                          source={{ uri: resolveAvatar(u.avatar) ?? '' }}
                          style={s.dropdownAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[s.dropdownAvatar, s.dropdownAvatarFallback]}>
                          <Text style={s.dropdownAvatarInitial}>{u.name[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.dropdownName} numberOfLines={1}>{u.name}</Text>
                        {u.bio ? <Text style={s.dropdownBio} numberOfLines={1}>{u.bio}</Text> : null}
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Notes */}
              <View style={s.partnerNote}>
                <Ionicons name="information-circle-outline" size={13} color={colors.gray400} />
                <Text style={s.partnerNoteText}>
                  O parceiro receberá um pedido de associação
                </Text>
              </View>
              {showPartnerInfo && (
                <View style={s.partnerInfo}>
                  <Ionicons name="heart-outline" size={13} color={colors.primary} />
                  <Text style={s.partnerInfoText}>
                    Quando associados, ambos os perfis mostrarão as duas fotos juntas
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Localização ── */}
          <SectionHeader title="Localização" />
          <View style={s.section}>
            <TextInput
              style={s.input}
              value={district}
              onChangeText={setDistrict}
              placeholder="Distrito"
              placeholderTextColor={colors.gray400}
              returnKeyType="next"
            />
            <View style={s.divider} />
            <TextInput
              style={s.input}
              value={city}
              onChangeText={setCity}
              placeholder="Cidade / Município / Vila"
              placeholderTextColor={colors.gray400}
              returnKeyType="done"
            />
          </View>

          {/* ── Mensagem automática ── */}
          <SectionHeader title="Mensagem automática" />
          <Text style={s.descText}>
            Enviada automaticamente quando não estás online
          </Text>
          <View style={s.section}>
            <TextInput
              style={[s.input, s.multilineInput]}
              value={autoReply}
              onChangeText={setAutoReply}
              placeholder="Ex: Estou ocupado, respondo em breve..."
              placeholderTextColor={colors.gray400}
              multiline
              maxLength={200}
              returnKeyType="done"
            />
            <Text style={s.charCount}>{autoReply.length}/200</Text>
          </View>

          {/* ── Privacidade ── */}
          <SectionHeader title="Privacidade" />
          <View style={s.section}>
            <View style={s.toggleRow}>
              <View style={s.toggleLeft}>
                <Ionicons name="eye-outline" size={18} color={colors.gray600} />
                <View style={s.toggleTextWrap}>
                  <Text style={s.toggleLabel}>Visualizações públicas</Text>
                  <Text style={s.toggleSub}>
                    {viewsPublic
                      ? 'Todos podem ver o total de views'
                      : 'Apenas tu vês o total de views'}
                  </Text>
                </View>
              </View>
              <Switch
                value={viewsPublic}
                onValueChange={setViewsPublic}
                trackColor={{ false: colors.gray200, true: `${colors.primary}60` }}
                thumbColor={viewsPublic ? colors.primary : colors.white}
              />
            </View>
          </View>

          {/* ── Save button (bottom) ── */}
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={s.saveBtnText}>Guardar alterações</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={s.sectionHeader}>{title.toUpperCase()}</Text>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.gray800,
    textAlign: 'center',
  },
  saveHeaderBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHeaderBtnDisabled: { opacity: 0.5 },
  saveHeaderBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },

  // Scroll
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 0,
  },

  // Section header label
  sectionHeader: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.gray400,
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Section card
  section: {
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  // Divider inside section
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginHorizontal: spacing.md,
  },

  // Input
  input: {
    backgroundColor: colors.gray100,
    borderRadius: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.gray800,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Char count
  charCount: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.gray400,
    textAlign: 'right',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },

  // Pills
  pillSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.gray100,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.gray600,
  },
  pillTextActive: {
    color: colors.white,
    fontFamily: fonts.semiBold,
  },

  // Description text
  descText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.gray400,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },

  // Partner search
  partnerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${colors.primary}12`,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  partnerChipText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  partnerChipId: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.primary,
    opacity: 0.7,
  },

  // Dropdown
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  dropdownAvatar: {
    width: 38, height: 38, borderRadius: 19,
  },
  dropdownAvatarFallback: {
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarInitial: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.gray600,
  },
  dropdownName: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
  },
  dropdownBio: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.gray400,
    marginTop: 1,
  },

  // Partner note
  partnerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingHorizontal: 2,
  },
  partnerNoteText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.gray400,
    flex: 1,
    lineHeight: 15,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  partnerInfoText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.primary,
    flex: 1,
    lineHeight: 15,
  },

  // Toggle row (privacy)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  toggleTextWrap: { flex: 1, gap: 2 },
  toggleLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
  },
  toggleSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.gray400,
  },

  // Bottom save button
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 50,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.white,
  },
})
