import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { User } from '../../types'
import { colors, fonts } from '../../theme'
import { useT, useI18n } from '../../i18n'
import {
  categoryLabel, normalizeHours, isOpenNow, ProfileAction,
} from '../../utils/business'

// ─── Bloco comercial do perfil ────────────────────────────────────────────────
// Categoria, estado (aberto/fechado agora), morada e a fila de ações. Só existe
// quando accountType === 'PROFESSIONAL'; num perfil pessoal nada disto aparece.

const ACTION_ICON: Record<ProfileAction, keyof typeof Ionicons.glyphMap> = {
  call:       'call',
  whatsapp:   'logo-whatsapp',
  message:    'chatbubble',
  directions: 'navigate',
}

interface Props {
  profile: User
  isOwn: boolean
  onMessage: () => void
}

export default function BusinessBlock({ profile, isOwn, onMessage }: Props) {
  const t = useT()
  const { lang } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  const hours = normalizeHours(profile.businessHours)

  // O estado aberto/fechado tem de virar sozinho — um perfil deixado aberto no
  // ecrã não pode continuar a dizer "aberto" depois da hora de fecho.
  useEffect(() => {
    if (!hours) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [!!hours])

  const state = isOpenNow(hours, new Date(now))
  const actions = (profile.profileActions ?? []) as ProfileAction[]

  const label: Record<ProfileAction, string> = {
    call:       t.bp_act_call,
    whatsapp:   t.bp_act_whatsapp,
    message:    t.bp_act_message,
    directions: t.bp_act_directions,
  }

  async function open(url: string) {
    try {
      const okToOpen = await Linking.canOpenURL(url)
      if (!okToOpen) throw new Error('unsupported')
      await Linking.openURL(url)
    } catch {
      Alert.alert(t.error, t.bp_open_fail)
    }
  }

  function run(a: ProfileAction) {
    switch (a) {
      case 'call': {
        const num = `${profile.countryCode ?? ''}${profile.phone ?? ''}`.replace(/[^\d+]/g, '')
        if (num) open(`tel:${num}`)
        break
      }
      case 'whatsapp': {
        const num = (profile.whatsapp ?? '').replace(/[^\d]/g, '')
        if (num) open(`whatsapp://send?phone=${num}`)
        break
      }
      case 'message':
        onMessage()
        break
      case 'directions': {
        const q = encodeURIComponent(profile.businessAddress ?? '')
        if (!q) break
        // geo: no Android, Apple Maps no iOS — sem depender de app de terceiros
        open(Platform.OS === 'ios' ? `http://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`)
        break
      }
    }
  }

  // Um botão que não tem para onde ir é pior do que não existir
  const usable = actions.filter((a) => {
    if (a === 'call')       return !!profile.phone
    if (a === 'whatsapp')   return !!profile.whatsapp
    if (a === 'directions') return !!profile.businessAddress
    return true
  }).filter((a) => !(isOwn && a === 'message'))

  const hasHeader = !!profile.businessCategory || !!hours || !!profile.businessAddress
  if (!hasHeader && usable.length === 0) return null

  return (
    <View style={s.wrap}>
      {/* Categoria · estado */}
      {(!!profile.businessCategory || !!hours) && (
        <View style={s.metaRow}>
          {!!profile.businessCategory && (
            <Text style={s.category}>{categoryLabel(profile.businessCategory, lang)}</Text>
          )}
          {!!profile.businessCategory && !!hours && <Text style={s.dot}>·</Text>}
          {!!hours && (
            <View style={s.stateRow}>
              <View style={[s.stateDot, state.open ? s.stateDotOpen : s.stateDotShut]} />
              <Text style={[s.state, state.open ? s.stateOpen : s.stateShut]}>
                {state.open ? t.bp_open_now : t.bp_closed_now}
              </Text>
              {!!state.until && (
                <Text style={s.stateHint}>
                  {(state.open ? t.bp_closes_at : t.bp_opens_at).replace('{t}', state.until)}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Morada */}
      {!!profile.businessAddress && (
        <View style={s.addressRow}>
          <Ionicons name="location-outline" size={13} color={colors.gray400} />
          <Text style={s.address} numberOfLines={2}>{profile.businessAddress}</Text>
        </View>
      )}

      {/* Ações */}
      {usable.length > 0 && (
        <View style={s.actions}>
          {usable.map((a) => (
            <TouchableOpacity key={a} style={s.actionBtn} onPress={() => run(a)} activeOpacity={0.75}>
              <Ionicons name={ACTION_ICON[a]} size={15} color={colors.gray800} />
              <Text style={s.actionTxt} numberOfLines={1}>{label[a]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 14, gap: 8 },

  metaRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  category: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray800 },
  dot:      { fontFamily: fonts.regular, fontSize: 13, color: colors.gray400 },

  stateRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stateDot:     { width: 6, height: 6, borderRadius: 3 },
  stateDotOpen: { backgroundColor: colors.success },
  stateDotShut: { backgroundColor: colors.gray400 },
  state:        { fontFamily: fonts.semiBold, fontSize: 13 },
  stateOpen:    { color: colors.success },
  stateShut:    { color: colors.gray500 },
  stateHint:    { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400 },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  address:    { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.gray500, lineHeight: 17 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.gray200, borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 9,
  },
  actionTxt: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray800 },
})
