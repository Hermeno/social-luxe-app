import React, { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FeedIcon, { feedIcons, type FeedIconName } from '../FeedIcon'
import { colors, fonts, leading, radius, spacing, typography } from '../../theme'
import { feedInk, feedLine } from '../../screens/FeedScreen/tokens'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useOverlayStore } from '../../store/overlay.store'
import { useT } from '../../i18n'
import AvatarImage from '../AvatarImage'
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

// ─── Calibração ótica dos ícones da navegação ───────────────────────────────
//
// Os cinco ícones vêm de três origens com grelhas diferentes (14, 24 e 256
// unidades), por isso o mesmo `size` NÃO dá o mesmo tamanho ao olho, nem o mesmo
// `strokeWidth` a mesma espessura. Igualam-se aqui as duas medidas que a vista lê
// de facto: a largura da tinta e a espessura do contorno.
//
// Num FeedIcon o pipeline entrega a tinta a 0.78 da caixa já com o traço de
// origem `n` lá dentro; trocá-lo por outro move a tinta:
//
//   tinta(size) = 0.78 × size + STROKE − n × size / S
//
// Num <Icon> (grelha 24, sem normalização) a tinta é a geometria mais o traço:
//
//   tinta(size) = g × size / 24 + STROKE
//
// Resolver cada uma para `tinta = INK` dá o `size` de cada ícone. Saem valores
// diferentes de propósito — é isso que os faz parecer iguais.
// 22 px é a tinta que o Instagram pratica (caixa 24, desenho a encher ~22) e é
// também o que a coluna de acções do post já dá a `size={28}`. Alinhar a
// navegação aqui é o que faz os dois conjuntos da feed lerem-se como um só.
// Nota: o 24 do Instagram é a CAIXA, não a tinta — não se compara com `size`.
const INK = 22
const STROKE = 2                      // px — o traço do Instagram, e o desta feed

/** Lado da caixa reenquadrada de um FeedIcon, em unidades do próprio desenho. */
const boxOf = (name: FeedIconName) =>
  Number(feedIcons[name].viewBox.trim().split(/\s+/)[2])

/**
 * `size` de um FeedIcon de contorno para a tinta bater nos INK px. `native` é a
 * espessura que o desenho já traz, em unidades da caixa: o traço declarado, ou a
 * largura da faixa quando o contorno vem cozido no preenchimento.
 */
const feedSize = (name: FeedIconName, native: number) =>
  +((INK - STROKE) / (0.78 - native / boxOf(name))).toFixed(2)

/** Reforço que falta a uma forma preenchida para o contorno chegar a STROKE px. */
const feedBoost = (name: FeedIconName, native: number, size: number) =>
  +(STROKE - (native * size) / boxOf(name)).toFixed(3)

/** `size` de um <Icon> da grelha 24 para a tinta bater nos INK px. */
const iconSize = (geometry: number) => +(((INK - STROKE) * 24) / geometry).toFixed(2)

// Os estados activos são formas cheias, sem traço nenhum a somar: aí a tinta é
// exactamente 0.78 × size, logo o size sai directamente da tinta pretendida.
const SZ_SOLID = +(INK / 0.78).toFixed(2)
// play e search trazem traço declarado — 1 (o default do SVG) e 1.5.
const SZ_PLAY = feedSize('play-list-4', 1)
const SZ_SEARCH = feedSize('search', 1.5)
// O teardrop do chat não tem traço: a faixa de 12 unidades já vem pintada, por
// isso engrossa-se a forma até à mesma espessura dos outros.
const SZ_CHAT = feedSize('chat-teardrop-light', 12)
const CHAT_BOOST = feedBoost('chat-teardrop-light', 12, SZ_CHAT)
// circle-add → rect da linha média de 3 a 21 ⇒ 18 de lado, centrado em 12,12.
// Vectorizado a partir do PNG: o desenho à mão vinha 842×876 com um "círculo"
// de 488×515; aqui foi normalizado a quadrado e a círculo, mantendo os rácios
// de origem (diâmetro/lado e raio do canto) com 0.1% e 0.5% de desvio.
const SZ_CIRCLE_ADD = iconSize(18)
// user → circle cy8 r4 (topo y=4) + corpo até y=20.75 ⇒ 16.75 de altura
const SZ_USER = iconSize(16.75)
// O user é 0.375 mais baixo que alto no centro da grelha; sem esta compensação
// fica meio pixel abaixo da linha dos outros quatro.
const USER_NUDGE = -(0.375 * SZ_USER) / 24
// O avatar é uma forma cheia: o diâmetro alinha com a largura da tinta.
const SZ_AVATAR = Math.round(INK)

/** Largura que o compositor cede por cada atalho revelado. */
const REVEAL_SLOT = 46
/**
 * Os atalhos revelados são secundários — vivem ao lado do campo, não na fila
 * dos separadores — por isso levam um degrau de tinta abaixo dos 22 da barra.
 * A calibração é a mesma: só muda o alvo.
 */
const REVEAL_INK = 18
const revealSize = (geometry: number) => +(((REVEAL_INK - STROKE) * 24) / geometry).toFixed(2)
const SZ_REVEAL_CIRCLE = revealSize(18)    // circle-add ⇒ 18 de lado
const SZ_REVEAL_PLUS = revealSize(15.5)    // plus ⇒ 15.5 de lado

