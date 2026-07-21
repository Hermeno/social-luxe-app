import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList, Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fonts } from '../../theme'
import { useT, useI18n } from '../../i18n'
import {
  BUSINESS_CATEGORIES, categoryLabel, DayHours, WEEKDAY_KEYS,
  ProfileAction, PROFILE_ACTIONS,
} from '../../utils/business'

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#CA2851'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'
const CARD_BD = '#EDEDF1'

// Máscara HH:MM sem dependência nativa — o Expo Go não carrega módulos nativos,
// por isso nada de date pickers. Só dígitos, os dois pontos entram sozinhos.
function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}:${d.slice(2)}`
}

function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[tog.track, value && tog.on]}>
      <View style={[tog.thumb, value && tog.thumbOn]} />
    </View>
  )
}
const tog = StyleSheet.create({
  track:   { width: 46, height: 28, borderRadius: 999, backgroundColor: BD, padding: 2, justifyContent: 'center', flexShrink: 0 },
  on:      { backgroundColor: B },
  thumb:   { width: 24, height: 24, borderRadius: 999, backgroundColor: BG, alignSelf: 'flex-start' },
  thumbOn: { alignSelf: 'flex-end' },
})

const ACTION_ICON: Record<ProfileAction, keyof typeof Ionicons.glyphMap> = {
  call:       'call-outline',
  whatsapp:   'logo-whatsapp',
  message:    'chatbubble-outline',
  directions: 'navigate-outline',
}

interface Props {
  isPro: boolean;            onIsProChange: (v: boolean) => void
  category: string;          onCategoryChange: (v: string) => void
  address: string;           onAddressChange: (v: string) => void
  whatsapp: string;          onWhatsappChange: (v: string) => void
  hours: DayHours[];         onHoursChange: (v: DayHours[]) => void
  actions: Set<ProfileAction>; onActionsChange: (v: Set<ProfileAction>) => void
}

export default function BusinessSection({
  isPro, onIsProChange, category, onCategoryChange, address, onAddressChange,
  whatsapp, onWhatsappChange, hours, onHoursChange, actions, onActionsChange,
}: Props) {
  const t = useT()
  const { lang } = useI18n()
  const [catModal, setCatModal] = useState(false)

  const actionLabel: Record<ProfileAction, string> = {
    call:       t.bp_act_call,
    whatsapp:   t.bp_act_whatsapp,
    message:    t.bp_act_message,
    directions: t.bp_act_directions,
  }

  function patchDay(i: number, patch: Partial<DayHours>) {
    onHoursChange(hours.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function toggleAction(a: ProfileAction) {
    const next = new Set(actions)
    next.has(a) ? next.delete(a) : next.add(a)
    onActionsChange(next)
  }

  return (
    <>
      {/* ── O interruptor: pessoal ⇄ profissional ─────────────────────────── */}
      <Text style={s.sectionLabel}>{t.bp_account}</Text>
      <View style={s.card}>
        <TouchableOpacity style={s.row} onPress={() => onIsProChange(!isPro)} activeOpacity={0.7}>
          <View style={s.rowTexts}>
            <Text style={s.rowTitle}>{t.bp_pro_title}</Text>
            <Text style={s.rowSub}>{t.bp_pro_sub}</Text>
          </View>
          <Toggle value={isPro} />
        </TouchableOpacity>
      </View>

      {!isPro ? null : (
        <>
          {/* ── Identidade do negócio ───────────────────────────────────────── */}
          <Text style={s.sectionLabel}>{t.bp_business}</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={() => setCatModal(true)} activeOpacity={0.7}>
              <Text style={s.fieldLabel}>{t.bp_category}</Text>
              <View style={s.rowRight}>
                <Text style={[s.rowValue, !category && s.rowValueEmpty]} numberOfLines={1}>
                  {category ? categoryLabel(category, lang) : t.bp_none}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={M} />
              </View>
            </TouchableOpacity>

            <View style={s.divider} />
            <View style={s.row}>
              <Text style={s.fieldLabel}>{t.bp_address}</Text>
              <TextInput
                style={s.input}
                value={address}
                onChangeText={onAddressChange}
                placeholder={t.bp_address_ph}
                placeholderTextColor={M}
                maxLength={120}
              />
            </View>

            <View style={s.divider} />
            <View style={s.row}>
              <Text style={s.fieldLabel}>{t.bp_whatsapp}</Text>
              <TextInput
                style={s.input}
                value={whatsapp}
                onChangeText={(v) => onWhatsappChange(v.replace(/[^\d+]/g, ''))}
                placeholder={t.bp_whatsapp_ph}
                placeholderTextColor={M}
                keyboardType="phone-pad"
                maxLength={20}
              />
            </View>
          </View>

          {/* ── Horário ─────────────────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>{t.bp_hours}</Text>
          <View style={s.card}>
            {hours.map((d, i) => (
              <View key={WEEKDAY_KEYS[i]}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.dayRow}>
                  <TouchableOpacity
                    style={s.dayNameWrap}
                    onPress={() => patchDay(i, { closed: !d.closed })}
                    activeOpacity={0.7}
                  >
                    <View style={[s.dayDot, !d.closed && s.dayDotOpen]} />
                    <Text style={[s.dayName, d.closed && s.dayNameClosed]}>
                      {(t as any)[`bp_${WEEKDAY_KEYS[i]}`]}
                    </Text>
                  </TouchableOpacity>

                  {d.closed ? (
                    <TouchableOpacity onPress={() => patchDay(i, { closed: false })} activeOpacity={0.7}>
                      <Text style={s.closedTxt}>{t.bp_closed}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={s.timeGroup}>
                      <TextInput
                        style={s.timeInput}
                        value={d.open}
                        onChangeText={(v) => patchDay(i, { open: maskTime(v) })}
                        placeholder="09:00"
                        placeholderTextColor={M}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                      <Text style={s.timeDash}>–</Text>
                      <TextInput
                        style={s.timeInput}
                        value={d.close}
                        onChangeText={(v) => patchDay(i, { close: maskTime(v) })}
                        placeholder="18:00"
                        placeholderTextColor={M}
                        keyboardType="number-pad"
                        maxLength={5}
                      />
                      <TouchableOpacity
                        onPress={() => patchDay(i, { closed: true })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={17} color={BD} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
          <Text style={s.hint}>{t.bp_hours_hint}</Text>

          {/* ── Botões que aparecem no perfil ───────────────────────────────── */}
          <Text style={s.sectionLabel}>{t.bp_actions}</Text>
          <View style={s.card}>
            {PROFILE_ACTIONS.map((a, i) => (
              <View key={a}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity style={s.row} onPress={() => toggleAction(a)} activeOpacity={0.7}>
                  <View style={s.actionLeft}>
                    <Ionicons name={ACTION_ICON[a]} size={18} color={S} />
                    <Text style={s.rowTitle}>{actionLabel[a]}</Text>
                  </View>
                  <Toggle value={actions.has(a)} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <Text style={s.hint}>{t.bp_actions_hint}</Text>
        </>
      )}

      {/* ── Escolha de categoria ──────────────────────────────────────────── */}
      <Modal visible={catModal} transparent animationType="slide" onRequestClose={() => setCatModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCatModal(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalGrabber} />
          <Text style={s.modalTitle}>{t.bp_category_pick}</Text>
          <FlatList
            data={BUSINESS_CATEGORIES}
            keyExtractor={(c) => c.value}
            renderItem={({ item }) => {
              const active = item.value === category
              return (
                <TouchableOpacity
                  style={s.catRow}
                  onPress={() => { onCategoryChange(active ? '' : item.value); setCatModal(false) }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.catTxt, active && s.catTxtActive]}>
                    {lang === 'en' ? item.en : item.value}
                  </Text>
                  {active && <Ionicons name="checkmark" size={19} color={B} />}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  // Mesma escala das outras secções do editor — o ecrã tem de ler-se como um só
  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 11, color: M,
    letterSpacing: 1, textTransform: 'uppercase',
    paddingLeft: 6, paddingBottom: 8, marginTop: 16,
  },
  card: {
    backgroundColor: SX, borderRadius: 18,
    borderWidth: 1, borderColor: CARD_BD, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: CARD_BD, marginLeft: 14 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.semiBold, fontSize: 14.5, color: T },
  rowSub:   { fontFamily: fonts.regular, fontSize: 12.5, color: S, lineHeight: 17 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'flex-end' },
  rowValue: { fontFamily: fonts.medium, fontSize: 14, color: T, flexShrink: 1 },
  rowValueEmpty: { color: M },

  fieldLabel: { fontFamily: fonts.semiBold, fontSize: 14, color: S, width: 88, flexShrink: 0 },
  input: {
    flex: 1, fontFamily: fonts.regular, fontSize: 14.5, color: T, padding: 0,
  },

  actionLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },

  // ── Horário ──
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  dayNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BD },
  dayDotOpen: { backgroundColor: B },
  dayName: { fontFamily: fonts.medium, fontSize: 14, color: T },
  dayNameClosed: { color: M },
  closedTxt: { fontFamily: fonts.medium, fontSize: 13.5, color: M },

  timeGroup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timeInput: {
    fontFamily: fonts.medium, fontSize: 14, color: T,
    backgroundColor: '#F4F4F6', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 6, minWidth: 58, textAlign: 'center',
  },
  timeDash: { fontFamily: fonts.regular, fontSize: 13, color: M },

  hint: {
    fontFamily: fonts.regular, fontSize: 12, color: M,
    marginTop: 7, marginHorizontal: 4, lineHeight: 16,
  },

  // ── Modal de categorias ──
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: BG, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 10, paddingBottom: 28, maxHeight: '70%',
  },
  modalGrabber: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: BD,
    alignSelf: 'center', marginBottom: 12,
  },
  modalTitle: {
    fontFamily: fonts.semiBold, fontSize: 16.5, color: T,
    marginHorizontal: 18, marginBottom: 8,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
  },
  catTxt:       { fontFamily: fonts.regular, fontSize: 15, color: T },
  catTxtActive: { fontFamily: fonts.semiBold, color: B },
})
