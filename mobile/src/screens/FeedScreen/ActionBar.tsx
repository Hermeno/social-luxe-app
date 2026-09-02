import React, { useState, useEffect, useRef } from 'react'
import {
  View, Pressable, StyleSheet, Share, Modal, Animated, Easing, TouchableOpacity
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import PostActionIcon from '../../components/PostActionIcon'
import { ACTION_INK, feedIcon, feedInk, feedRail, feedTextShadow, feedType } from './tokens'

import { Post, type RepostResult } from '../../types'
import { colors } from '../../theme'
import * as postService from '../../services/post.service'
import { updateCachedPost, queueLike, enqueueSyncOp } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import ReactionPicker from '../../components/ReactionPicker'
import SharePostSheet from '../../components/SharePostSheet'
import { useT } from '../../i18n'
import AuthorPostsModal from './AuthorPostsModal'
import PostOptionsMenu from './PostOptionsMenu'

interface Props {
  post: Post
  onCommentPress: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
  onRepostChange?: (result: RepostResult) => void
  commentCount?: number
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onProfileBlocked?: (userId: string) => void
  onAuthorMuted?: (userId: string) => void
  onOptionsBlockingChange?: (open: boolean) => void
  isActive?: boolean
  reduceMotion?: boolean
  /** Tamanho dos glifos; por defeito é o mesmo usado na Home. */
  iconSize?: number
  /**
   * Post do Círculo. A coluna encolhe: fica o gosto, o comentário e o menu.
   *
   * Vem de fora e não é recalculado aqui de propósito. Quem decide o que é um
   * momento colectivo é o `FeedItem` — é ele que troca a mídia pelo carrossel — e
   * duas contas do mesmo em ficheiros diferentes acabam sempre por discordar.
   */
  isCircle?: boolean
  /** Distância ao fundo da coluna de ações. Sobrepõe o valor por defeito para
   *  a coluna assentar sobre o vídeo (que não vai até ao fundo do ecrã). */
  bottomOffset?: number
}

/**
 * Um só tamanho para a rail toda.
 *
 * Os desenhos vêm de famílias diferentes, mas o build já reenquadra cada caixa para
 * a tinta ocupar a mesma fração (ver scripts/build-feed-icons.mjs). Por isso o mesmo
 * número dá o mesmo tamanho aparente — não voltar a compensar ícone a ícone.
 */
const DEFAULT_RAIL_ICON_SIZE = feedIcon.action

type HeartP = {
  id:  number
  tx:  Animated.Value
  ty:  Animated.Value
  s:   Animated.Value
  o:   Animated.Value
}

/**
 * O contador de uma acção — ou nada, quando ainda não há nada para contar.
 *
 * Um "0" por baixo de cada ícone não informa: diz que a contagem existe e está
 * vazia, o que o próprio ícone apagado já dizia. Quatro zeros em coluna num post
 * acabado de publicar leem-se como um formulário por preencher. Devolvendo
 * `undefined`, a `RailAction` não desenha texto nenhum — e o `metricSlot`
 * mantém a altura, para os ícones não saltarem quando o primeiro número chega.
 */
function fmt(n: number): string | undefined {
  if (n <= 0)         return undefined
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface RailActionProps {
  label: string
  count?: string
  selected?: boolean
  onPress: () => void
  onLongPress?: () => void
  children: React.ReactNode
  entry: Animated.Value
  order: number
  reduceMotion: boolean
  /** Desliga o encolher do toque. Só o gosto o usa — ver `burstHearts`. */
  noPressScale?: boolean
}

function RailAction({
  label, count, selected, onPress, onLongPress, children,
  entry, order, reduceMotion, noPressScale
}: RailActionProps) {
  const scale = useRef(new Animated.Value(1)).current
  const metricY = useRef(new Animated.Value(0)).current
  const metricOpacity = useRef(new Animated.Value(1)).current
  const previousCount = useRef(count)

  useEffect(() => {
    if (previousCount.current === count) return
    previousCount.current = count
    if (reduceMotion) return
    metricY.setValue(8)
    metricOpacity.setValue(0)
    Animated.parallel([
      Animated.spring(metricY, { toValue: 0, speed: 28, bounciness: 5, useNativeDriver: true }),
      Animated.timing(metricOpacity, { toValue: 1, duration: 170, useNativeDriver: true }),
    ]).start()
  }, [count, metricOpacity, metricY, reduceMotion])

  // Só a escala responde ao toque. O disco claro que aqui estava por trás do
  // ícone dava-lhe um fundo que ele não tem em repouso: aparecia uma forma nova
  // no ecrã em vez de o ícone reagir. Encolher já diz que foi tocado.
  function pressIn() {
    if (reduceMotion || noPressScale) return
    Animated.spring(scale, {
      toValue: 0.88,
      speed: 45,
      bounciness: 4,
      useNativeDriver: true,
    }).start()
  }

  function pressOut() {
    if (reduceMotion || noPressScale) return
    Animated.spring(scale, {
      toValue: 1,
      speed: 22,
      bounciness: 10,
      useNativeDriver: true,
    }).start()
  }

  const start = order * 0.1
  const end = Math.min(1, start + 0.42)

  return (
    <Animated.View
      style={[
        s.actionSlot,
        !reduceMotion && {
          opacity: entry.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ translateX: entry.interpolate({ inputRange: [start, end], outputRange: [16, 0], extrapolate: 'clamp' }) }]
        },
      ]}
    >
      <Pressable
        style={s.actionHit}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={count !== undefined ? { text: count } : undefined}
        accessibilityState={selected !== undefined ? { selected } : undefined}
      >
        <Animated.View style={[s.actionVisual, { transform: [{ scale }] }]}>
          <View style={s.iconStage}>
            {children}
          </View>
          <View style={s.metricSlot}>
            {count !== undefined && (
              <Animated.Text
                style={[s.railN, { opacity: metricOpacity, transform: [{ translateY: metricY }] }]}
                maxFontSizeMultiplier={1.3}
              >
                {count}
              </Animated.Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

export default React.memo(function ActionBar({
  post, onCommentPress, liked: likedProp = false,
  onLikeChange, onRepostChange, commentCount: commentCountProp, bottomOffset,
  onDeleted, onEdited, onProfileBlocked, onAuthorMuted, onOptionsBlockingChange,
  isActive = true, isCircle = false, reduceMotion = false,
  iconSize = DEFAULT_RAIL_ICON_SIZE,
}: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const t          = useT()

  const [liked,      setLiked]      = useState(likedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [reposted,   setReposted]   = useState(post.userReposted ?? false)
  const [repostCount, setRepostCount] = useState(post._count?.reposts ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAuthorPosts, setShowAuthorPosts] = useState(false)
  const [optionsBlocking, setOptionsBlocking] = useState(false)
  const [hearts,    setHearts]    = useState<HeartP[]>([])
  const heartIdRef = useRef(0)
  const railEntry = useRef(new Animated.Value(isActive ? 1 : 0)).current
  const repostSpin = useRef(new Animated.Value(0)).current
  // O "1" desenhado sobre o glifo é o MEU +1 nesta publicação — segue
  // `userRepostedVia`, não `userReposted`. Numa cópia que eu não tenha tocado o
  // botão fica activo (já repostei o conteúdo) mas sem o "1", senão contradizia
  // o contador dela.
  const repostOneOpacity = useRef(new Animated.Value(post.userRepostedVia ? 1 : 0)).current
  const repostOneScale = useRef(new Animated.Value(post.userRepostedVia ? 1 : 0.72)).current
  const repostPendingRef = useRef(false)
  const localRepostStateRef = useRef<boolean | null>(null)
  const blockingChangeRef = useRef(onOptionsBlockingChange)
  blockingChangeRef.current = onOptionsBlockingChange

  // As duas folhas pertencem ao mesmo post e pausam a mídia através de uma
  // única ponte. Uma não pode declarar "fechado" enquanto a outra está aberta.
  const overlayBlocking = optionsBlocking || showAuthorPosts
  useEffect(() => {
    blockingChangeRef.current?.(overlayBlocking)
  }, [overlayBlocking])

  useEffect(() => () => {
    blockingChangeRef.current?.(false)
  }, [])

  useEffect(() => {
    railEntry.stopAnimation()
    if (reduceMotion) {
      railEntry.setValue(isActive ? 1 : 0)
      return
    }
    if (!isActive) {
      railEntry.setValue(0)
      return
    }
    railEntry.setValue(0)
    Animated.sequence([
      Animated.delay(110),
      Animated.spring(railEntry, { toValue: 1, speed: 18, bounciness: 5, useNativeDriver: true }),
    ]).start()
  }, [isActive, railEntry, reduceMotion])

  // O coração encolhia para 0.84, saltava para 1.2 e voltava, e só no meio disso
  // é que trocava de desenho — dava a ler como se o ícone se tivesse assustado
  // antes de mudar de cor. Quem confirma o gosto é o rebentamento: dez corações
  // a sair do sítio onde o dedo tocou. O ícone só muda de estado, sem encenar.

  function burstHearts() {
    if (reduceMotion) return
    const newHearts: HeartP[] = []
    for (let i = 0; i < 10; i++) {
      const tx = new Animated.Value(0)
      const ty = new Animated.Value(0)
      const s  = new Animated.Value(0)
      const o  = new Animated.Value(1)
      const id = ++heartIdRef.current

      const angle  = Math.random() * Math.PI * 2
      const dist   = 28 + Math.random() * 54
      const finalX = Math.cos(angle) * dist
      const finalY = Math.sin(angle) * dist
      const finalS = 0.5 + Math.random() * 0.9
      const dur    = 550 + Math.random() * 220

      Animated.parallel([
        Animated.sequence([
          Animated.spring(s, { toValue: finalS, speed: 55, bounciness: 16, useNativeDriver: true }),
          Animated.timing(s, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]),
        Animated.timing(tx, { toValue: finalX, duration: dur, useNativeDriver: true }),
        Animated.timing(ty, { toValue: finalY, duration: dur, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(180 + i * 18),
          Animated.timing(o, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      ]).start(() => {
        setHearts((prev) => prev.filter((h) => h.id !== id))
      })

      newHearts.push({ id, tx, ty, s, o })
    }
    setHearts((prev) => [...prev, ...newHearts])
  }

  useEffect(() => {
    setLiked(likedProp)
    setLikeCount(post._count?.likes ?? 0)
    setReposted(post.userReposted ?? false)
    setRepostCount(post._count?.reposts ?? 0)
    setShareCount(post._count?.shares ?? 0)
    repostSpin.setValue(0)
    repostOneOpacity.setValue(post.userRepostedVia ? 1 : 0)
    repostOneScale.setValue(post.userRepostedVia ? 1 : 0.72)
    repostPendingRef.current = false
    localRepostStateRef.current = null
    setShowReactions(false)
    setShowAuthorPosts(false)
    setOptionsBlocking(false)
  }, [post.id])

  // Outras células do mesmo original recebem o resultado canónico pelo estado
  // da feed. Mantém esta cópia local alinhada sem repetir a animação.
  useEffect(() => {
    if (repostPendingRef.current) return
    const next = post.userReposted ?? false
    const nextVia = post.userRepostedVia ?? false
    if (localRepostStateRef.current === next) {
      // Foi este botão que originou a atualização: a animação em curso é dona
      // do aparecimento do "1" e não deve ser saltada por este efeito.
      localRepostStateRef.current = null
      setRepostCount(post._count?.reposts ?? 0)
      return
    }
    localRepostStateRef.current = null
    setReposted(next)
    setRepostCount(post._count?.reposts ?? 0)
    repostOneOpacity.setValue(nextVia ? 1 : 0)
    repostOneScale.setValue(nextVia ? 1 : 0.72)
  }, [post.userReposted, post.userRepostedVia, post._count?.reposts])

  // O duplo toque vive no FeedItem; quando ele altera o estado partilhado,
  // esta rail recebe a mudança e completa o mesmo feedback magnético.
  useEffect(() => {
    if (likedProp === liked) return
    setLiked(likedProp)
    if (likedProp) {
      burstHearts()
    }
  }, [likedProp])

  async function handleLike() {
    const was = liked; const prev = likeCount
    const optimisticCount = was ? prev - 1 : prev + 1
    setLiked(!was); setLikeCount(optimisticCount); onLikeChange?.(!was)
    if (!was) burstHearts()
    updateCachedPost(post.id, { _count: { ...post._count, likes: optimisticCount } }).catch(() => {})

    // Sem rede o gosto fica na fila e o estado otimista mantém-se. Desfazer o
    // coração à frente da pessoa por não haver rede é perder a intenção dela.
    if (!isConnected()) {
      queueLike(post.id, !was).catch(() => {})
      return
    }

    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked); onLikeChange?.(res.liked)
      const confirmedCount = res.liked !== !was ? prev + (res.liked ? 1 : -1) : optimisticCount
      setLikeCount(confirmedCount)
      updateCachedPost(post.id, { _count: { ...post._count, likes: confirmedCount } }).catch(() => {})
    } catch {
      // Falhou a meio: guarda a intenção em vez de a deitar fora. A fila
      // reconcilia com o servidor e descarta sozinha se for erro de cliente.
      queueLike(post.id, !was).catch(() => {})
    }
  }

  // Toque: a folha de dentro, com quem segues. Toque longo: a folha do sistema,
  // para o mundo lá fora. As duas contam a mesma partilha.
  function handleShare() {
    setShowShare(true)
  }

  function countShare() {
    postService.sharePost(post.id).then(() => setShareCount((c) => c + 1)).catch(() => {})
  }

  async function handleShareExternal() {
    try {
      const result = await Share.share({
        message: `${post.caption ? `"${post.caption}" — ` : ''}${t.feed_share_msg}`,
      })
      if (result.action === Share.sharedAction) countShare()
    } catch {}
  }

  function animateRepost(next: boolean) {
    repostSpin.stopAnimation()
    repostOneOpacity.stopAnimation()
    repostOneScale.stopAnimation()

    if (reduceMotion) {
      repostSpin.setValue(0)
      repostOneOpacity.setValue(next ? 1 : 0)
      repostOneScale.setValue(next ? 1 : 0.72)
      return
    }

    repostSpin.setValue(0)
    Animated.sequence([
      Animated.timing(repostSpin, {
        toValue: 1,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(repostOneOpacity, {
          toValue: next ? 1 : 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(repostOneScale, {
          toValue: next ? 1 : 0.72,
          speed: 28,
          bounciness: next ? 8 : 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }

  function setRepostVisualImmediately(next: boolean) {
    repostSpin.stopAnimation()
    repostOneOpacity.stopAnimation()
    repostOneScale.stopAnimation()
    repostSpin.setValue(0)
    repostOneOpacity.setValue(next ? 1 : 0)
    repostOneScale.setValue(next ? 1 : 0.72)
  }

  async function handleRepost() {
    if (repostPendingRef.current) return

    const was = reposted
    const previousCount = repostCount
    const next = !was
    // Toda a publicação tem contador próprio: o +1 é sempre desta.
    const optimisticCount = Math.max(0, previousCount + (next ? 1 : -1))
    // `postId` é o conteúdo (o original), `viaPostId` é onde se tocou.
    const originalPostId = post.repostOfId ?? post.id

    repostPendingRef.current = true
    localRepostStateRef.current = next
    setReposted(next)
    setRepostCount(optimisticCount)
    animateRepost(next)

    if (!isConnected()) {
      await enqueueSyncOp('repost', post.id, 'update', { reposted: next }).catch(() => {})
      onRepostChange?.({
        postId: originalPostId,
        viaPostId: post.id,
        viaCount: optimisticCount,
        reposted: next,
        repostedPost: null,
        removedPostId: next ? null : (post.userRepostId ?? null),
      })
      repostPendingRef.current = false
      return
    }

    try {
      const result = await postService.setRepost(post.id, next)
      setReposted(result.reposted)
      // O contador só se move se o +1 tiver caído nesta publicação. Já ter
      // repostado o conteúdo noutra célula devolve o `viaPostId` dessa — aqui
      // nada muda, e o "1" também não nasce.
      const isVia = result.viaPostId === post.id
      setRepostCount(isVia ? (result.viaCount ?? previousCount) : previousCount)
      if (result.reposted !== next || !isVia) {
        localRepostStateRef.current = null
        setRepostVisualImmediately(result.reposted && isVia)
      }
      // O resultado canónico segue já. A cópia deixou de ser inserida na feed
      // que está a ser lida, por isso não há inserção nenhuma por que esperar:
      // esperar meio segundo aqui só atrasava o contador a chegar às outras
      // células do mesmo conteúdo.
      onRepostChange?.(result)
    } catch (error: any) {
      const status: number | undefined = error?.response?.status
      if (!status || status >= 500) {
        await enqueueSyncOp('repost', post.id, 'update', { reposted: next }).catch(() => {})
        onRepostChange?.({
          postId: originalPostId,
          viaPostId: post.id,
          viaCount: optimisticCount,
          reposted: next,
          repostedPost: null,
          removedPostId: next ? null : (post.userRepostId ?? null),
        })
      } else {
        localRepostStateRef.current = null
        setReposted(was)
        setRepostCount(previousCount)
        setRepostVisualImmediately(was)
      }
    } finally {
      repostPendingRef.current = false
    }
  }

  const isAnnouncement = post.isAnnouncement ?? false

  return (
    <>
      {/* Mesma linguagem do topo: ícones livres, traço leve e microinteração. */}
      <Animated.View style={[s.rail, { bottom: bottomOffset ?? safeBottom + 96 }]} pointerEvents="box-none">
        {!isAnnouncement && (
          <>
            {/* Like */}
            <RailAction
              label={t.nf_likes}
              count={fmt(likeCount)}
              selected={liked}
              onPress={handleLike}
              onLongPress={() => setShowReactions(true)}
              entry={railEntry}
              order={0}
              reduceMotion={reduceMotion}
              noPressScale
            >
              {/* Gostado troca de desenho, não apenas de pintura. O contorno recebe
                  o peso da feed; o coração sólido fica regular para não saltar de tamanho. */}
              <PostActionIcon
                name="like"
                size={iconSize}
                color={liked ? colors.heart : ACTION_INK}
                selected={liked}
              />
              {hearts.map((h) => (
                <Animated.View
                  key={h.id}
                  pointerEvents="none"
                  accessible={false}
                  style={[s.burstHeart, { opacity: h.o, transform: [{ translateX: h.tx }, { translateY: h.ty }, { scale: h.s }] }]}
                >
                  <PostActionIcon name="like" size={feedIcon.inline} color={colors.heart} selected />
                </Animated.View>
              ))}
            </RailAction>

            {/* Comentar */}
            <RailAction
              label={t.nf_comments}
              count={fmt(commentCountProp ?? post._count?.comments ?? 0)}
              onPress={onCommentPress}
              entry={railEntry}
              order={1}
              reduceMotion={reduceMotion}
            >
              {/* Já nasce com a cauda à direita — dispensa o espelho que aqui estava. */}
              <PostActionIcon name="comment" size={iconSize} color={ACTION_INK} />
            </RailAction>

            {/* Repost e partilha não valem num post do Círculo: o que lá está
                pertence às pessoas que o fizeram juntas, e reencaminhá-lo tira-o
                do sítio onde essa combinação faz sentido. */}
            {!isCircle && (
            <>
            {/* Repost: o glifo completa uma volta; só depois nasce o "1".
                O número vive fora da camada rodada para permanecer direito. */}
            <RailAction
              label={t.feed_repost}
              count={fmt(repostCount)}
              selected={reposted}
              onPress={handleRepost}
              entry={railEntry}
              order={2}
              reduceMotion={reduceMotion}
            >
              <View style={{ width: iconSize, height: iconSize }}>
                <Animated.View
                  style={{
                    transform: [{
                      rotate: repostSpin.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    }],
                  }}
                >
                  <PostActionIcon
                    name="repost"
                    size={iconSize}
                    color={reposted ? colors.accent : ACTION_INK}
                  />
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.repostOneWrap,
                    {
                      opacity: repostOneOpacity,
                      transform: [{ scale: repostOneScale }],
                    },
                  ]}
                >
                  <Animated.Text style={s.repostOne}>1</Animated.Text>
                </Animated.View>
              </View>
            </RailAction>

            {/* Partilhar */}
            <RailAction label={t.mo_share} count={fmt(shareCount)} onPress={handleShare} onLongPress={handleShareExternal} entry={railEntry} order={3} reduceMotion={reduceMotion}>
              <PostActionIcon name="share" size={iconSize} color={ACTION_INK} />
            </RailAction>
            </>
            )}
          </>
        )}

        {/* As utilidades não têm contador, mas reservam a mesma caixa vazia.
            Assim menu, autor e acções mantêm exactamente a mesma cadência. */}
        <Animated.View
          style={[
            s.utilityCluster,
            !reduceMotion && {
              opacity: railEntry.interpolate({
                inputRange: [0.3, 0.72],
                outputRange: [0, 1],
                extrapolate: 'clamp'
              }),
              transform: [{
                translateX: railEntry.interpolate({
                  inputRange: [0.3, 0.72],
                  outputRange: [16, 0],
                  extrapolate: 'clamp'
                })
              }]
            },
          ]}
        >
          <PostOptionsMenu
            post={post}
            onDeleted={onDeleted}
            onEdited={onEdited}
            onProfileBlocked={onProfileBlocked}
            onAuthorMuted={onAuthorMuted}
            onBlockingChange={setOptionsBlocking}
            rail
            triggerSize={iconSize}
            triggerColor={ACTION_INK}
          />
          {/* Também sai: um momento colectivo não é a obra de um autor, e o
              atalho para "as publicações desta pessoa" pergunta a coisa errada
              sobre uma fotografia que várias pessoas tiraram juntas. */}
          {!isCircle && (
          <TouchableOpacity
            style={s.utilityHit}
            onPress={() => setShowAuthorPosts(true)}
            activeOpacity={0.68}
            accessibilityRole="button"
            accessibilityLabel={t.feed_author_posts.replace('{name}', post.user.name.split(' ')[0])}
          >
            <View style={s.utilityVisual}>
              <View style={s.utilityIconStage}>
                <PostActionIcon
                  name="author-posts"
                  size={iconSize}
                  color={ACTION_INK}
                />
              </View>
              <View style={s.metricSlot} pointerEvents="none" />
            </View>
          </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>

      {showReactions && !isAnnouncement && (
        <Modal transparent animationType="none" visible onRequestClose={() => setShowReactions(false)}>
          <ReactionPicker postId={post.id} currentReaction={undefined} onClose={() => setShowReactions(false)} />
        </Modal>
      )}

      {showShare && (
        <SharePostSheet
          post={post}
          onShared={countShare}
          onClose={() => setShowShare(false)}
        />
      )}

      {showAuthorPosts && (
        <AuthorPostsModal author={post.user} onClose={() => setShowAuthorPosts(false)} />
      )}
    </>
  )
})

const s = StyleSheet.create({
  // Alinhada com o último botão do topo: centro a 32pt da margem direita.
  // A cadência é 60pt: item de 54pt + intervalo de 6pt.
  rail: {
    position: 'absolute',
    right: 0,
    width: feedRail.width,
    alignItems: 'center',
    gap: feedRail.itemGap,
    zIndex: 20
  },
  actionHit: {
    width: feedRail.width,
    height: feedRail.itemHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSlot: { width: feedRail.width, height: feedRail.itemHeight },
  utilityCluster: {
    width: feedRail.width,
    alignItems: 'center',
    gap: feedRail.itemGap,
  },
  utilityHit: {
    width: feedRail.width,
    height: feedRail.itemHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityVisual: {
    height: feedRail.itemHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: feedRail.iconToMetricGap,
  },
  utilityIconStage: {
    width: feedRail.iconStageWidth,
    height: feedRail.iconStageHeight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.38,
    shadowRadius: 1.8,
  },
  actionVisual: {
    height: feedRail.itemHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: feedRail.iconToMetricGap,
  },
  iconStage: {
    width: feedRail.iconStageWidth,
    height: feedRail.iconStageHeight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.38, shadowRadius: 1.8
  },
  metricSlot: {
    height: feedRail.metricSlotHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railN: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.secondary,
    fontVariant: ['tabular-nums'],
  },
  repostOneWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repostOne: {
    ...feedType.badge,
    color: feedInk.primary,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.38)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },


  // Centrado sobre o ícone do like (primeiro da coluna)
  burstHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -feedIcon.inline / 2,
    marginLeft: -feedIcon.inline / 2,
    zIndex: 30,
  },
})
