import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Animated } from 'react-native'
import { create } from 'zustand'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../theme'
import { useT } from '../i18n'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  icon?: keyof typeof Ionicons.glyphMap
}

interface State {
  opts: ConfirmOptions | null
  resolver: ((v: boolean) => void) | null
  open: (opts: ConfirmOptions) => Promise<boolean>
  close: (v: boolean) => void
}

const useConfirmStore = create<State>((set, get) => ({
  opts: null,
  resolver: null,
  open: (opts) => new Promise<boolean>((resolve) => set({ opts, resolver: resolve })),
  close: (v) => { const r = get().resolver; set({ opts: null, resolver: null }); r?.(v) },
}))

// Diálogo de confirmação bonito, chamável de qualquer lado: `await confirm({...})`
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(opts)
}

export function ConfirmHost() {
  const t     = useT()
  const opts  = useConfirmStore((s) => s.opts)
  const close = useConfirmStore((s) => s.close)
  const scale = useRef(new Animated.Value(0.92)).current
  const op    = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!opts) return
    scale.setValue(0.92); op.setValue(0)
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 17, stiffness: 230 }),
      Animated.timing(op,    { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start()
  }, [opts])

  if (!opts) return null
  const { title, message, confirmText, cancelText, destructive, icon } = opts

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => close(false)}>
      <Pressable style={s.backdrop} onPress={() => close(false)}>
        <Animated.View style={[s.card, { opacity: op, transform: [{ scale }] }]} onStartShouldSetResponder={() => true}>
          {!!icon && (
            <View style={[s.iconWrap, destructive && s.iconWrapDanger]}>
              <Ionicons name={icon} size={26} color={destructive ? '#FF3B30' : colors.primary} />
            </View>
          )}
          <Text style={s.title}>{title}</Text>
          {!!message && <Text style={s.message}>{message}</Text>}
          <View style={s.row}>
            <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={() => close(false)} activeOpacity={0.8}>
              <Text style={s.cancelTxt}>{cancelText ?? t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, destructive ? s.dangerBtn : s.confirmBtn]} onPress={() => close(true)} activeOpacity={0.85}>
              <Text style={s.confirmTxt}>{confirmText ?? 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  card: {
    width: '100%', maxWidth: 320,
    backgroundColor: '#FFFFFF', borderRadius: 26,
    paddingTop: 24, paddingHorizontal: 22, paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 24,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, marginBottom: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(202,40,81,0.10)',
  },
  iconWrapDanger: { backgroundColor: 'rgba(255,59,48,0.12)' },
  title:   { fontFamily: fonts.bold, fontSize: 18, color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.3 },
  message: { fontFamily: fonts.regular, fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20, marginTop: 6 },
  row:     { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  btn:     { flex: 1, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#F0F0F3' },
  cancelTxt: { fontFamily: fonts.semiBold, fontSize: 15.5, color: '#3A3A3C' },
  confirmBtn: { backgroundColor: colors.primary },
  dangerBtn:  { backgroundColor: '#FF3B30' },
  confirmTxt: { fontFamily: fonts.bold, fontSize: 15.5, color: '#FFFFFF' },
})
