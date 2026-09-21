import React, { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import Icon from '../../components/Icon'
import { useT } from '../../i18n'
import { colors, fonts, spacing, typography } from '../../theme'
import {
  actionInkRest, feedIcon, homeType, pageDanger, pageInk, pageLine, pageSkeleton,
} from '../FeedScreen/tokens'

const SIDE = spacing.md

/**
 * Os estados da Home — o que a página mostra quando ainda não há publicações,
 * quando não há rede, quando a página seguinte falha.
 *
 * Vivem juntos de propósito: são a mesma superfície branca com a mesma régua
 * lateral, e espalhá-los pelo ecrã que os desenha era como cada um deles
 * acabava com o seu cinzento e o seu espaçamento.
 */

interface SkeletonProps {
  width: number
  reduceMotion: boolean
}

/**
 * O primeiro carregamento.
 *
 * Um pulso de opacidade sobre a forma da publicação — nunca um shimmer que
 * atravessa a célula. E só nas que estão à vista: a Home monta três, e são
 * essas três que respiram.
 */
export function HomeSkeleton({ width, reduceMotion }: SkeletonProps) {
  const t = useT()
  const opacity = useRef(new Animated.Value(0.65)).current

  useEffect(() => {
    opacity.setValue(reduceMotion ? 1 : 0.65)
    if (reduceMotion) return

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease),
        isInteraction: false, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.65, duration: 600, easing: Easing.inOut(Easing.ease),
        isInteraction: false, useNativeDriver: true,
      }),
    ]))
    pulse.start()
    return () => pulse.stop()
  }, [opacity, reduceMotion])

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t.home_loading}
      accessibilityState={{ busy: true }}
    >
      <Animated.View
        style={{ opacity }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={s.head}>
          <View style={[s.block, s.avatar]} />
          <View style={s.headText}>
            <View style={[s.block, s.name]} />
            <View style={[s.block, s.context]} />
          </View>
        </View>
        <View style={[s.media, { width, height: Math.round(width / 0.8) * 0.62 }]} />
        <View style={s.actions}>
          {[0, 1, 2].map((key) => <View key={key} style={[s.block, s.action]} />)}
        </View>
        <View style={[s.block, s.caption]} />
        <View style={[s.block, s.captionShort]} />
      </Animated.View>
    </View>
  )
}

interface EmptyProps {
  onCreate: () => void
  onSearch: () => void
}

/** Nada para mostrar — e duas saídas concretas, sem ilustração inventada. */
export function HomeEmpty({ onCreate, onSearch }: EmptyProps) {
  const t = useT()

  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle} accessibilityRole="header">{t.home_empty_title}</Text>
      <Text style={s.emptyBody}>{t.home_empty_body}</Text>
      <View style={s.emptyActions}>
        <TouchableOpacity style={s.emptyAction} onPress={onCreate} activeOpacity={0.65} accessibilityRole="button">
          <Icon name="plus" size={feedIcon.control} color={pageInk.primary} />
          <Text style={s.emptyCreate}>{t.home_empty_create}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.emptyAction} onPress={onSearch} activeOpacity={0.65} accessibilityRole="button">
          <Text style={s.emptySearch}>{t.home_empty_search}</Text>
          <Icon name="arrow-right" size={feedIcon.small} color={pageInk.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/**
 * Sem ligação.
 *
 * Uma faixa compacta e nada mais: o conteúdo em cache continua por baixo, e as
 * acções entram na fila que já existe. A Home não esvazia por falta de rede.
 */
export function HomeOffline() {
  const t = useT()
  return (
    <View style={s.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={s.offlineText}>{t.home_offline}</Text>
    </View>
  )
}

interface FooterProps {
  loading: boolean
  failed: boolean
  onRetry: () => void
}

/**
 * O fim da lista.
 *
 * Enquanto a página seguinte vem, um carregador da altura de um alvo de toque;
 * se ela falhar, o mesmo espaço passa a oferecer repetir. A lista nunca perde o
 * que já tem por causa de uma página que não chegou.
 */
export function HomeFooter({ loading, failed, onRetry }: FooterProps) {
  const t = useT()
  if (!loading && !failed) return null

  return (
    <View style={s.footer}>
      {failed ? (
        <TouchableOpacity
          style={s.footerRetry}
          onPress={onRetry}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t.home_retry}
        >
          <Text style={s.footerFailed}>{t.home_load_failed}</Text>
          <Text style={s.footerRetryText}>{t.home_retry}</Text>
        </TouchableOpacity>
      ) : (
        <ActivityIndicator color={actionInkRest.page} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  block: { backgroundColor: pageSkeleton, borderRadius: 4 },

  head: {
    minHeight: 50,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm2,
    paddingHorizontal: SIDE,
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  headText: { gap: spacing.xs2 },
  name: { width: 122, height: 10 },
  context: { width: 82, height: 8 },
  media: { backgroundColor: pageSkeleton },
  actions: { flexDirection: 'row', gap: spacing.sm2, paddingHorizontal: SIDE, minHeight: 48, alignItems: 'center' },
  action: { width: 62, height: 32, borderRadius: 8 },
  caption: { marginHorizontal: SIDE, width: '84%', height: 10 },
  captionShort: { marginTop: spacing.xs2, marginHorizontal: SIDE, width: '56%', height: 10, marginBottom: spacing.xl },

  empty: { paddingHorizontal: SIDE, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  emptyTitle: {
    maxWidth: 320, color: pageInk.primary, fontFamily: fonts.bold,
    fontSize: typography.display, lineHeight: 36, letterSpacing: -0.8,
  },
  emptyBody: {
    maxWidth: 320, marginTop: spacing.sm2, color: pageInk.secondary,
    fontFamily: fonts.regular, fontSize: typography.body, lineHeight: 23,
  },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, marginTop: spacing.lg },
  emptyAction: { minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  emptyCreate: { flexShrink: 1, color: pageInk.primary, fontFamily: fonts.semiBold, fontSize: typography.body },
  emptySearch: { flexShrink: 1, color: pageInk.secondary, fontFamily: fonts.medium, fontSize: typography.body },

  offline: {
    marginHorizontal: SIDE, marginTop: spacing.sm2,
    paddingHorizontal: spacing.sm2, paddingVertical: spacing.xs2 + 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: pageLine,
    backgroundColor: colors.white,
  },
  offlineText: { color: pageInk.secondary, ...homeType.context },

  footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIDE },
  footerRetry: { minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  footerFailed: { color: pageInk.secondary, textAlign: 'center', ...homeType.caption },
  footerRetryText: { color: pageDanger, ...homeType.username },
})
