import React, { memo, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

import AvatarImage from '../../components/AvatarImage'
import Icon from '../../components/Icon'
import PostActionIcon from '../../components/PostActionIcon'
import VerifiedBadge from '../../components/VerifiedBadge'
import { useT } from '../../i18n'
import type { Post } from '../../types'
import { resolveMediaUrl } from '../../utils/media'
import { readPost, type HomePostShape } from './homePostShape'
import { colors, fonts, gradients, spacing, typography } from '../../theme'
import { FRAME_BORDER, FRAME_INK, FRAME_RADIUS } from './homeFrame'
import { ACTION_INK, feedIcon, feedTextShadow } from '../FeedScreen/tokens'
import PostOptionsMenu from '../FeedScreen/PostOptionsMenu'
import CirclePhotoComposition from './CirclePhotoComposition'
import HomeVideo from './HomeVideo'

/**
 * O avatar do autor.
 *
 * Numa página branca a linha do autor é cabeçalho, não conteúdo: o que a pessoa
 * veio ver está por baixo. 32 continua a dar um rosto reconhecível e devolve
 * peso à fotografia, que é quem manda no ecrã.
 */
const AVATAR = 32
const ACTION_ICON = feedIcon.action
const SIDE = spacing.md

// A moldura e a regra dos cantos vivem no `homeFrame`, que a fila horizontal
// também usa. Aqui só se lê o afastamento: o anel de discos não deve encostar
// ao traço, por isso o conteúdo recua SIDE e o raio interior sai de `innerRadius`.
const CARD_BORDER = FRAME_BORDER
const CARD_RADIUS = FRAME_RADIUS

function metric(value: number): string {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`
  return String(Math.max(0, value))
}

function timeAgo(iso: string, nowLabel: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return nowLabel
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}


interface Props {
  post: Post
  width: number
  /**
   * Esta é a publicação à vista. Só ela toca — um feed com vários vídeos a
   * correr ao mesmo tempo gasta rede e bateria por conteúdo que ninguém está a
   * ver.
   */
  active: boolean
  liked: boolean
  likeCount: number
  reposted: boolean
  repostCount: number
  commentCount: number
  shareCount: number
  onOpenAuthor: (post: Post) => void
  onOpenMedia: (post: Post) => void
  onLike: (post: Post) => void
  onRepost: (post: Post) => void
  onComment: (post: Post) => void
  onShare: (post: Post) => void
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
}

/**
 * Uma publicação da Home.
 *
 * Não é um cartão. Não tem fundo próprio, contorno nem sombra: assenta no branco
 * da página e o que a separa da seguinte é espaço, não uma caixa. Foi essa a
 * decisão que o documento de referência repete mais vezes, e é ela que faz a
 * fotografia ser o post em vez de estar dentro de um.
 *
 * Três formas de conteúdo, uma altura de linguagem só:
 * — **Círculo**: a composição de discos, a assinatura da Luxey.
 * — **Imagem**: a fotografia de ponta a ponta, sem moldura nem raio.
 * — **Vídeo**: a mesma largura total, com um alvo de reprodução ao centro;
 *   tocar leva ao ecrã inteiro, porque um vídeo dentro de uma lista é uma
 *   miniatura a fingir que é um leitor.
 */
function HomeFeedItem({
  post, width, active, liked, likeCount, reposted, repostCount, commentCount, shareCount,
  onOpenAuthor, onOpenMedia, onLike, onRepost, onComment, onShare, onDeleted, onEdited,
}: Props) {
  const t = useT()
  const shape = useMemo(() => readPost(post), [post])
  const [loadedMedia, setLoadedMedia] = useState<{ postId: string; aspect: number } | null>(null)
  const authorInsideMedia = shape.kind !== 'circle' && post.mediaType !== 'TEXT'
  // Fotografia e vídeo ocupam a largura inteira da Home. O Círculo conserva a
  // composição e as margens próprias que já tinha.
  const contentWidth = authorInsideMedia ? width : width - SIDE * 2
  // Dentro da moldura do Círculo sobra menos: o contorno come CARD_BORDER de
  // cada lado e o `contentInset` já lá punha SIDE. A composição tem de saber a
  // largura real, senão o anel sai maior que a caixa e encosta ao traço.
  const circleWidth = contentWidth - CARD_BORDER * 2 - SIDE * 2
  const serverAspect = post.mediaWidth && post.mediaHeight
    ? post.mediaWidth / post.mediaHeight
    : null
  const measuredAspect = loadedMedia?.postId === post.id ? loadedMedia.aspect : null
  const fallbackAspect = shape.kind === 'video' ? 16 / 9 : 4 / 5
  const mediaAspect = serverAspect && Number.isFinite(serverAspect) && serverAspect > 0
    ? serverAspect
    : measuredAspect ?? fallbackAspect
  const frameHeight = Math.round(contentWidth / mediaAspect)

  const peopleLabel = shape.people === 1
    ? t.home_people_one
    : t.home_people_many.replace('{count}', String(shape.people))

  const actionsRow = (onVideo: boolean) => {
    // A geometria é idêntica nas duas superfícies; a tinta adapta-se ao fundo
    // para nunca desaparecer no branco nem numa fotografia clara.
    // A mesma tinta sobre papel e sobre vídeo: o véu por baixo das acções já
    // garante o contraste, e trocar de cor com o fundo era o que fazia o mesmo
    // gesto ter dois aspectos no mesmo ecrã.
    const neutralInk = ACTION_INK
    const likeInk = liked ? colors.heart : neutralInk

    return (
      <View
        style={[s.actions, onVideo && s.actionsOnVideo]}
        pointerEvents={onVideo ? 'box-none' : 'auto'}
      >
        <TouchableOpacity
          style={s.actionHit}
          onPress={() => onLike(post)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={t.nf_likes}
          accessibilityState={{ selected: liked }}
        >
          <PostActionIcon
            name="like"
            size={ACTION_ICON}
            color={likeInk}
            selected={liked}
          />
          <Text style={[
            s.actionMetric,
            onVideo && s.actionMetricOnVideo,
          ]}>
            {metric(likeCount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionHit}
          onPress={() => onComment(post)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`${commentCount} ${commentCount === 1 ? t.comment_one : t.comment_many}`}
        >
          <PostActionIcon name="comment" size={ACTION_ICON} color={neutralInk} />
          <Text style={[s.actionMetric, onVideo && s.actionMetricOnVideo]}>{metric(commentCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionHit}
          onPress={() => onRepost(post)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={t.feed_repost}
          accessibilityState={{ selected: reposted }}
        >
          {/* Sem `strokePx`: o desenho do repost traz o peso dentro da geometria
              preenchida, e forçar-lhe um traço engrossava-o acima dos vizinhos. */}
          <PostActionIcon
            name="repost"
            size={ACTION_ICON}
            color={reposted ? colors.accent : neutralInk}
          />
          <Text style={[
            s.actionMetric,
            onVideo && s.actionMetricOnVideo,
          ]}>
            {metric(repostCount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionHit}
          onPress={() => onShare(post)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={`${shareCount} ${t.mo_share}`}
        >
          <PostActionIcon name="share" size={ACTION_ICON} color={neutralInk} />
          <Text style={[s.actionMetric, onVideo && s.actionMetricOnVideo]}>{metric(shareCount)}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const authorRow = (insideMedia: boolean) => (
    // `box-none`: a linha do autor não é um alvo, os botões dentro dela é que
    // são. Sobre a mídia ela é uma camada absoluta por cima do `Pressable` que
    // abre a imersiva — sem isto, tocar em qualquer ponto da faixa do autor (o
    // topo inteiro da foto ou do vídeo) não fazia rigorosamente nada, porque o
    // toque morria nesta View e nunca chegava ao que está por baixo.
    <View style={[s.author, insideMedia && s.authorOverlay]} pointerEvents="box-none">
      <TouchableOpacity
        style={s.authorLeft}
        onPress={() => onOpenAuthor(post)}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={post.user.name}
      >
        <AvatarImage uri={resolveMediaUrl(post.user.avatar)} name={post.user.name} size={AVATAR} />
        <View style={s.authorText}>
          <View style={s.nameLine}>
            <Text style={[s.name, insideMedia && s.nameOnMedia]} numberOfLines={1}>{post.user.name}</Text>
            {post.user.isVerified && <VerifiedBadge color={insideMedia ? colors.white : undefined} />}
          </View>
          <Text style={[s.time, insideMedia && s.timeOnMedia]}>{timeAgo(post.createdAt, t.time_now)}</Text>
        </View>
      </TouchableOpacity>

      <View style={s.optionsHit}>
        <PostOptionsMenu
          post={post}
          onDeleted={onDeleted}
          onEdited={onEdited}
          triggerSize={ACTION_ICON}
          triggerColor={ACTION_INK}
        />
      </View>
    </View>
  )

  const body = (
    <>
      {/* Imagem e vídeo levam o autor por dentro, no topo. O Círculo mantém a
          sua estrutura exterior sem qualquer mudança de composição. */}
      {!authorInsideMedia && authorRow(false)}

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <View style={[s.content, !authorInsideMedia && s.contentInset]}>
        {shape.kind === 'circle' ? (
          <CirclePhotoComposition urls={shape.urls} width={circleWidth} postId={post.id} />
        ) : (
          <View style={[s.frame, { width: contentWidth, height: frameHeight }]}>
            <View style={s.mediaStack}>
              {!!shape.urls[0] && (
                <Image
                  source={{ uri: shape.urls[0] }}
                  style={s.media}
                  contentFit="cover"
                  cachePolicy="disk"
                  recyclingKey={`${post.id}:home-media`}
                  transition={100}
                  onLoad={(event) => {
                    if (serverAspect) return
                    const { width: sourceWidth, height: sourceHeight } = event.source ?? {}
                    if (!sourceWidth || !sourceHeight) return
                    const aspect = sourceWidth / sourceHeight
                    if (Number.isFinite(aspect) && aspect > 0) {
                      setLoadedMedia({ postId: post.id, aspect })
                    }
                  }}
                />
              )}
              {/* O leitor entra por cima do cartaz e nunca o substitui: assim
                  não há um frame em branco entre o cartaz sair e o vídeo pintar,
                  e ao sair de vista o cartaz já lá está por baixo. */}
              {shape.kind === 'video' && active && !!shape.videoUri && (
                <HomeVideo uri={shape.videoUri} active={active} />
              )}
              {shape.kind === 'video' && !active && (
                <View style={s.playMark} pointerEvents="none">
                  <Icon name="play" size={26} color={ACTION_INK} strokeWidth={1.9} absoluteStrokeWidth />
                </View>
              )}
            </View>

            {/* O alvo do toque é uma camada POR CIMA da mídia, e não a caixa que
                a contém.
                
                Por baixo, quem decidia se o toque chegava cá era o que estivesse
                em cima: a superfície do vídeo, uma imagem, o que fosse. Um único
                filho que não deixe passar `pointerEvents` e a publicação inteira
                deixa de abrir — sem erro nenhum, só não acontece nada.
                
                Por cima, o alvo é o alvo. As camadas que vêm a seguir têm
                `box-none` e continuam a apanhar os seus próprios botões. */}
            <Pressable
              style={s.mediaTap}
              onPress={() => onOpenMedia(post)}
              accessibilityRole="button"
              accessibilityLabel={post.caption || post.user.name}
            />
            {shape.kind === 'video' && (
              <View style={s.videoActionLayer} pointerEvents="box-none">
                <LinearGradient
                  colors={gradients.feedBottom}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.videoActionGradient}
                  pointerEvents="none"
                />
                {actionsRow(true)}
              </View>
            )}
            {authorInsideMedia && authorRow(true)}
          </View>
        )}
      </View>

      {/* No vídeo as acções vivem dentro do véu neutro; a imagem conserva a
          linha neutra imediatamente abaixo da mídia. O Círculo é a excepção: as
          dele saem da moldura — ver o `return`. */}
      {shape.kind !== 'video' && shape.kind !== 'circle' && actionsRow(false)}

      {!!post.caption && (
        <Text style={[s.caption, shape.kind === 'video' && s.captionAfterVideo]} numberOfLines={3}>
          {post.caption}
        </Text>
      )}

      {shape.kind === 'circle' && (
        <View style={s.together}>
          <Icon name="users" size={22} color={colors.gray800} strokeWidth={1.7} absoluteStrokeWidth />
          <View>
            <Text style={s.togetherTitle}>{t.home_captured_together}</Text>
            <Text style={s.togetherSub}>{peopleLabel}</Text>
          </View>
        </View>
      )}
    </>
  )

  // O Círculo é o único que se fecha numa moldura. Uma fotografia e um vídeo
  // trazem a sua própria borda — a mídia acaba onde acaba, e a página branca
  // faz o resto. Um Círculo não tem bordo nenhum: é um anel de discos com quatro
  // cantos vazios à volta, e sem nada a fechá-lo não se lê como um objecto, lê-se
  // como discos soltos sobre a página.
  //
  // As acções ficam DE FORA, logo por baixo. O que a moldura fecha é o momento —
  // quem o fez, os rostos, a legenda; gostar e comentar não pertencem ao momento,
  // pertencem a quem o está a ver. Lá dentro o traço da moldura passava a ser um
  // botão à volta deles; cá fora o objecto fica inteiro e a fila alinha com a
  // borda, porque as duas margens são a mesma.
  return (
    <View style={s.item}>
      {shape.kind === 'circle' ? (
        <>
          <View style={s.circleCard}>{body}</View>
          {actionsRow(false)}
        </>
      ) : body}
    </View>
  )
}

export default memo(HomeFeedItem)

const s = StyleSheet.create({
  // Sem fundo, sem contorno, sem sombra: o que separa uma publicação da seguinte
  // é espaço. Um cartão aqui transformava a página numa lista de caixas.
  item: { paddingBottom: spacing.lg },

  author: {
    // Acompanha o avatar em vez de reservar altura própria: com 56 fixos sobrava
    // ar em cima e em baixo da linha inteira, e era esse ar que empurrava tudo.
    minHeight: AVATAR + spacing.sm2,
    paddingHorizontal: SIDE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  authorOverlay: {
    position: 'absolute',
    zIndex: 3,
    top: 0,
    left: 0,
    right: 0,
    // Folga por `paddingTop` e não por `minHeight`. Com 64 de altura para 38 de
    // conteúdo, o centro da linha caía 13px e levava os três pontos com ele —
    // uma altura a mais move o centro, um padding move o bloco inteiro.
    paddingTop: spacing.sm,
  },
  authorLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  authorText: { flex: 1, minWidth: 0 },
  nameLine:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: {
    flexShrink: 1,
    color: colors.gray800,
    fontFamily: fonts.semiBold,
    fontSize: typography.body,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  // A sombra é a `feedTextShadow` do projecto, não uma segunda receita inventada
  // aqui. Estava em 0.72 — um halo que se lia como mancha à volta das letras em
  // vez de as separar da fotografia.
  nameOnMedia: {
    color: colors.white,
    ...feedTextShadow,
  },
  time: {
    marginTop: 1,
    color: colors.gray500,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: 17,
  },
  timeOnMedia: {
    color: 'rgba(255,255,255,0.88)',
    ...feedTextShadow,
  },
  // Sem caixa de 44. O gatilho do menu já traz `hitSlop` de 9 — a área tátil
  // estava garantida — e a caixa a mais só criava vazio: a tinta do `option` tem
  // 18.5 de 32 de altura, portanto numa caixa de 44 sobravam 14px acima e abaixo,
  // e mais 8 de cada lado. Era isso que o fazia parecer baixo e afastado da borda.
  //
  // A margem negativa alinha os três pontos com a régua de 16 do ecrã: sem ela o
  // gatilho encosta a 16 mas a tinta fica 4px mais para dentro.
  /**
   * Os três pontos alinham com o NOME, não com o centro da linha.
   *
   * O bloco da esquerda tem duas linhas — nome (20) e hora (17) — e o menu tem
   * 34. Centrados um contra o outro, os pontos aterram entre as duas linhas, uns
   * 9px abaixo do nome. Lê-se como se estivessem caídos, porque o olho compara-os
   * com o nome e não com o miolo do bloco.
   *
   * `flex-start` mais um recuo de 4: o menu deixa de acompanhar o centro e passa
   * a acompanhar a primeira linha, nas duas variantes — sobre branco e sobre a
   * fotografia — porque agora as duas têm a mesma geometria.
   */
  optionsHit: { alignSelf: 'flex-start', marginTop: -4, marginRight: -4 },

  // O contorno é fino e cinzento: fecha o objecto sem o transformar num botão.
  // A cor é a mesma dos controlos — na página branca não há duas famílias de
  // cinzento, há uma.
  circleCard: {
    marginHorizontal: SIDE,
    paddingVertical: spacing.sm2,
    borderWidth: CARD_BORDER,
    borderColor: FRAME_INK,
    borderRadius: CARD_RADIUS,
  },
  content: { width: '100%', alignItems: 'center' },
  contentInset: { marginTop: spacing.xs2, paddingHorizontal: SIDE },
  mediaStack: { ...StyleSheet.absoluteFillObject },
  // zIndex 1: por cima da mídia, por baixo das acções (2) e do autor (3).
  mediaTap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  frame: {
    position: 'relative',
    backgroundColor: colors.gray100,
  },
  media: { width: '100%', height: '100%' },
  videoActionLayer: {
    position: 'absolute',
    zIndex: 2,
    left: 0,
    right: 0,
    bottom: 0,
    height: 52,
    justifyContent: 'flex-end',
  },
  videoActionGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.78,
  },
  // A marca de reprodução é um disco escuro translúcido e não um botão: diz que
  // há vídeo sem reclamar o lugar do conteúdo.
  playMark: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -26,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  caption: {
    paddingHorizontal: SIDE,
    color: colors.gray800,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: 19,
  },
  captionAfterVideo: { marginTop: spacing.sm },

  actions: {
    paddingHorizontal: SIDE,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  actionsOnVideo: {
    minHeight: 44,
  },
  together: {
    marginTop: spacing.sm,
    paddingHorizontal: SIDE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  togetherTitle: {
    color: colors.gray800,
    fontFamily: fonts.semiBold,
    fontSize: typography.body,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  togetherSub: {
    color: colors.gray500,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: 17,
  },
  actionHit: {
    minWidth: 48,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs2,
  },
  actionMetric: {
    color: colors.gray600,
    fontFamily: fonts.medium,
    fontSize: typography.secondary,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  actionMetricOnVideo: {
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.34)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
