import React, { memo, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brandPalette, colors, gradients, radius, spacing } from '../../theme'
import {
  actionInkRest, FEED_CONTENT_MAX_WIDTH, feedIcon, feedInk, feedType, pageInk,
} from '../../screens/FeedScreen/tokens'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useOverlayStore } from '../../store/overlay.store'
import { useT } from '../../i18n'
import AvatarImage from '../AvatarImage'
import FeedIcon, { type FeedIconName } from '../FeedIcon'
import Icon from '../Icon'
import type { IconName } from '../Icon/paths'
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

// Os separadores partilham a caixa de 26px. O desenho em 24×24 guarda
// a compensação óptica e o traço de 1.75 escala com a caixa.
type NavGlyphSpec =
  | { family: 'ui'; icon: IconName }
  | { family: 'feed'; icon: FeedIconName }

const NAV_ICON_SIZE = 26

/**
 * As três formas que uma célula da barra pode tomar.
 *
 * Uma barra de navegação bem desenhada não é cinco cópias do mesmo botão. São
 * três papéis diferentes, e cada um diz "estás aqui" da maneira que a sua forma
 * permite — é isso que a separa de um modelo comprado feito:
 *
 *   glifo     um desenho de traço. Muda de tinta e acende um ponto por baixo.
 *   disco     o Círculo, ao meio. É a única cor da barra e não precisa de mais
 *             nada: nada mais no ecrã é colorido, por isso já se vê sempre.
 *   retrato   a fotografia de quem está a usar a app. Acende um anel à volta —
 *             um ponto por baixo de um anel diria a mesma coisa duas vezes.
 *
 * As três medidas abaixo são o que mantém os três papéis à mesma escala óptica:
 * um traço de 26 tem cerca de 19 de tinta, e um disco cheio pesa muito mais por
 * ponto do que um contorno. Por isso o retrato é menor que o glifo, e o disco,
 * que é o único que se quer que salte, é maior que ambos.
 */
const NAV_DISC = 42
const NAV_DISC_GLYPH = 22
const NAV_AVATAR = 24
const NAV_AVATAR_RING = 1.5
const NAV_AVATAR_GAP = 2
/** A caixa da célula do meio; as outras ficam na de 38. */
const NAV_DISC_BOX = 44

const NAV_GLYPHS: Record<string, NavGlyphSpec> = {
  home:    { family: 'ui', icon: 'home' },
  search:  { family: 'ui', icon: 'search' },
  circle:  { family: 'ui', icon: 'circle-add' },
  message: { family: 'feed', icon: 'chat-outline' },
  profile: { family: 'ui', icon: 'user' },
}

type NavGlyph = keyof typeof NAV_GLYPHS

function NavIconArt({ glyph, size, color }: { glyph: NavGlyph; size: number; color: string }) {
  const metric = NAV_GLYPHS[glyph]
  return metric.family === 'feed'
    ? <FeedIcon name={metric.icon} size={size} color={color} />
    : <Icon name={metric.icon} size={size} color={color} />
}

const NavigationGlyph = memo(function NavigationGlyph({
  glyph,
  selected,
  activeColor,
  inactiveColor,
  reduceMotion,
}: {
  glyph: NavGlyph
  selected: boolean
  activeColor: string
  inactiveColor: string
  reduceMotion: boolean
}) {
  // O ponto nascia e morria entre dois frames — aparecia como um erro de
  // desenho em vez de uma resposta ao toque. Agora acompanha o dedo: sobe com a
  // mesma mola que o resto da barra usa, e some-se depressa quando o separador
  // deixa de ser o activo.
  const mark = useRef(new Animated.Value(selected ? 1 : 0)).current

  useEffect(() => {
    mark.stopAnimation()
    if (reduceMotion) { mark.setValue(selected ? 1 : 0); return }
    if (!selected) {
      Animated.timing(mark, { toValue: 0, duration: 120, useNativeDriver: true }).start()
      return
    }
    Animated.spring(mark, { toValue: 1, speed: 20, bounciness: 12, useNativeDriver: true }).start()
  }, [mark, reduceMotion, selected])

  return (
    <View style={s.navGlyph} pointerEvents="none">
      <View
        style={[
          s.navGlyphInk,
          { transform: [{ translateY: -1 }] },
        ]}
      >
        <NavIconArt glyph={glyph} size={NAV_ICON_SIZE} color={selected ? activeColor : inactiveColor} />
      </View>
      <Animated.View
        style={[
          s.navSelectionMark,
          {
            backgroundColor: activeColor,
            opacity: mark,
            transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          },
        ]}
      />
    </View>
  )
})

