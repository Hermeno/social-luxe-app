import React, { memo, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing } from '../../theme'
import { FEED_CONTENT_MAX_WIDTH, feedIcon, feedInk, feedLine, feedType } from '../../screens/FeedScreen/tokens'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useOverlayStore } from '../../store/overlay.store'
import { useT } from '../../i18n'
import Icon from '../Icon'
import {
  FEED_COMPOSER_HEIGHT,
  TAB_BAR_ICON_LIFT,
  TAB_BAR_STAGE_HEIGHT,
  TAB_BAR_TOP_GAP,
  tabBarBottomInset,
} from './layout'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import useComposerReveal from './useComposerReveal'
import useNavSkin from './useNavSkin'

// ─── Sistema ótico da navegação ─────────────────────────────────────────────
//
// Uma só família, uma só grelha 24×24 e um único traço de 1.9pt. O tamanho da
// caixa varia apenas para compensar a área viva de cada desenho: o olho vê a
// tinta, não o viewBox. Todos chegam assim aos mesmos 21pt de massa visual sem
// esticar paths, misturar preenchidos com contornos ou corrigir cada estado.
const NAV_INK = 21
const STROKE = 1.9
const opticalSize = (geometry: number) =>
  +(((NAV_INK - STROKE) * 24) / geometry).toFixed(2)

const NAV_GLYPHS = {
  home:    { icon: 'home',       size: opticalSize(17.5),  nudgeY: 0 },
  search:  { icon: 'search',     size: opticalSize(16.75), nudgeY: -0.1 },
  circle:  { icon: 'circle-add', size: opticalSize(18),    nudgeY: 0 },
  message: { icon: 'message',    size: opticalSize(17.3),  nudgeY: 0 },
  profile: { icon: 'user',       size: opticalSize(16.75), nudgeY: -0.4 },
} as const

type NavGlyph = keyof typeof NAV_GLYPHS

const NavigationGlyph = memo(function NavigationGlyph({
  glyph,
  selected,
  activeColor,
  inactiveColor,
}: {
  glyph: NavGlyph
  selected: boolean
  activeColor: string
  inactiveColor: string
}) {
  const metric = NAV_GLYPHS[glyph]

  return (
    <View style={s.navGlyph} pointerEvents="none">
      <View
        style={[
          s.navGlyphInk,
          { transform: [{ translateY: -1 + metric.nudgeY }] },
        ]}
      >
        <Icon
          name={metric.icon}
          size={metric.size}
          color={selected ? activeColor : inactiveColor}
          strokeWidth={STROKE}
          absoluteStrokeWidth
        />
      </View>
      <View
        style={[
          s.navSelectionMark,
          {
            backgroundColor: activeColor,
            opacity: selected ? 1 : 0,
            transform: [{ scale: selected ? 1 : 0.6 }],
          },
        ]}
      />
    </View>
  )
})

/** Largura que o compositor cede por cada atalho revelado. */
const REVEAL_SLOT = 46
/**
 * Os atalhos revelados são secundários — vivem ao lado do campo, não na fila
 * dos separadores — por isso levam um degrau de tinta abaixo dos 21 da barra.
 * A calibração é a mesma: só muda o alvo.
 */
const REVEAL_INK = 18
const revealSize = (geometry: number) => +(((REVEAL_INK - STROKE) * 24) / geometry).toFixed(2)
const SZ_REVEAL_CIRCLE = revealSize(18)    // circle-add ⇒ 18 de lado
const SZ_REVEAL_PLUS = revealSize(15.5)    // plus ⇒ 15.5 de lado

