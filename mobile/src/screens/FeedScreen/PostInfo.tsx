import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, spacing } from '../../theme'

interface Props {
  post: Post
}

export default function PostInfo({ post }: Props) {
  const [expanded, setExpanded] = useState(false)
  const caption = post.caption ?? ''
  const isLong = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'

  function timeLeft() {
    const diff = new Date(post.expiresAt).getTime() - Date.now()
    const h = Math.max(0, Math.floor(diff / 3600000))
    const m = Math.max(0, Math.floor((diff % 3600000) / 60000))
    return `${h}h ${m}m`
  }

  return (
    <View style={s.container}>
      <View style={s.userRow}>
        <Text style={s.username}>@{post.user.name}</Text>
        {post.extended && (
          <View style={s.badge}>
            <Text style={s.badgeText}>+24h</Text>
          </View>
        )}
      </View>

      {caption.length > 0 && (
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8}>
          <Text style={s.caption}>
            {displayed}
            {isLong && !expanded && <Text style={s.seeMore}> Ver mais</Text>}
          </Text>
        </TouchableOpacity>
      )}

      <View style={s.timerRow}>
        <Ionicons name="time-outline" size={13} color={colors.gray400} />
        <Text style={s.timer}> expira em {timeLeft()}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { position: 'absolute', left: 16, bottom: 120, right: 86, gap: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: colors.white, fontWeight: '800', fontSize: 17 },
  badge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  caption: { color: colors.white, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  seeMore: { color: colors.gray200, fontWeight: '700' },
  timerRow: { flexDirection: 'row', alignItems: 'center' },
  timer: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },
})
