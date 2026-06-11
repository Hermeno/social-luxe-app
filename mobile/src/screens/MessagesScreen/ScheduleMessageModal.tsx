import React, { useState, useEffect } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons, Octicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts } from '../../theme'
import type { ScheduledMessage } from '../../services/scheduledMessages.service'

interface Props {
  visible: boolean
  receiverName: string
  existingMessage: ScheduledMessage | null
  onClose: () => void
  onSchedule: (content: string, scheduledAt: Date) => void
  onCancelScheduled: () => void
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function buildDateOptions() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    const label =
      i === 0 ? 'Hoje' :
      i === 1 ? 'Amanhã' :
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
  if (diff === 0) return `Hoje às ${time}`
  if (diff === 1) return `Amanhã às ${time}`
  const day = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} às ${time}`
}

export default function ScheduleMessageModal({
  visible, receiverName, existingMessage,
  onClose, onSchedule, onCancelScheduled,
}: Props) {
  const { bottom } = useSafeAreaInsets()
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
            <Text style={m.title}>Mensagem agendada</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={19} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        <Text style={m.toLine}>Para <Text style={m.toName}>{receiverName}</Text></Text>

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
          <Ionicons name="trash-outline" size={17} color="#E05C5C" />
          <Text style={m.cancelCtaTxt}>Cancelar agendamento</Text>
        </TouchableOpacity>

        {/* Premium teaser */}
        <View style={m.premiumTeaser}>
          <Ionicons name="diamond-outline" size={12} color={colors.gray400} />
          <Text style={m.premiumTxt}>Múltiplos agendamentos disponíveis em breve</Text>
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
          <Text style={m.title}>Agendar mensagem</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={19} color={colors.gray500} />
        </TouchableOpacity>
      </View>

      <Text style={m.toLine}>Para <Text style={m.toName}>{receiverName}</Text></Text>

      {/* Message input */}
      <View style={m.inputBox}>
        <TextInput
          style={m.input}
          placeholder="Escreve a mensagem aqui..."
          placeholderTextColor={colors.gray400}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        {content.length > 380 && (
          <Text style={m.charCount}>{500 - content.length} restantes</Text>
        )}
      </View>

      {/* Date */}
      <Text style={m.sectionLabel}>📅  Data</Text>
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
      <Text style={m.sectionLabel}>🕐  Hora</Text>
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
            color={isPast ? '#E05C5C' : colors.secondary}
          />
          <Text style={[m.statusTxt, isPast && m.statusTxtWarn]}>
            {isPast ? 'Hora passada' : `${chosen.label} · ${hStr}:${mStr}`}
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
            ? `Agendar · ${chosen.label} às ${hStr}:${mStr}`
            : content.trim().length === 0
              ? 'Escreve uma mensagem'
              : 'Escolhe um horário futuro'}
        </Text>
      </TouchableOpacity>
    </>,
  )
}

const m = StyleSheet.create({
  flex:     { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' },

  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  handle: {
    width: 38, height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },

  /* Header */
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontSize: 17, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },

  /* Receiver */
  toLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.gray500, marginBottom: 14 },
  toName: { fontFamily: fonts.semiBold, color: colors.gray800 },

  /* View mode */
  previewBox: {
    backgroundColor: colors.gray100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    padding: 14,
    marginBottom: 16,
    minHeight: 60,
  },
  previewMsg: { fontSize: 15, fontFamily: fonts.regular, color: colors.gray800, lineHeight: 22 },
  scheduleInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20,
  },
  scheduleInfoTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.gray200, marginBottom: 16 },
  cancelCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E05C5C', borderRadius: 16,
    paddingVertical: 14, marginBottom: 14,
    backgroundColor: 'rgba(224,92,92,0.06)',
  },
  cancelCtaTxt: { fontSize: 15, fontFamily: fonts.semiBold, color: '#E05C5C' },
  premiumTeaser: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingBottom: 4,
  },
  premiumTxt: { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400 },

  /* Input */
  inputBox: {
    backgroundColor: colors.gray100,
    borderRadius: 16, borderWidth: 1.5, borderColor: colors.gray200,
    marginBottom: 20, minHeight: 90, padding: 14,
  },
  input: {
    fontSize: 15, fontFamily: fonts.regular, color: colors.gray800,
    lineHeight: 22, minHeight: 66, padding: 0,
  },
  charCount: { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400, alignSelf: 'flex-end', marginTop: 6 },

  /* Section label */
  sectionLabel: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray600, marginBottom: 10 },

  /* Date chips */
  chips:      { gap: 8, paddingRight: 4, marginBottom: 20 },
  chip:       { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: colors.gray100, borderWidth: 1.5, borderColor: colors.gray200 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt:    { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray600 },
  chipTxtActive: { color: colors.white },

  /* Time block */
  timeBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  wheel: {
    alignItems: 'center', gap: 2,
    backgroundColor: colors.gray100, borderRadius: 16,
    paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: colors.gray200, minWidth: 62,
  },
  arrowBtn:  { padding: 2 },
  wheelNum:  { fontSize: 26, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5, lineHeight: 34 },
  colon:     { fontSize: 28, fontFamily: fonts.bold, color: colors.gray400, marginBottom: 4 },
  statusTag: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${colors.secondary}12`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  statusTagWarn: { backgroundColor: 'rgba(224,92,92,0.10)' },
  statusTxt:     { fontSize: 12, fontFamily: fonts.semiBold, color: colors.secondary, flexShrink: 1 },
  statusTxtWarn: { color: '#E05C5C' },

  /* CTA */
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  ctaOff: { backgroundColor: colors.gray300, shadowOpacity: 0 },
  ctaTxt: { fontSize: 15, fontFamily: fonts.bold, color: colors.white, letterSpacing: -0.2 },
})