function MotionTabButton({
  children, selected, onPress, label, valueText,
  pulseSignal = 0, reduceMotion, role = 'tab',
}: {
  children: React.ReactNode
  selected: boolean
  onPress: () => void
  label: string
  valueText?: string
  pulseSignal?: number
  reduceMotion: boolean
  role?: 'tab' | 'button'
}) {
  const scale = useRef(new Animated.Value(1)).current
  const pulse = useRef(new Animated.Value(0)).current
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (reduceMotion) {
      scale.stopAnimation()
      scale.setValue(1)
      return
    }
    if (!selected) return
    scale.setValue(0.94)
    Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 6, useNativeDriver: true }).start()
  }, [reduceMotion, scale, selected])

  useEffect(() => {
    if (reduceMotion) {
      pulse.stopAnimation()
      pulse.setValue(0)
      return
    }
    if (pulseSignal === 0) return
    pulse.setValue(0)
    Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }).start()
  }, [pulse, pulseSignal, reduceMotion])

  function pressIn() {
    if (reduceMotion) return
    Animated.spring(scale, { toValue: 0.92, speed: 42, bounciness: 2, useNativeDriver: true }).start()
  }

  function pressOut() {
    if (reduceMotion) return
    Animated.spring(scale, { toValue: 1, speed: 25, bounciness: 8, useNativeDriver: true }).start()
  }

  return (
    <TouchableOpacity
      style={s.btn}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityValue={valueText ? { text: valueText } : undefined}
      accessibilityState={role === 'tab' ? { selected } : undefined}
    >
      <Animated.View
        style={[
          s.navIconMotion,
          {
            opacity: pulse.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 0.78, 1] }),
            transform: [
              { scale },
              { scale: pulse.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 1.05, 1] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}

function MessageBadge({
  count, reduceMotion,
}: {
  count: number
  reduceMotion: boolean
}) {
  const scale  = useRef(new Animated.Value(0)).current
  const wobble = useRef(new Animated.Value(0)).current
  const prev   = useRef(0)

  useEffect(() => {
    if (reduceMotion) {
      scale.stopAnimation()
      wobble.stopAnimation()
      scale.setValue(count > 0 ? 1 : 0)
      wobble.setValue(0)
      prev.current = count
      return
    }
    if (count > 0 && prev.current === 0) {
      // First appearance — spring pop-in
      Animated.spring(scale, {
        toValue: 1,
        tension: 260,
        friction: 7,
        useNativeDriver: true,
      }).start()
    } else if (count > prev.current && count > 0) {
      // New message arrived — quick wiggle
      Animated.sequence([
        Animated.timing(wobble, { toValue:  4, duration: 60, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(wobble, { toValue:  2, duration: 50, useNativeDriver: true }),
        Animated.timing(wobble, { toValue:  0, duration: 50, useNativeDriver: true }),
      ]).start()
    } else if (count === 0) {
      scale.setValue(0)
    }
    prev.current = count
  }, [count, reduceMotion, scale, wobble])

  if (count === 0) return null

  const label = count > 99 ? '99+' : String(count)

  return (
    <Animated.View
      style={[
        s.badgeAnchor,
        { transform: [{ scale }, { translateX: wobble }] },
      ]}
    >
      <View style={s.badgeCounter}>
        <Text style={s.badgeTxt}>{label}</Text>
      </View>
    </Animated.View>
  )
}

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom }    = useSafeAreaInsets()
  const t             = useT()
  const reduceMotion  = useReducedMotionPreference()
  const overlayOpen   = useOverlayStore((s) => s.count > 0)
  const newPostsCount = useFeedStore((s) => s.newPostsCount)
  const totalUnread   = useMessageBadgeStore((s) => s.totalUnread)
  const openSearch    = useFeedStore((s) => s.openSearch)
  const searchVisible = useFeedStore((s) => s.searchVisible)
  const bumpHomeTap   = useFeedStore((s) => s.bumpHomeTap)
  const homeTap       = useFeedStore((s) => s.homeTap)
  const commentTarget = useFeedStore((s) => s.activeCommentTarget)
  // Só vale na feed: nenhum outro separador recolhe a navegação.
  const immersive = useFeedStore((s) => s.immersive)
  const feedInviteActive = useFeedStore((s) => s.feedInviteActive)
  const requestComments = useFeedStore((s) => s.requestComments)
  const clearFocusedPost = useFeedStore((s) => s.clearFocusedPost)
  const currentUser   = useAuthStore((s) => s.user)
  const barVisibility = useRef(new Animated.Value(1)).current
  const commentScale = useRef(new Animated.Value(1)).current
  // 0 = barra normal · 1 = só o campo de comentar, de margem a margem.
  const collapse = useRef(new Animated.Value(0)).current
  // A face clicável muda apenas no fim do crossfade. Assim nunca há um
  // controlo quase invisível a receber o toque destinado ao que ainda se vê.
  const [interactiveFace, setInteractiveFace] = useState<'navigation' | 'composer'>('navigation')

  const activeRoute = state.routes[state.index]
  const activeTab  = activeRoute.name
  const onFeed     = activeTab === 'Feed'
  const onCircle   = activeTab === 'Circle'
  const onSearch   = activeTab === 'Search'
  const showFeedInviteCta = onFeed && feedInviteActive
  // ── Pele da barra ─────────────────────────────────────────────────────────
  //
  // `clear` só se aplica onde há fundo escuro por baixo. A Feed e o Círculo têm
  // (#0B141A e preto); Pesquisa, Chat, Criar e Perfil são papel branco, e ali
  // uma faixa transparente com tinta branca dava ícones invisíveis sobre branco.
  // Nesses ecrãs a barra fica de papel, seja qual for a pele da sessão.
  const skin = useNavSkin()
  const darkCanvas = onFeed || onCircle
  const clear = skin === 'clear' && darkCanvas

  // A forma nunca muda de família. Selecção = contraste + marca mínima; na pele
  // de papel entra o violeta oficial, sobre mídia prevalece o branco legível.
  const iconActive = clear ? '#FFFFFF' : colors.accent
  const iconInactv = clear ? 'rgba(255,255,255,0.68)' : 'rgba(18,18,20,0.56)'

  useLayoutEffect(() => {
    barVisibility.stopAnimation()
    // Uma folha que sobe já ocupa a atenção e a barra pode estar branca. Sumir
    // imediatamente impede a faixa de competir com o primeiro frame da folha.
    // Na volta, sim, a barra reaparece com movimento porque já não há superfície
    // a atravessá-la.
    if (overlayOpen) {
      barVisibility.setValue(0)
      return
    }
    if (reduceMotion) { barVisibility.setValue(1); return }
    Animated.timing(barVisibility, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [barVisibility, overlayOpen, reduceMotion])

  function goTo(tab: string) {
    const route = state.routes.find((r) => r.name === tab)
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!event.defaultPrevented) navigation.navigate(tab)
  }

  const homeActive   = activeTab === 'Feed' && !openSearch && !searchVisible
  const msgActive    = activeTab === 'Messages'
  const profActive   = activeTab === 'Profile'
  const commentLabel = commentTarget && commentTarget.authorId !== currentUser?.id
    ? `${t.msg_reply_to} ${commentTarget.authorName.split(' ')[0]}…`
    : t.feed_add_comment
  const newPostValue = newPostsCount > 0
    ? `${newPostsCount} ${newPostsCount === 1 ? t.nav_new_post : t.nav_new_posts}`
    : undefined
  const unreadValue = totalUnread > 0
    ? `${totalUnread} ${totalUnread === 1 ? t.nav_unread_message : t.nav_unread_messages}`
    : undefined

  // A Feed mantém uma stage de altura fixa: cinco controlos iguais dão lugar ao
  // compositor sem alterar a geometria reservada pela mídia e pelo scrubber.
  // Sem post por baixo não há nada para comentar. Na pausa do Círculo, o estado
  // dedicado abaixo substitui toda a navegação por uma só saída inequívoca.
  const collapsed = onFeed && immersive && !!commentTarget
  useEffect(() => {
    // Outra aba nunca herda um frame transparente/recolhido da Feed.
    if (!onFeed) {
      collapse.stopAnimation()
      collapse.setValue(0)
      setInteractiveFace('navigation')
      return
    }
    if (reduceMotion) {
      collapse.stopAnimation()
      collapse.setValue(collapsed ? 1 : 0)
      setInteractiveFace(collapsed ? 'composer' : 'navigation')
      return
    }
    collapse.stopAnimation()
    Animated.timing(collapse, {
      toValue: collapsed ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // A cor da barra e a margem do compositor acompanham esta transição.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setInteractiveFace(collapsed ? 'composer' : 'navigation')
    })
  }, [collapsed, collapse, onFeed, reduceMotion])

  // ── Atalhos que o compositor revela de tempos a tempos ────────────────────
  // A largura é o produto de um só valor animado, para os dois níveis usarem a
  // mesma curva: abrir para um atalho e abrir para dois é o mesmo gesto, com
  // amplitude diferente.
  const [composerBusy, setComposerBusy] = useState(false)
  const revealLevel = useComposerReveal({
    active: onFeed && interactiveFace === 'composer',
    busy: composerBusy,
    reduceMotion,
  })
  const revealWidth = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const target = revealLevel * REVEAL_SLOT
    revealWidth.stopAnimation()
    if (reduceMotion) { revealWidth.setValue(target); return }
    Animated.timing(revealWidth, {
      toValue: target,
      // Longo de propósito. A abertura não responde a nenhum toque — ninguém
      // está à espera dela — por isso pode demorar o tempo de se ler como
      // movimento em vez de aparecer como um salto.
      duration: revealLevel === 0 ? 340 : 420,
      easing: revealLevel === 0 ? Easing.inOut(Easing.cubic) : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [revealLevel, reduceMotion, revealWidth])

  const navigationInteractive = !onFeed || interactiveFace === 'navigation'
  const composerInteractive = onFeed && interactiveFace === 'composer'

  function animateCommentField(pressed: boolean) {
    if (reduceMotion) return
    Animated.spring(commentScale, {
      toValue: pressed ? 0.975 : 1,
      speed: pressed ? 38 : 24,
      bounciness: pressed ? 2 : 7,
      useNativeDriver: true,
    }).start()
  }

  useEffect(() => {
    if (!reduceMotion) return
    commentScale.stopAnimation()
    commentScale.setValue(1)
  }, [commentScale, reduceMotion])

  function goToOwnProfile() {
    const route = state.routes.find((item) => item.name === 'Profile')
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!event.defaultPrevented) {
      // Passar o parâmetro explicitamente evita que um `userId` antigo da rota
      // Profile da Tab sobreviva ao toque no ícone do próprio utilizador.
      navigation.navigate('Profile', { userId: undefined })
    }
  }

  // Home guarda o contador de novos posts e responde ao duplo toque com o mesmo
  // pulso. O desenho pertence agora à mesma família dos outros quatro destinos.
  const homeTab = (
    <MotionTabButton
      key="home"
      onPress={() => {
        if (activeTab === 'Feed') bumpHomeTap()
        else { clearFocusedPost(); goTo('Feed') }
      }}
      label={t.nav_home}
      valueText={newPostValue}
      selected={homeActive}
      pulseSignal={homeTap}
      reduceMotion={reduceMotion}
    >
      <MessageBadge count={newPostsCount} reduceMotion={reduceMotion} />
      <NavigationGlyph
        glyph="home"
        selected={homeActive}
        activeColor={iconActive}
        inactiveColor={iconInactv}
      />
    </MotionTabButton>
  )

  const chatTab = (
    <MotionTabButton
      key="chat"
      onPress={() => goTo('Messages')}
      label={t.nav_chat}
      valueText={unreadValue}
      selected={msgActive}
      pulseSignal={totalUnread}
      reduceMotion={reduceMotion}
    >
      <MessageBadge count={totalUnread} reduceMotion={reduceMotion} />
      <NavigationGlyph
        glyph="message"
        selected={msgActive}
        activeColor={iconActive}
        inactiveColor={iconInactv}
      />
    </MotionTabButton>
  )

  const profileTab = (
    <MotionTabButton
      key="profile"
      onPress={goToOwnProfile}
      label={t.nav_profile}
      selected={profActive}
      reduceMotion={reduceMotion}
    >
      <NavigationGlyph
        glyph="profile"
        selected={profActive}
        activeColor={iconActive}
        inactiveColor={iconInactv}
      />
    </MotionTabButton>
  )

  const searchTab = (
    <MotionTabButton
      key="search"
      onPress={() => goTo('Search')}
      label={t.feed_top_search}
      selected={onSearch}
      reduceMotion={reduceMotion}
    >
      <NavigationGlyph
        glyph="search"
        selected={onSearch}
        activeColor={iconActive}
        inactiveColor={iconInactv}
      />
    </MotionTabButton>
  )

  const circleTab = (
    <MotionTabButton
      key="circle"
      onPress={() => goTo('Circle')}
      label={t.feed_top_circle}
      selected={onCircle}
      reduceMotion={reduceMotion}
    >
      <NavigationGlyph
        glyph="circle"
        selected={onCircle}
        activeColor={iconActive}
        inactiveColor={iconInactv}
      />
    </MotionTabButton>
  )

  // Os mesmos cinco separadores, na mesma ordem, em todos os ecrãs. Uma barra
  // que muda de conteúdo conforme a página obriga a reaprendê-la a cada
  // navegação — e era o que acontecia: a Feed mostrava cinco, o resto três.
  const primaryTabs = (
    <>
      {homeTab}
      {searchTab}
      {circleTab}
      {chatTab}
      {profileTab}
    </>
  )

  return (
    <Animated.View
      style={[
        s.root,
        {
          opacity: barVisibility,
          transform: [{ translateY: barVisibility.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}
      pointerEvents={overlayOpen ? 'none' : 'box-none'}
      accessibilityElementsHidden={overlayOpen}
      importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View
        style={[
          s.bar,
          {
            paddingBottom: tabBarBottomInset(bottom),
            // Faixa de margem a margem. O `paddingBottom` da safe area entra
            // dentro dela, por isso a altura toda — do topo da linha até ao
            // fundo do ecrã — toma a cor da pele.
            backgroundColor: showFeedInviteCta || clear ? 'transparent' : '#FFFFFF',
          },
        ]}
      >
        {showFeedInviteCta ? (
          <View style={s.feedInviteStage}>
            <TouchableOpacity
              style={s.getStartedButton}
              onPress={() => goTo('Circle')}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel={t.feed_invite_get_started}
            >
              <Text style={s.getStartedText}>{t.feed_invite_get_started}</Text>
              <View style={s.getStartedArrow}>
                <Icon
                  name="arrow-right"
                  size={feedIcon.control}
                  color={colors.black}
                  strokeWidth={STROKE}
                  absoluteStrokeWidth
                />
              </View>
            </TouchableOpacity>
          </View>
        ) : onFeed ? (
          <View style={s.feedStage}>
            {/* Uma única fila, cinco células iguais. Nenhum subgrupo pode
                introduzir uma largura mínima ou um intervalo diferente. */}
            <Animated.View
              style={[
                s.feedNavigationFace,
                {
                  opacity: collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [{
                    translateY: collapse.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
                  }],
                },
              ]}
              pointerEvents={navigationInteractive ? 'auto' : 'none'}
              accessibilityElementsHidden={!navigationInteractive}
              importantForAccessibility={navigationInteractive ? 'auto' : 'no-hide-descendants'}
            >
              {/* A cápsula ocupa exactamente o rectângulo do campo de comentar:
                  mesma altura, mesmo raio, mesma margem. No crossfade lê-se como
                  um só objecto a trocar de conteúdo, não como duas barras. */}
              <View style={[s.navShell, !clear && s.navShellPaper]}>
                {primaryTabs}
              </View>
            </Animated.View>

            <Animated.View
              style={[
                s.feedComposerFace,
                {
                  opacity: collapse,
                  paddingHorizontal: collapse.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }),
                  transform: [{
                    translateY: collapse.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
                  }],
                },
              ]}
              pointerEvents={composerInteractive ? 'auto' : 'none'}
              accessibilityElementsHidden={!composerInteractive}
              importantForAccessibility={composerInteractive ? 'auto' : 'no-hide-descendants'}
            >
              <Animated.View style={[s.composerMotion, { transform: [{ scale: commentScale }] }]}>
                <TouchableOpacity
                  style={[s.commentField, !commentTarget && s.commentFieldDisabled]}
                  onPress={() => commentTarget && requestComments(commentTarget.postId)}
                  onPressIn={() => { setComposerBusy(true); animateCommentField(true) }}
                  onPressOut={() => { setComposerBusy(false); animateCommentField(false) }}
                  activeOpacity={0.9}
                  disabled={!commentTarget}
                  accessibilityRole="button"
                  accessibilityLabel={commentLabel}
                  accessibilityState={{ disabled: !commentTarget }}
                >
                  <Text style={s.commentText} numberOfLines={1}>{commentLabel}</Text>
                </TouchableOpacity>

                {/* Os atalhos vivem numa caixa que abre da direita para a
                    esquerda. `overflow: hidden` corta-os enquanto o espaço
                    ainda não existe, por isso não há um instante em que
                    apareçam esmagados — é o que evita o piscar. */}
                <Animated.View style={[s.revealSlot, { width: revealWidth }]}>
                  <View style={s.revealRow}>
                    {/* O segundo atalho é o que fica mais longe do campo: no
                        nível 1 é ele que está fora da janela, e no nível 2
                        entra sem o primeiro se mexer. */}
                    <TouchableOpacity
                      style={s.revealBtn}
                      onPress={() => goTo('Create')}
                      onPressIn={() => setComposerBusy(true)}
                      onPressOut={() => setComposerBusy(false)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t.feed_create}
                    >
                      <Animated.View
                        style={{
                          opacity: revealWidth.interpolate({
                            inputRange: [REVEAL_SLOT + 8, REVEAL_SLOT * 2 - 8],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                          }),
                          transform: [{
                            translateX: revealWidth.interpolate({
                              inputRange: [REVEAL_SLOT, REVEAL_SLOT * 2],
                              outputRange: [10, 0],
                              extrapolate: 'clamp',
                            }),
                          }],
                        }}
                      >
                        <Icon name="plus" size={SZ_REVEAL_PLUS} color={iconActive} strokeWidth={STROKE} absoluteStrokeWidth />
                      </Animated.View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.revealBtn}
                      onPress={() => goTo('Circle')}
                      onPressIn={() => setComposerBusy(true)}
                      onPressOut={() => setComposerBusy(false)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={t.feed_top_circle}
                    >
                      <Animated.View
                        style={{
                          opacity: revealWidth.interpolate({
                            inputRange: [8, REVEAL_SLOT - 8],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                          }),
                          transform: [{
                            translateX: revealWidth.interpolate({
                              inputRange: [0, REVEAL_SLOT],
                              outputRange: [10, 0],
                              extrapolate: 'clamp',
                            }),
                          }],
                        }}
                      >
                        <Icon name="circle-add" size={SZ_REVEAL_CIRCLE} color={iconActive} strokeWidth={STROKE} absoluteStrokeWidth />
                      </Animated.View>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </View>
        ) : (
          <View style={[s.navShell, !clear && s.navShellPaper]}>{primaryTabs}</View>
        )}
      </Animated.View>
    </Animated.View>
  )
}

/** Um degrau acima do fundo da Feed — lê-se como campo sem virar cartão. */

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TAB_BAR_TOP_GAP,
  },
  feedStage: {
    flex: 1,
    height: TAB_BAR_STAGE_HEIGHT,
    position: 'relative',
  },
  feedInviteStage: {
    flex: 1,
    height: TAB_BAR_STAGE_HEIGHT,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedButton: {
    width: '100%',
    maxWidth: FEED_CONTENT_MAX_WIDTH,
    height: 52,
    paddingHorizontal: spacing.md2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  getStartedText: {
    ...feedType.primary,
    color: colors.black,
    textAlign: 'center',
  },
  getStartedArrow: {
    position: 'absolute',
    right: spacing.md,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedNavigationFace: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A navegação deixou de ser uma cápsula: é a própria faixa branca, de margem
  // a margem. Sem raio, sem borda e sem sombra.
  // Uma só geometria, em todos os ecrãs.
  //
  // A Feed tinha 56 de altura (a do compositor) e margem zero; os outros ecrãs
  // tinham 48 e margem de 14, herdada de quando o campo social partilhava a
  // faixa. Resultado: mudar de separador deslocava os ícones 4px na vertical e
  // as células mudavam de largura — a mesma barra em dois sítios diferentes.
  //
  // `TAB_BAR_STAGE_HEIGHT` é o maior dos dois, que é o que a Feed já reserva,
  // por isso nada encolhe. Margem zero em todo o lado: as cinco células dividem
  // a largura toda e cada ícone fica no centro da sua parte.
  navShell: {
    flex: 1,
    height: TAB_BAR_STAGE_HEIGHT,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  navShellPaper: { backgroundColor: '#FFFFFF' },
  feedComposerFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 5:4 — a mesma proporção de sempre entre o bloco social e as três tabs, só
  // que agora dentro da mesma borda em vez de dois campos encostados.
  composerMotion: {
    width: '100%',
    height: FEED_COMPOSER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A janela que abre. Alinhada à direita para o conteúdo entrar por aí: com
  // `flex-start` os atalhos deslizariam a partir do campo, que é o contrário do
  // que se quer — quem cede espaço é o campo, quem chega vem da borda.
  revealSlot: {
    height: '100%',
    overflow: 'hidden',
  },
  // Absoluto e encostado à direita: assim mantém sempre a largura dos dois
  // atalhos e é a janela que decide quanto se vê. Em fluxo normal o Yoga
  // comprimia-o à largura do pai e os ícones encolhiam em vez de serem cortados.
  revealRow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_SLOT * 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  revealBtn: {
    width: REVEAL_SLOT,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentField: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md2,
    borderRadius: radius.full,
    backgroundColor: colors.commentField,
    borderWidth: StyleSheet.hairlineWidth,
    // O contorno chega. A sombra que aqui estava — 8px de raio, 34% de preto,
    // deslocada 3px — descolava o campo da barra como se fosse um cartão a
    // flutuar, e o campo de resposta é a última coisa da Feed que deve chamar
    // atenção. Por baixo dele corre o gradiente da barra, que já o assenta.
    borderColor: feedLine.subtle,
  },
  commentFieldDisabled: { opacity: 0.54 },
  commentText: {
    flex: 1,
    ...feedType.primary,
    color: feedInk.muted,
  },
  btn: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    // O conteúdo continua centrado, só que num espaço encurtado em baixo — por
    // isso sobe metade deste valor. Fazê-lo assim, e não com `translateY`, deixa
    // a área de toque a acompanhar o desenho em vez de ficar para trás.
    paddingBottom: TAB_BAR_ICON_LIFT * 2,
    overflow: 'visible',
  },
  navIconMotion: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyph: {
    position: 'relative',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyphInk: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSelectionMark: {
    position: 'absolute',
    bottom: 0,
    width: 3,
    height: 3,
    borderRadius: radius.full,
  },

  badgeAnchor: {
    position: 'absolute',
    top: -7,
    right: -11,
    zIndex: 2,
  },
  badgeCounter: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    ...feedType.badge,
    color: '#fff',
    includeFontPadding: false,
  },
})