/**
 * O Círculo, ao meio, dentro do disco da marca.
 *
 * É o único sítio da app onde a assinatura cromática aparece cheia, e é
 * deliberado: a barra inteira é preta, branca e cinzenta, por isso um só objecto
 * colorido não compete com nada — puxa o olho para a única coisa da Luxey que
 * não existe em mais lado nenhum, e que precisa de outra pessoa para acontecer.
 *
 * Não leva marca de selecção. Já é o objecto mais visível da fila em qualquer
 * estado, e acrescentar-lhe um ponto seria dizer duas vezes o que a cor diz.
 * Para quem lê o ecrã com o leitor de voz nada se perde: o estado continua a ser
 * anunciado pelo botão que o embrulha.
 */
const NavigationDisc = memo(function NavigationDisc({ glyph }: { glyph: NavGlyph }) {
  return (
    // Duas caixas e não uma: no iOS um `overflow: hidden` recorta também a
    // sombra, e o disco perdia o halo. De fora fica quem a projecta, de dentro
    // quem recorta o gradiente.
    <View style={s.navDiscWell} pointerEvents="none">
      <View style={s.navDisc}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <NavIconArt glyph={glyph} size={NAV_DISC_GLYPH} color={colors.white} />
      </View>
    </View>
  )
})

/**
 * A última célula: quem está a usar a app.
 *
 * Com fotografia, é a fotografia — a barra deixa de ter um boneco genérico onde
 * devia estar uma pessoa, e o separador do perfil passa a ser reconhecido pelo
 * rosto e não pelo rótulo. Sem fotografia, volta o glifo: uma inicial dentro de
 * um disco cinzento ao lado de quatro desenhos de traço lia-se como um erro de
 * carregamento.
 *
 * O anel reserva sempre o seu lugar — desenha-se transparente quando o separador
 * não está activo — para o retrato não mudar de tamanho ao acender.
 *
 * Uma fotografia que não carrega conta como fotografia nenhuma. Um URL partido
 * (um upload que o servidor já não tem) deixava um anel vazio na barra; agora
 * volta o glifo. A falha fica presa ao URL que falhou, por isso uma foto nova
 * tenta outra vez.
 */
const NavigationPortrait = memo(function NavigationPortrait({
  uri,
  name,
  selected,
  activeColor,
  inactiveColor,
  reduceMotion,
}: {
  uri: string | null | undefined
  name: string | null | undefined
  selected: boolean
  activeColor: string
  inactiveColor: string
  reduceMotion: boolean
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null)

  if (!uri || failedUri === uri) {
    return (
      <NavigationGlyph
        glyph="profile"
        selected={selected}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
        reduceMotion={reduceMotion}
      />
    )
  }

  return (
    <View style={s.navGlyph} pointerEvents="none">
      <View style={[s.navPortrait, { borderColor: selected ? activeColor : colors.transparent }]}>
        <AvatarImage uri={uri} name={name} size={NAV_AVATAR} onError={() => setFailedUri(uri)} />
      </View>
    </View>
  )
})

/**
 * O fio entre a barra de papel e o que passa por baixo dela.
 *
 * Preto a 7%, e não um cinzento sólido: sobre branco lê-se como sombra de uma
 * borda, e não como linha desenhada.
 */
const NAV_EDGE = 'rgba(17,17,17,0.07)'

/** Largura que o compositor cede por cada atalho revelado. */
const REVEAL_SLOT = 46
// Mantém as caixas existentes dos atalhos do compositor.
const SZ_REVEAL_CIRCLE = 21.39
const SZ_REVEAL_PLUS = 24.86

