import React, { useState, useEffect } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons, Octicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts } from '../../theme'
import type { ScheduledMessage } from '../../services/scheduledMessages.service'
import { useT } from '../../i18n'

interface Props {
  visible: boolean
  receiverName: string
  existingMessage: ScheduledMessage | null
  onClose: () => void
  onSchedule: (content: string, scheduledAt: Date) => void
  onCancelScheduled: () => void
}


export default function ScheduleMessageModal({
  visible, receiverName, existingMessage,
  onClose, onSchedule, onCancelScheduled,
}: Props) {
  const t = useT()
  const { bottom } = useSafeAreaInsets()

  const DAYS = [t.day_sun, t.day_mon, t.day_tue, t.day_wed, t.day_thu, t.day_fri, t.day_sat]

  function buildDateOptions() {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      d.setHours(0, 0, 0, 0)
      const label =
        i === 0 ? t.time_today :
        i === 1 ? t.time_tomorrow :
        `${DAYS[d.getDay()]} ${d.getDate()}`
      return { label, date: d }
    })
  }

  function formatScheduledDate(isoStr: string): string {
    const d = new Date(isoStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dDay = new Date(d)
    dDay.setHours(0, 0, 0, 0)
    const diff = Math.round((dDay.getTime() - today.getTime()) / 86_400_000)
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (diff === 0) return `${t.time_today_at} ${time}`
    if (diff === 1) return `${t.time_tomorrow_at} ${time}`
    const day = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    return `${day} às ${time}`
  }

  const dateOptions = buildDateOptions()

  const [content,  setContent]  = useState('')
  const [dateIdx,  setDateIdx]  = useState(0)
  const [hour,     setHour]     = useState(() => { const h = new Date().getHours() + 1; return h > 23 ? 0 : h })
  const [minute,   setMinute]   = useState(0)

  useEffect(() => {
    if (visible && !existingMessage) {
      setContent('')
      setDateIdx(0)
      const h = new Date().getHours() + 1
      setHour(h > 23 ? 0 : h)
      setMinute(0)
    }
  }, [visible, existingMessage])

  const chosen = dateOptions[dateIdx]
  const scheduledAt = new Date(
    chosen.date.getFullYear(), chosen.date.getMonth(), chosen.date.getDate(),
    hour, minute, 0,
  )
  const isPast    = scheduledAt.getTime() <= Date.now() + 60_000
  const canSubmit = content.trim().length > 0 && !isPast

  function bumpHour(d: number) {
    setHour((h) => { const n = h + d; return n < 0 ? 23 : n > 23 ? 0 : n })
  }
  function bumpMinute(d: number) {
    setMinute((m) => { const n = m + d * 5; return n < 0 ? 55 : n >= 60 ? 0 : n })
  }

  function handleSchedule() {
    if (!canSubmit) return
    Keyboard.dismiss()
    onSchedule(content.trim(), scheduledAt)
    onClose()
  }

  const hStr = String(hour).padStart(2, '0')
  const mStr = String(minute).padStart(2, '0')

  const sharedSheet = (children: React.ReactNode) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={m.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose() }} />
        <View style={[m.sheet, { paddingBottom: Math.max(bottom, 20) }]}>
          <View style={m.handle} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )

  // ── VIEW MODE: existing scheduled message ─────────────────────────────────
  if (existingMessage) {
    return sharedSheet(
      <>
        {/* Header */}
        <View style={m.headerRow}>
          <View style={m.titleGroup}>
            <View style={m.iconBadge}>
              <Octicons name="stopwatch" size={15} color={colors.primary} />
            </View>
            <Text style={m.title}>{t.sched_view_title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={19} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        <Text style={m.toLine}>{t.sched_to} <Text style={m.toName}>{receiverName}</Text></Text>

        {/* Message preview */}
        <View style={m.previewBox}>
          <Text style={m.previewMsg}>{existingMessage.content}</Text>
        </View>

        {/* Scheduled time */}
        <View style={m.scheduleInfo}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={m.scheduleInfoTxt}>
            {formatScheduledDate(existingMessage.scheduledAt)}
          </Text>
        </View>

        {/* Divider */}
        <View style={m.divider} />

        {/* Cancel CTA */}
        <TouchableOpacity style={m.cancelCta} onPress={onCancelScheduled} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={17} color="#FF3B30" />
          <Text style={m.cancelCtaTxt}>{t.sched_cancel_sched}</Text>
        </TouchableOpacity>

        {/* Premium teaser */}
        <View style={m.premiumTeaser}>
          <Ionicons name="diamond-outline" size={12} color={colors.gray400} />
          <Text style={m.premiumTxt}>{t.sched_premium}</Text>
        </View>
      </>,
    )
  }

  // ── CREATE MODE ───────────────────────────────────────────────────────────
  return sharedSheet(
    <>
      {/* Header */}
      <View style={m.headerRow}>
        <View style={m.titleGroup}>
          <View style={m.iconBadge}>
            <Octicons name="stopwatch" size={15} color={colors.primary} />
          </View>
          <Text style={m.title}>{t.sched_title}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={19} color={colors.gray500} />
        </TouchableOpacity>
      </View>

      <Text style={m.toLine}>{t.sched_to} <Text style={m.toName}>{receiverName}</Text></Text>

      {/* Message input */}
      <View style={m.inputBox}>
        <TextInput
          style={m.input}
          placeholder={t.sched_input_ph}
          placeholderTextColor={colors.gray400}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        {content.length > 380 && (
          <Text style={m.charCount}>{500 - content.length} {t.sched_remaining}</Text>
        )}
      </View>

      {/* Date */}
      <Text style={m.sectionLabel}>{t.sched_date}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.chips}>
        {dateOptions.map((opt, i) => (
          <TouchableOpacity
            key={opt.label}
            style={[m.chip, i === dateIdx && m.chipActive]}
            onPress={() => setDateIdx(i)}
            activeOpacity={0.75}
          >
            <Text style={[m.chipTxt, i === dateIdx && m.chipTxtActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Time */}
      <Text style={m.sectionLabel}>{t.sched_time}</Text>
      <View style={m.timeBlock}>
        <View style={m.wheel}>
          <TouchableOpacity style={m.arrowBtn} onPress={() => bumpHour(1)}>
            <Ionicons name="chevron-up" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={m.wheelNum}>{hStr}</Text>
          <TouchableOpacity style={m.arrowBtn} onPress={() => bumpHour(-1)}>
            <Ionicons name="chevron-down" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <Text style={m.colon}>:</Text>

        <View style={m.wheel}>
          <TouchableOpacity style={m.arrowBtn} onPress={() => bumpMinute(1)}>
            <Ionicons name="chevron-up" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={m.wheelNum}>{mStr}</Text>
          <TouchableOpacity style={m.arrowBtn} onPress={() => bumpMinute(-1)}>
            <Ionicons name="chevron-down" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[m.statusTag, isPast && m.statusTagWarn]}>
          <Ionicons
            name={isPast ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={13}
            color={isPast ? '#FF3B30' : colors.gray500}
          />
          <Text style={[m.statusTxt, isPast && m.statusTxtWarn]}>
            {isPast ? t.sched_past_time : `${chosen.label} · ${hStr}:${mStr}`}
          </Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[m.cta, !canSubmit && m.ctaOff]}
        onPress={handleSchedule}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        <Octicons name="stopwatch" size={16} color={colors.white} />
        <Text style={m.ctaTxt} numberOfLines={1}>
          {canSubmit
            ? `${t.sched_btn} · ${chosen.label} às ${hStr}:${mStr}`
            : content.trim().length === 0
              ? t.sched_empty_msg
              : t.sched_past_msg}
        </Text>
      </TouchableOpacity>
    </>,
  )
}

const FIELD = '#F4F4F6'

const m = StyleSheet.create({
  flex:     { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' },

  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  handle: {
    width: 38, height: 4,
    backgroundColor: '#E0E0E4',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },

  /* Header */
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBadge: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: `${colors.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 17, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: FIELD, alignItems: 'center', justifyContent: 'center' },

  /* Receiver */
  toLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.gray500, marginBottom: 14 },
  toName: { fontFamily: fonts.semiBold, color: colors.gray800 },

  /* View mode */
  previewBox: {
    backgroundColor: FIELD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    minHeight: 56,
  },
  previewMsg: { fontSize: 15, fontFamily: fonts.regular, color: colors.gray800, lineHeight: 22 },
  scheduleInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: FIELD,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 16,
  },
  scheduleInfoTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E8EA', marginBottom: 14 },
  cancelCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 25, paddingVertical: 15, marginBottom: 12,
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  cancelCtaTxt: { fontSize: 15, fontFamily: fonts.semiBold, color: '#FF3B30' },
  premiumTeaser: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingBottom: 4,
  },
  premiumTxt: { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400 },

  /* Input */
  inputBox: {
    backgroundColor: FIELD,
    borderRadius: 18,
    marginBottom: 16, minHeight: 84, padding: 14,
  },
  input: {
    fontSize: 15.5, fontFamily: fonts.regular, color: colors.gray800,
    lineHeight: 22, minHeight: 60, padding: 0,
  },
  charCount: { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400, alignSelf: 'flex-end', marginTop: 6 },

  /* Section label */
  sectionLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.gray400, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 9 },

  /* Date chips */
  chips:      { gap: 8, paddingRight: 4, marginBottom: 16 },
  chip:       { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 20, backgroundColor: FIELD },
  chipActive: { backgroundColor: colors.primary },
  chipTxt:    { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray600 },
  chipTxtActive: { color: colors.white },

  /* Time block */
  timeBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  wheel: {
    alignItems: 'center', gap: 0,
    backgroundColor: FIELD, borderRadius: 16,
    paddingVertical: 4, paddingHorizontal: 14, minWidth: 60,
  },
  arrowBtn:  { padding: 3 },
  wheelNum:  { fontSize: 25, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5, lineHeight: 32 },
  colon:     { fontSize: 26, fontFamily: fonts.bold, color: colors.gray300, marginBottom: 2 },
  statusTag: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: FIELD, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  statusTagWarn: { backgroundColor: 'rgba(255,59,48,0.08)' },
  statusTxt:     { fontSize: 12.5, fontFamily: fonts.semiBold, color: colors.gray600, flexShrink: 1 },
  statusTxtWarn: { color: '#FF3B30' },

  /* CTA */
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 26,
    paddingVertical: 16, paddingHorizontal: 20,
  },
  ctaOff: { backgroundColor: '#D8D8DC' },
  ctaTxt: { fontSize: 15, fontFamily: fonts.bold, color: colors.white, letterSpacing: -0.2 },
})