function NavIconSwap({
  selected, reduceMotion, inactive, active,
}: {
  selected: boolean
  reduceMotion: boolean
  inactive: React.ReactNode
  active: React.ReactNode
}) {
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current

  useEffect(() => {
    progress.stopAnimation()
    if (reduceMotion) {
      progress.setValue(selected ? 1 : 0)
      return
    }
    Animated.timing(progress, {
      toValue: selected ? 1 : 0,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [progress, reduceMotion, selected])

  return (
    <View style={s.navGlyphSwap} pointerEvents="none">
      <Animated.View
        style={[
          s.navGlyphLayer,
          {
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
          },
        ]}
      >
        {inactive}
      </Animated.View>
      <Animated.View
        style={[
          s.navGlyphLayer,
          {
            opacity: progress,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          },
        ]}
      >
        {active}
      </Animated.View>
    </View>
  )
}

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
  const requestComments = useFeedStore((s) => s.requestComments)
  const clearFocusedPost = useFeedStore((s) => s.clearFocusedPost)
  const currentUser   = useAuthStore((s) => s.user)
  const avatar        = currentUser?.avatar ?? null
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
  // A cápsula é branca em todos os ecrãs, feed incluída, por isso a tinta é
  // sempre escura — não há mais o par claro/escuro que dependia do fundo.
  // Preto nos dois estados. Quem distingue o separador activo é a forma — o
  // desenho passa de contorno a cheio — e não um cinzento a meio caminho, que
  // sobre papel branco lê-se como um ícone desligado em vez de disponível.
  // ── Pele da barra ─────────────────────────────────────────────────────────
  //
  // `clear` só se aplica onde há fundo escuro por baixo. A Feed e o Círculo têm
  // (#0B141A e preto); Pesquisa, Chat, Criar e Perfil são papel branco, e ali
  // uma faixa transparente com tinta branca dava ícones invisíveis sobre branco.
  // Nesses ecrãs a barra fica de papel, seja qual for a pele da sessão.
  const skin = useNavSkin()
  const darkCanvas = onFeed || onCircle
  const clear = skin === 'clear' && darkCanvas

  // Com a faixa transparente a tinta é branca nos dois estados — quem distingue
  // o separador activo continua a ser a forma, não a cor.
  const iconActive = clear ? '#FFFFFF' : colors.black
  const iconInactv = clear ? '#FFFFFF' : colors.black

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
  const collapsed = onFeed && immersive
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

  // O play herda o papel da Home: leva à Feed, guarda o contador de novos posts
  // e responde ao duplo toque com o mesmo pulso. Só o desenho mudou.
  const playTab = (
    <MotionTabButton
      key="play"
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
      <NavIconSwap
        selected={homeActive}
        reduceMotion={reduceMotion}
        inactive={(
          <FeedIcon name="play-list-4" size={SZ_PLAY} color={iconInactv} strokePx={STROKE} />
        )}
        active={(
          <FeedIcon name="play-list-4-solid" size={SZ_SOLID} color={iconActive} />
        )}
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
      <NavIconSwap
        selected={msgActive}
        reduceMotion={reduceMotion}
        inactive={(
          <FeedIcon name="chat-teardrop-light" size={SZ_CHAT} color={iconInactv} boostPx={CHAT_BOOST} />
        )}
        active={(
          <FeedIcon name="chat-teardrop-fill" size={SZ_SOLID} color={iconActive} />
        )}
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
      {avatar ? (
        <View style={[s.avatar, !profActive && s.avatarInactive]}>
          <AvatarImage uri={avatar} name={currentUser?.name} size={SZ_AVATAR} />
        </View>
      ) : (
        <View style={{ transform: [{ translateY: USER_NUDGE }] }}>
          <NavIconSwap
            selected={profActive}
            reduceMotion={reduceMotion}
            inactive={(
              <Icon name="user" size={SZ_USER} strokeWidth={STROKE} absoluteStrokeWidth color={iconInactv} />
            )}
            active={(
              <Icon name="user" size={SZ_USER} strokeWidth={STROKE} absoluteStrokeWidth color={iconActive} fill={iconActive} />
            )}
          />
        </View>
      )}
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
      <FeedIcon
        name="search"
        size={SZ_SEARCH}
        color={onSearch ? iconActive : iconInactv}
        strokePx={STROKE}
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
      <Icon
        name="circle-add"
        size={SZ_CIRCLE_ADD}
        strokeWidth={STROKE}
        absoluteStrokeWidth
        color={onCircle ? iconActive : iconInactv}
      />
    </MotionTabButton>
  )

  // Os mesmos cinco separadores, na mesma ordem, em todos os ecrãs. Uma barra
  // que muda de conteúdo conforme a página obriga a reaprendê-la a cada
  // navegação — e era o que acontecia: a Feed mostrava cinco, o resto três.
  const primaryTabs = (
    <>
      {playTab}
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
            backgroundColor: clear ? 'transparent' : '#FFFFFF',
          },
        ]}
      >
        {onFeed ? (
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
    color: feedInk.muted,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    lineHeight: leading.body,
    letterSpacing: -0.24,
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
  navGlyphSwap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyphLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    color: '#fff',
    fontSize: typography.badge,
    fontFamily: fonts.bold,
    lineHeight: 12,
    includeFontPadding: false,
    letterSpacing: -0.1,
  },

  avatar: {
    width: SZ_AVATAR,
    height: SZ_AVATAR,
    borderRadius: SZ_AVATAR / 2,
    overflow: 'hidden',
  },
  avatarInactive: { opacity: 0.58 },
})
