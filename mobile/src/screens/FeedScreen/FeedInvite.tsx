import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import Icon from '../../components/Icon'
import { useT } from '../../i18n'
import { useSocialPreviewStore } from '../../store/socialPreview.store'
import { colors, radius, spacing } from '../../theme'
import { FEED_CONTENT_MAX_WIDTH, feedIcon, feedInk, feedType, FEED_STROKE } from './tokens'

const GALLERY_SIZES = [42, 52, 64, 52, 42] as const
const GALLERY_LAYERS = [1, 3, 5, 4, 2] as const
const GALLERY_Y = [8, 3, 0, 3, 8] as const
const GALLERY_OVERLAP = 10
const CENTER_INDEX = 2

export interface InviteExample {
  urls: string[]
  authorName: string
  people: number
}

interface Props {
  cellHeight: number
  /** Um círculo verdadeiro da feed, usado quando já existe no pager. */
  example: InviteExample | null
  isActive: boolean
  reduceMotion: boolean
}

/**
 * Pausa social dentro do pager.
 *
 * Pequena como uma sugestão da própria rede: rostos e capturas circulares,
 * uma frase e uma única saída em baixo. Não tem card, separadores, numeração,
 * gradiente nem linguagem de landing page.
 */
export default function FeedInvite({
  cellHeight, example, isActive, reduceMotion,
}: Props) {
  const t = useT()
  const following = useSocialPreviewStore((state) => state.following)
  const followers = useSocialPreviewStore((state) => state.followers)
  const people = following.length > 0 ? following : followers

  // Capturas reais primeiro; os rostos da rede completam a composição quando
  // ainda não há um Círculo carregado. Não há pedido de rede extra.
  const galleryUrls = useMemo(() => {
    const candidates = [
      ...(example?.urls ?? []),
      ...people.map((person) => person.avatar).filter((uri): uri is string => !!uri),
    ]
    const unique = Array.from(new Set(candidates)).slice(0, GALLERY_SIZES.length)
    const slots: Array<string | null> = Array(GALLERY_SIZES.length).fill(null)
    // O primeiro conteúdo real ocupa o centro; o resto abre para os lados.
    const order = [2, 1, 3, 0, 4]
    unique.forEach((uri, index) => { slots[order[index]] = uri })
    return slots
  }, [example?.urls, people])

  // Uma única entrada curta. Sem cascata e sem movimento em loop: comporta-se
  // como conteúdo da Feed, não como apresentação de produto.
  const enter = useRef(new Animated.Value(isActive && !reduceMotion ? 0 : 1)).current

  useEffect(() => {
    if (reduceMotion) { enter.setValue(1); return }
    if (!isActive) { enter.setValue(0); return }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [enter, isActive, reduceMotion])

  return (
    <View style={[s.cell, { height: cellHeight }]}>
      <Animated.View
        style={[
          s.block,
          !reduceMotion && {
            opacity: enter,
            transform: [{
              translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
            }],
          },
        ]}
      >
        <View style={s.gallery} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {galleryUrls.map((uri, index) => {
            const size = GALLERY_SIZES[index]
            const center = index === CENTER_INDEX
            return (
              <View
                key={`${uri ?? 'empty'}-${index}`}
                style={[
                  s.galleryItem,
                  index > 0 && { marginLeft: -GALLERY_OVERLAP },
                  {
                    width: size,
                    height: size,
                    zIndex: GALLERY_LAYERS[index],
                    transform: [{ translateY: GALLERY_Y[index] }],
                  },
                ]}
              >
                <View style={[s.galleryCircle, { borderRadius: size / 2 }]}>
                  {uri ? (
                    <Image
                      source={{ uri }}
                      style={s.galleryMedia}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={120}
                    />
                  ) : (
                    <View style={s.galleryPlaceholder}>
                      <Icon
                        name={center ? 'camera' : 'user'}
                        size={center ? feedIcon.control : feedIcon.small}
                        color={feedInk.muted}
                        strokeWidth={FEED_STROKE}
                        absoluteStrokeWidth
                      />
                    </View>
                  )}
                </View>

                {center && (
                  <View style={s.plusBadge}>
                    <Icon
                      name="plus"
                      size={feedIcon.inline}
                      color={colors.feedSurface}
                      strokeWidth={2}
                      absoluteStrokeWidth
                    />
                  </View>
                )}
              </View>
            )
          })}
        </View>

        <Text style={s.title}>{t.feed_invite_title}</Text>
        <Text style={s.sub}>{t.feed_invite_sub}</Text>

        {example && (
          <Text style={s.socialProof} numberOfLines={1}>
            {example.people > 1
              ? t.feed_invite_example_more
                  .replace('{name}', example.authorName.split(' ')[0])
                  .replace('{count}', String(Math.max(1, example.people - 1)))
              : t.feed_invite_example.replace('{name}', example.authorName.split(' ')[0])}
          </Text>
        )}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  cell: {
    width: '100%',
    backgroundColor: colors.feedSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  block: {
    width: '100%',
    maxWidth: FEED_CONTENT_MAX_WIDTH + spacing.md * 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  gallery: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  galleryItem: { position: 'relative' },
  galleryCircle: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    // O recorte tem a mesma cor do fundo: só separa fotografias sobrepostas,
    // sem desenhar um anel visível à volta delas.
    borderWidth: 3,
    borderColor: colors.feedSurface,
  },
  galleryMedia: { width: '100%', height: '100%' },
  galleryPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: feedInk.primary,
    borderWidth: 2,
    borderColor: colors.feedSurface,
  },
  title: {
    maxWidth: 310,
    marginTop: spacing.md,
    ...feedType.title,
    color: feedInk.primary,
    textAlign: 'center',
  },
  sub: {
    maxWidth: 320,
    marginTop: spacing.sm,
    ...feedType.copy,
    color: feedInk.muted,
    textAlign: 'center',
  },
  socialProof: {
    maxWidth: 280,
    marginTop: spacing.md,
    ...feedType.meta,
    color: feedInk.secondary,
    textAlign: 'center',
  },
})