function MotionTabButton({
  children, selected, onPress, label, valueText,
  pulseSignal = 0, reduceMotion, role = 'tab', box = 38,
}: {
  children: React.ReactNode
  selected: boolean
  onPress: () => void
  label: string
  valueText?: string
  pulseSignal?: number
  reduceMotion: boolean
  role?: 'tab' | 'button'
  /** Lado da caixa que se move ao toque. Só o disco do meio pede mais que 38. */
  box?: number
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
            width: box,
            height: box,
            borderRadius: box / 2,
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
  // A Feed imersiva — mídia a ocupar o ecrã, fundo escuro, campo de comentário
  // em baixo. Deixou de ser o separador `Feed`, que agora é a Home branca: tudo
  // o que esta constante governa (barra escura, campo de comentário, CTA da
  // pausa) pertence à imersiva e ficaria errado sobre uma página branca.
  const onFeed     = activeTab === 'Immersive'
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

  // A forma nunca muda de família. Selecção = contraste + marca mínima.
  //
  // O separador aceso esteve em violeta. Com o disco do Círculo a trazer a
  // assinatura cromática para o meio da fila, dois violetas na mesma barra
  // disputavam o olho e nenhum ganhava. O aceso passa a ser tinta — preta sobre
  // papel, branca sobre mídia — e a única cor da navegação é a do disco.
  //
  // O apagado é o mesmo cinzento dos comandos das duas feeds. Um só cinzento em
  // toda a app para tudo o que está lá sem pedir nada.
  const iconActive = clear ? feedInk.primary : pageInk.primary
  const iconInactv = clear ? 'rgba(255,255,255,0.68)' : actionInkRest.page

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

  // A imersiva abre-se a partir da Home, por isso o separador continua aceso lá
  // dentro — senão a barra fica sem nada seleccionado.
  const homeActive   = (activeTab === 'Feed' || activeTab === 'Immersive') && !openSearch && !searchVisible
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
  // Na imersiva a barra é sempre o campo — nunca navegação, nem no primeiro vídeo
  // aberto. Antes dependia de `immersive`, que só ligava depois de a pessoa
  // deslizar, e por isso o primeiro post abria com os separadores por baixo.
  // A saída dali é o `←` do cabeçalho, não a barra.
  //
  // A pausa do Círculo não passa por aqui: tem a sua própria face
  // (`showFeedInviteCta`) que substitui a barra inteira.
  const collapsed = onFeed
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
        reduceMotion={reduceMotion}
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
        reduceMotion={reduceMotion}
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
      <NavigationPortrait
        uri={currentUser?.avatar}
        name={currentUser?.name}
        selected={profActive}
        activeColor={iconActive}
        inactiveColor={iconInactv}
        reduceMotion={reduceMotion}
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
        reduceMotion={reduceMotion}
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
      box={NAV_DISC_BOX}
    >
      <NavigationDisc glyph="circle" />
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

  // O Círculo é a câmara, e a câmara ocupa o ecrã inteiro. A barra por cima
  // dela punha cinco destinos a disputar o momento com a fotografia; a saída
  // passa a ser o fechar no topo do próprio ecrã.
  if (onCircle) return null

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
            // O fio que separa a barra do conteúdo.
            //
            // Uma faixa branca sobre uma página branca não tem contorno nenhum:
            // a fotografia que acaba junto ao fundo do ecrã encostava à fila de
            // ícones sem nada entre as duas, e a barra deixava de se ler como um
            // objecto pousado por cima. Uma linha de meio pixel a 7% chega — mais
            // do que isso vira régua, e a régua é que faz uma app parecer um
            // modelo. Sobre fundo escuro não existe: lá o contraste já separa.
            borderTopWidth: showFeedInviteCta || clear ? 0 : StyleSheet.hairlineWidth,
            borderTopColor: NAV_EDGE,
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
                        <Icon name="plus" size={SZ_REVEAL_PLUS} color={iconActive} />
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
                        <Icon name="circle-add" size={SZ_REVEAL_CIRCLE} color={iconActive} />
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
    // Sem contorno e sem sombra: o campo é uma forma cheia e nada mais.
    //
    // Teve os dois. A sombra saiu primeiro — descolava o campo da barra como um
    // cartão a flutuar, e o campo de resposta é a última coisa da Feed que deve
    // chamar atenção. O contorno ficou a segurar sozinho, mas um fio branco a
    // 18% sobre um preenchimento quase preto não desenha uma borda: desenha uma
    // sujidade clara à volta dos cantos, que é exactamente o que se via.
    //
    // O preenchimento a 96% já se separa do gradiente da barra sem ajuda.
    backgroundColor: colors.commentField,
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
  /**
   * O halo por baixo do disco.
   *
   * Não é uma sombra de cartão — é a cor do próprio objecto a espalhar-se um
   * pouco por baixo dele, com o desfoque largo e a opacidade baixa. Sobre papel
   * branco é o que impede o disco de parecer um autocolante colado à faixa; a
   * cor sólida por trás existe para o Android ter o que elevar, e nunca chega a
   * ver-se porque o gradiente cobre-a por inteiro.
   */
  navDiscWell: {
    // O mesmo ponto acima do centro geométrico onde a tinta dos glifos assenta:
    // os cinco centros ficam numa linha só, e não quatro numa e um noutra.
    transform: [{ translateY: -1 }],
    width: NAV_DISC,
    height: NAV_DISC,
    borderRadius: NAV_DISC / 2,
    backgroundColor: brandPalette.violet,
    shadowColor: brandPalette.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 5,
  },
  // O disco recorta o gradiente; sem `overflow` ele pintava o quadrado inteiro
  // por baixo do raio, e o que se via era um quadrado colorido de cantos moles.
  navDisc: {
    width: NAV_DISC,
    height: NAV_DISC,
    borderRadius: NAV_DISC / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Caixa de borda: o anel come para dentro, por isso o vão entre ele e a
  // fotografia é exactamente `NAV_AVATAR_GAP` e não muda com o estado.
  navPortrait: {
    transform: [{ translateY: -1 }],
    width: NAV_AVATAR + (NAV_AVATAR_RING + NAV_AVATAR_GAP) * 2,
    height: NAV_AVATAR + (NAV_AVATAR_RING + NAV_AVATAR_GAP) * 2,
    borderRadius: radius.full,
    borderWidth: NAV_AVATAR_RING,
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
