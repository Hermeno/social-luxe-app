import React, { memo, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing } from '../../theme'
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
import useNavSkin from './useNavSkin'

// Os separadores partilham a caixa de 26px. O desenho em 24×24 guarda
// a compensação óptica e o traço de 1.75 escala com a caixa.
type NavGlyphSpec =
  | { family: 'ui'; icon: IconName }
  | { family: 'feed'; icon: FeedIconName }

const NAV_ICON_SIZE = 26

/**
 * As duas formas que uma célula da barra pode tomar.
 *
 *   glifo     um desenho de traço. Muda de tinta e acende um ponto por baixo.
 *   retrato   a fotografia de quem está a usar a app. Acende um anel à volta —
 *             um ponto por baixo de um anel diria a mesma coisa duas vezes.
 *
 * O Círculo esteve aqui como um terceiro papel: um disco de 42 com o gradiente
 * da marca, o único objecto colorido da barra. Saiu a pedido. A fila passa a ser
 * uma só família de traços, e o Círculo distingue-se pelo desenho do próprio
 * glifo — um círculo com um `+` — e não pela cor.
 *
 * As medidas abaixo são o que mantém os dois papéis à mesma escala óptica: um
 * traço de 26 tem cerca de 19 de tinta, e uma fotografia cheia pesa mais por
 * ponto do que um contorno. Por isso o retrato é menor que o glifo.
 */
/** A caixa que se move ao toque, igual em todas as células. */
const NAV_TOUCH_BOX = 38

const NAV_AVATAR = 24
const NAV_AVATAR_RING = 1.5
const NAV_AVATAR_GAP = 2

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
            width: NAV_TOUCH_BOX,
            height: NAV_TOUCH_BOX,
            borderRadius: NAV_TOUCH_BOX / 2,
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
  const feedInviteActive = useFeedStore((s) => s.feedInviteActive)
  const requestComments = useFeedStore((s) => s.requestComments)
  const clearFocusedPost = useFeedStore((s) => s.clearFocusedPost)
  const currentUser   = useAuthStore((s) => s.user)
  const barVisibility = useRef(new Animated.Value(1)).current

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

  // Na imersiva a barra mantém apenas o campo. A pausa do Círculo continua a
  // usar a sua própria chamada para ação, sem alterar os outros separadores.

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
    >
      <NavigationGlyph
        glyph="circle"
        selected={onCircle}
        activeColor={iconActive}
        inactiveColor={iconInactv}
        reduceMotion={reduceMotion}
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
            paddingTop: onFeed ? 0 : TAB_BAR_TOP_GAP,
            paddingBottom: tabBarBottomInset(bottom),
            // Faixa de margem a margem. O `paddingBottom` da safe area entra
            // dentro dela, por isso a altura toda — do topo da linha até ao
            // fundo do ecrã — toma a cor da pele.
            // Na imersiva a faixa inteira é o campo de comentar, safe area
            // incluída: a cor vem do token e de mais nenhum sítio.
            backgroundColor: onFeed && !showFeedInviteCta
              ? colors.commentField
              : showFeedInviteCta || clear ? 'transparent' : '#FFFFFF',
            // O fio que separa a barra do conteúdo.
            //
            // Uma faixa branca sobre uma página branca não tem contorno nenhum:
            // a fotografia que acaba junto ao fundo do ecrã encostava à fila de
            // ícones sem nada entre as duas, e a barra deixava de se ler como um
            // objecto pousado por cima. Uma linha de meio pixel a 7% chega — mais
            // do que isso vira régua, e a régua é que faz uma app parecer um
            // modelo. Sobre fundo escuro não existe: lá o contraste já separa.
            borderTopWidth: onFeed || showFeedInviteCta || clear ? 0 : StyleSheet.hairlineWidth,
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
            <TouchableOpacity
              style={s.commentField}
              onPress={() => commentTarget && requestComments(commentTarget.postId)}
              activeOpacity={0.86}
              disabled={!commentTarget}
              accessibilityRole="button"
              accessibilityLabel={commentLabel}
              accessibilityState={{ disabled: !commentTarget }}
            >
              <Text style={s.commentText} numberOfLines={1}>{commentLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.navShell, !clear && s.navShellPaper]}>{primaryTabs}</View>
        )}
      </Animated.View>
    </Animated.View>
  )
}

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
  // A única fila da imersiva preenche a faixa branca até às bordas do ecrã.
  feedStage: {
    flex: 1,
    height: FEED_COMPOSER_HEIGHT,
    alignItems: 'stretch',
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
  // O campo não pinta nada: a cor é da faixa que o embrulha, e assim a safe
  // area por baixo dele nunca fica de outra cor. Aqui vive só o alvo do toque.
  commentField: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  commentText: {
    ...feedType.primary,
    color: colors.gray600,
    alignSelf: 'stretch',
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
