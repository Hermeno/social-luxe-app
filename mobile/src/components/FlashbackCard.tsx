import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native'
import { Post } from '../types'
import { colors, fonts, spacing, radius } from '../theme'

interface Props {
  post: Post
  onDismiss: () => void
}

const API_BASE = 'http://192.168.43.184:3000'

export default function FlashbackCard({ post, onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  const thumbUri = post.mediaUrl.startsWith('http')
    ? post.mediaUrl
    : `${API_BASE}${post.mediaUrl}`

  const caption = post.caption ?? ''
  const displayed = caption.length > 60 ? caption.slice(0, 60) + '…' : caption

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim }]}>
      <View style={s.header}>
        <Text style={s.emoji}>📅</Text>
        <Text style={s.headerText}>Neste dia, 1 ano atrás</Text>
      </View>

      <View style={s.body}>
        <Image source={{ uri: thumbUri }} style={s.thumb} resizeMode="cover" />
        {displayed.length > 0 && (
          <Text style={s.caption} numberOfLines={2}>{displayed}</Text>
        )}
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={s.viewBtn} activeOpacity={0.8}>
          <Text style={s.viewText}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.closeBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={s.closeText}>✕ Fechar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  card:       {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: '#181818',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  header:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  emoji:      { fontSize: 16 },
  headerText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13, letterSpacing: 0.2 },
  body:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  thumb:      { width: 64, height: 64, borderRadius: radius.md, backgroundColor: '#333' },
  caption:    { flex: 1, color: 'rgba(255,255,255,0.75)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  actions:    {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  viewBtn:    {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 8, alignItems: 'center',
  },
  viewText:   { color: colors.white, fontFamily: fonts.semiBold, fontSize: 13 },
  closeBtn:   {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full,
    paddingVertical: 8, alignItems: 'center',
  },
  closeText:  { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.regular, fontSize: 13 },
})
