import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator,
  type ViewToken,
} from 'react-native'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setStatusBarStyle } from 'expo-status-bar'
import { PublicPost } from '../../types'
import { useGuestStore } from '../../store/guest.store'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'
import { useT } from '../../i18n'
import AvatarImage from '../../components/AvatarImage'
import Icon, { type IconName } from '../../components/Icon'

const { height: SCREEN_H } = Dimensions.get('window')

function resolveMedia(url: string | null | undefined): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

// ─── Uma acção trancada ───────────────────────────────────────────────────────
// Mostra o número real, mas o toque não faz a acção: leva à criação de conta.
// O cadeado é o ponto — ver o que existe é o que dá vontade de entrar.
function LockedAction({
  name, value, label, onPress,
}: { name: IconName; value?: number; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={s.action}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={name} size={27} color="#fff" strokeWidth={1.9} />
      {value !== undefined && value > 0 && <Text style={s.actionCount}>{value}</Text>}
    </TouchableOpacity>
  )
}

// ─── Uma célula ───────────────────────────────────────────────────────────────
function GuestItem({
  post, isActive, cellHeight, onRequireAccount,
}: {
  post: PublicPost
  isActive: boolean
  cellHeight: number
  onRequireAccount: () => void
}) {
  const t = useT()
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets()

  const isVideo = post.mediaType === 'VIDEO'
  const isText  = post.mediaType === 'TEXT'
  const uri     = resolveMedia(post.mediaUrl)

  const source = useMemo(() => (isVideo ? { uri } : null), [isVideo, uri])
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = false })

  useEffect(() => {
    if (!isVideo) return
    if (isActive) player.play()
    else player.pause()
  }, [isActive, player, isVideo])

  return (
    <View style={[s.cell, { height: cellHeight }]}>
      {isText ? (
        <View style={[s.media, { backgroundColor: post.bgColor || colors.black }]}>
          <Text style={s.textPost}>{post.caption}</Text>
        </View>
      ) : isVideo ? (
        <VideoView player={player} style={s.media} contentFit="cover" nativeControls={false} />
      ) : (
        <Image source={{ uri }} style={s.media} contentFit="cover" transition={160} />
      )}

      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        style={[s.scrimTop, { height: safeTop + 96 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={s.scrimBottom}
        pointerEvents="none"
      />

      {/* Porque é que este post está aqui. Sem isto, a vitrina não se explica. */}
      <View style={[s.kept, { top: safeTop + 14 }]}>
        <Icon name="shield-check" size={13} color="rgba(255,255,255,0.9)" strokeWidth={2} />
        <Text style={s.keptTxt}>{t.guest_kept}</Text>
      </View>

      <View style={[s.actions, { bottom: safeBottom + 150 }]}>
        <LockedAction name="heart"   value={post._count.likes}    label={t.guest_locked} onPress={onRequireAccount} />
        <LockedAction name="message" value={post._count.comments} label={t.guest_locked} onPress={onRequireAccount} />
        <LockedAction name="send"                                 label={t.guest_locked} onPress={onRequireAccount} />
      </View>

      <View style={[s.meta, { bottom: safeBottom + 96 }]}>
        <View style={s.author}>
          <AvatarImage uri={post.user.avatar} name={post.user.name} size={34} />
          <Text style={s.authorName} numberOfLines={1}>
            {post.user.username ? `@${post.user.username}` : post.user.name}
          </Text>
        </View>
        {!!post.caption && !isText && (
          <Text style={s.caption} numberOfLines={2}>{post.caption}</Text>
        )}
      </View>
    </View>
  )
}

// ─── Ecrã ─────────────────────────────────────────────────────────────────────
export default function GuestFeedScreen() {
  const t = useT()
  const { bottom: safeBottom } = useSafeAreaInsets()
  const posts          = useGuestStore((g) => g.posts)
  const loadMore       = useGuestStore((g) => g.loadMore)
  const requireAccount = useGuestStore((g) => g.requireAccount)

  const [activeId, setActiveId] = useState<string | null>(posts[0]?.id ?? null)
  const [listH, setListH]       = useState(SCREEN_H)

  useEffect(() => { setStatusBarStyle('light') }, [])

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable)
    if (first?.item) setActiveId((first.item as PublicPost).id)
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current

  const renderItem = useCallback(({ item }: { item: PublicPost }) => (
    <GuestItem
      post={item}
      isActive={item.id === activeId}
      cellHeight={listH}
      onRequireAccount={requireAccount}
    />
  ), [activeId, listH, requireAccount])

  const getItemLayout = useCallback((_: unknown, index: number) => (
    { length: listH, offset: listH * index, index }
  ), [listH])

  return (
    <View
      style={s.root}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height
        if (h > 0 && h !== listH) setListH(h)
      }}
    >
      {posts.length === 0 ? (
        <View style={s.loading}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          snapToInterval={listH}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          removeClippedSubviews
        />
      )}

      <Text style={s.wordmark}>luxee</Text>

      {/* A barra fica sempre: é a única saída deste ecrã. */}
      <View style={[s.gate, { paddingBottom: Math.max(safeBottom, 14) }]}>
        <TouchableOpacity
          style={s.joinBtn}
          onPress={requireAccount}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t.guest_join}
        >
          <Text style={s.joinTxt}>{t.guest_join}</Text>
        </TouchableOpacity>
        <Text style={s.gateSub}>{t.guest_join_sub}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.black },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cell:    { width: '100%', backgroundColor: colors.black },
  media:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  textPost: {
    color: '#fff', fontFamily: fonts.bold, fontSize: 26, lineHeight: 34,
    textAlign: 'center', paddingHorizontal: 32, letterSpacing: -0.5,
  },

  scrimTop:    { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },

  wordmark: {
    position: 'absolute', top: 52, left: 16,
    color: '#fff', fontFamily: fonts.extraBold, fontSize: 25, lineHeight: 32,
    letterSpacing: -1.25,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5,
  },

  kept: {
    position: 'absolute', right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.42)',
  },
  keptTxt: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 11, letterSpacing: -0.1 },

  actions: { position: 'absolute', right: 12, alignItems: 'center', gap: 20 },
  action:  { alignItems: 'center', gap: 4 },
  actionCount: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  meta:   { position: 'absolute', left: 16, right: 76, gap: 8 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorName: {
    flex: 1, color: '#fff', fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  caption: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },

  gate: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 12, gap: 8, alignItems: 'center',
  },
  joinBtn: {
    width: '100%', height: 50, borderRadius: 25,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  joinTxt:  { color: '#fff', fontFamily: fonts.bold, fontSize: 15.5, letterSpacing: -0.2 },
  gateSub:  { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 12.5, textAlign: 'center' },
})
