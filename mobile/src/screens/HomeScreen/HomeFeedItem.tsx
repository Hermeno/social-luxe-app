import React, { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { TextLayoutEventData, NativeSyntheticEvent } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

import AvatarImage from '../../components/AvatarImage'
import AvatarStack from '../../components/AvatarStack'
import CircleMediaComposition from '../../components/CircleMediaComposition'
import Icon from '../../components/Icon'
import VerifiedBadge from '../../components/VerifiedBadge'
import { useT } from '../../i18n'
import type { Post } from '../../types'
import { resolveMediaUrl } from '../../utils/media'
import { colors, postGradientColors, spacing } from '../../theme'
import { parsePostFontKey, postFontStyle } from '../../theme/postFonts'
import { usePostFontsReady } from '../../store/postFonts.store'
import {
  actionInkRest, FEED_GLYPH_INK_INSET, feedIcon, feedInk, homeType,
  pageDanger, pageInk, pageLine, pageSkeleton,
} from '../FeedScreen/tokens'
import PostOptionsMenu from '../FeedScreen/PostOptionsMenu'
import { readPost } from './homePostShape'
import { CIRCLE_STAGE_WIDTH } from './circleCluster'
import HomeAlbumGallery from './HomeAlbumGallery'
import HomeCircleJoin from './HomeCircleJoin'
import HomePostAction from './HomePostAction'
import HomeVideo from './HomeVideo'

/** A régua da página: tudo o que é texto começa aqui, dos dois lados. */
const SIDE = spacing.md

/**
 * A linha de quem publicou.
 *
 * 34 de identidade dentro de uma linha de 50 — os dois números do Feed System —
 * deixam 8 de ar acima e abaixo do rosto. O alvo de toque continua nos 44
 * mínimos porque se estende para lá da fotografia, até ao fim do nome.
 */
const AVATAR = 34
const HEAD_HEIGHT = 50

/** Alvo do menu da publicação, no cabeçalho. */
const OPTION_TARGET = 48

/**
 * O disco que marca um vídeo parado, e o glifo lá dentro.
 *
 * 48 é uma vez e meia a caixa de uma acção (32); o triângulo fica no degrau
 * `control` da escada de ícones e ocupa 42% do disco — a proporção que um botão
 * de leitura pede para se ler como marca e não como botão a premir.
 */
const PLAY_DISC = 48

/** Avatares empilhados fora da linha do autor: dois terços do avatar do autor. */
const STACK_AVATAR = 24

/**
 * A fotografia mais alta que a Home desenha inteira.
 *
 * Um retrato 9:16 ocupava duas dobras e empurrava a legenda e as acções para
 * fora do ecrã — a publicação deixava de se poder ler sem scroll. 4:5 é o
 * limite: acima disso a Home mostra a fotografia enquadrada e a imersiva, que
 * existe precisamente para isso, mostra-a inteira.
 */
const MIN_ASPECT = 0.8

/** A altura do palco do Círculo, na base 390 — ver `circleCluster`. */
const CIRCLE_STAGE_RATIO = 316 / CIRCLE_STAGE_WIDTH

/** Quantas linhas a legenda mostra antes de `mais`. */
const CAPTION_LINES = 3
/** E quantas um post de texto mostra antes de abrir na imersiva. */
const TEXT_POST_LINES = 6

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
  active: boolean
  liked: boolean
  likeCount: number
  reposted: boolean
  repostCount: number
  commentCount: number
  shareCount: number
  reduceMotion?: boolean
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
 * Uma publicação na Home.
 *
 * Página branca, sem cartões: o que separa duas publicações é espaço e um fio
 * de uma unidade. As quatro anatomias são parentes, não gémeas — Círculo é uma
 * composição de discos, álbum é uma galeria horizontal, foto e vídeo são mídia
 * directa, texto é um bloco tipográfico — mas todas partilham a mesma linha de
 * autoria em cima, a mesma fila de acções por baixo e a mesma régua lateral.
 */
function HomeFeedItem({
  post, width, active, liked, likeCount, reposted, repostCount, commentCount, shareCount,
  reduceMotion = false, onOpenAuthor, onOpenMedia, onLike, onRepost, onComment, onShare,
  onDeleted, onEdited,
}: Props) {
  const t = useT()
  const shape = useMemo(() => readPost(post), [post])
  const fontsReady = usePostFontsReady()
  const [loadedMedia, setLoadedMedia] = useState<{ postId: string; aspect: number } | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const [captionClamped, setCaptionClamped] = useState(false)
  // Falha de mídia: a autoria e a legenda ficam, só o quadro é substituído. O
  // contador de tentativas entra na chave da imagem — é o que a faz recarregar
  // em vez de servir o erro que já tem em cache.
  const [mediaFailed, setMediaFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const isText = shape.kind === 'text'
  const isVideo = shape.kind === 'video'
  const isCircle = shape.kind === 'circle'
  const isAlbum = shape.kind === 'album'

  const serverAspect = post.mediaWidth && post.mediaHeight ? post.mediaWidth / post.mediaHeight : null
  const measuredAspect = loadedMedia?.postId === post.id ? loadedMedia.aspect : null
  // A capa já tem a rotação do vídeo aplicada; prevalece sobre as dimensões codificadas.
  const mediaAspect = measuredAspect
    ?? (serverAspect && Number.isFinite(serverAspect) && serverAspect > 0 ? serverAspect : null)
    ?? (isVideo ? 16 / 9 : 4 / 5)
  const frameHeight = Math.round(width / Math.max(mediaAspect, MIN_ASPECT))

  const peopleLabel = shape.people === 1
    ? t.home_people_one
    : t.home_people_many.replace('{count}', String(shape.people))
  const participants = post.collectiveMoment?.participants ?? []
  const commenters = post.recentCommenters ?? []

  /**
   * O contexto da publicação: o que ela é, e há quanto tempo.
   *
   * O modelo não guarda local, por isso a linha do Feed System fica em duas
   * partes das três. O tipo à cabeça é o que muda em relação ao @handle que
   * aqui estava: um handle repete o nome que está mesmo por cima; o tipo diz
   * algo que a linha de autoria não diz.
   */
  const kindLabel = isCircle ? t.home_circle
    : isAlbum ? t.home_kind_album
    : isVideo ? t.home_kind_video
    : isText ? t.home_kind_text
    : t.home_kind_photo

  const openLabel = post.caption || `${t.home_open_moment} · ${post.user.name}`
  const mediaLabel = isCircle
    ? `${t.home_captured_together} · ${peopleLabel}`
    : `${kindLabel} · ${openLabel}`

  const retry = useCallback(() => {
    setMediaFailed(false)
    setAttempt((value) => value + 1)
  }, [])

  /**
   * Contar as linhas da legenda.
   *
   * Não se pode contar na própria legenda: com `numberOfLines` posto, o
   * `onTextLayout` devolve as linhas DEPOIS do corte — nunca mais do que três, e
   * a condição para mostrar `mais` nunca seria verdadeira. Mede-se uma cópia
   * invisível sem corte, que é o que a feed imersiva já faz com a descrição.
   */
  const measureCaption = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const clamped = event.nativeEvent.lines.length > CAPTION_LINES
    setCaptionClamped((current) => current === clamped ? current : clamped)
  }, [])

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  const header = (
    <View style={s.head}>
      <TouchableOpacity
        style={s.headLeft}
        onPress={() => onOpenAuthor(post)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={post.user.name}
      >
        <AvatarImage uri={resolveMediaUrl(post.user.avatar)} name={post.user.name} size={AVATAR} />
        <View style={s.headText}>
          <View style={s.nameLine}>
            <Text style={s.name} numberOfLines={1}>{post.user.name}</Text>
            {post.user.isVerified && <VerifiedBadge />}
          </View>
          {/* Uma linha em tamanho normal; com fonte ampliada pode ir a duas, que
              é o que a spec permite em vez de encolher o texto para caber. */}
          <Text style={s.context} numberOfLines={2}>
            {kindLabel} · {timeAgo(post.createdAt, t.time_now)}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={s.option}>
        <PostOptionsMenu
          post={post} onDeleted={onDeleted} onEdited={onEdited}
          onBlockingChange={setOptionsOpen} triggerSize={OPTION_TARGET}
          triggerColor={actionInkRest.page}
        />
      </View>
    </View>
  )

  // ── Mídia ─────────────────────────────────────────────────────────────────
  const failure = (
    <View style={[s.failure, { width, height: frameHeight }]}>
      <Icon name="image" size={feedIcon.control} color={pageInk.muted} />
      <Text style={s.failureText}>{t.home_media_failed}</Text>
      <TouchableOpacity
        style={s.retry}
        onPress={retry}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t.home_retry}
      >
        <Text style={s.retryText}>{t.home_retry}</Text>
      </TouchableOpacity>
    </View>
  )

  let media: React.ReactNode = null
  if (isText) {
    media = (
      <Pressable onPress={() => onOpenMedia(post)} accessibilityRole="button" accessibilityLabel={openLabel}>
        <LinearGradient
          colors={postGradientColors(post.bgColor)}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.textStage}
        >
          <Text
            style={[
              s.textPost,
              postFontStyle(parsePostFontKey(post.fontKey), homeType.textPost.fontSize, homeType.textPost.lineHeight, fontsReady),
            ]}
            numberOfLines={TEXT_POST_LINES}
          >
            {post.caption}
          </Text>
        </LinearGradient>
      </Pressable>
    )
  } else if (isCircle) {
    media = (
      <Pressable
        style={[s.circleStage, { minHeight: width * CIRCLE_STAGE_RATIO }]}
        onPress={() => onOpenMedia(post)}
        accessibilityRole="button"
        accessibilityLabel={mediaLabel}
      >
        {/* O palco é a largura toda da página: os 362 de área útil de que a
            spec fala já estão dentro da tabela de posições — o disco mais
            exterior de qualquer composição para a 17 da borda. Descontar aqui
            outra margem encolhia a figura duas vezes. */}
        <CircleMediaComposition
          slots={shape.slots}
          people={shape.people}
          width={width}
          postId={post.id}
          perspectiveLabel={(name) => t.home_perspective_of.replace('{name}', name)}
          lateLabel={t.circleJoin_lateA11y}
        />
      </Pressable>
    )
  } else if (isAlbum) {
    // Uma fotografia partida não apaga o álbum inteiro: cada slide fica com o
    // seu lugar reservado e as restantes continuam a ver-se.
    media = (
      <HomeAlbumGallery
        urls={shape.urls}
        width={width}
        postId={post.id}
        reduceMotion={reduceMotion}
        label={mediaLabel}
        counter={(index, total) => `${index} / ${total}`}
        onOpen={() => onOpenMedia(post)}
      />
    )
  } else if (mediaFailed) {
    media = failure
  } else {
    media = (
      <View style={[s.frame, { width, height: frameHeight }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {!!shape.urls[0] && (
            <Image
              source={{ uri: shape.urls[0] }} style={s.media} contentFit="cover" cachePolicy="disk"
              recyclingKey={`${post.id}:home-media:${attempt}`} transition={reduceMotion ? 0 : 160}
              onError={() => setMediaFailed(true)}
              onLoad={(event) => {
                const { width: w, height: h } = event.source ?? {}
                if (!w || !h) return
                const aspect = w / h
                if (!Number.isFinite(aspect) || aspect <= 0) return
                setLoadedMedia((prev) => prev?.postId === post.id && Math.abs(prev.aspect - aspect) < 0.001
                  ? prev : { postId: post.id, aspect })
              }}
            />
          )}
          {isVideo && active && !optionsOpen && !!shape.videoUri && <HomeVideo uri={shape.videoUri} active />}
          {isVideo && !active && (
            <View style={s.playMark}><Icon name="play" size={feedIcon.control} color={feedInk.primary} /></View>
          )}
        </View>
        {/* O alvo fica sobre a surface nativa; os controles seguintes recebem os próprios toques. */}
        <Pressable style={s.mediaTap} onPress={() => onOpenMedia(post)}
          accessibilityRole="button" accessibilityLabel={mediaLabel} />
      </View>
    )
  }

  // ── Acções ────────────────────────────────────────────────────────────────
  const actions = (
    <View style={s.actions} pointerEvents="box-none">
      <HomePostAction name="like" label={liked ? t.home_unlike : t.nf_likes} count={likeCount}
        selected={liked} onPress={() => onLike(post)} reduceMotion={reduceMotion} />
      <HomePostAction name="comment" label={t.comment_many} count={commentCount}
        onPress={() => onComment(post)} reduceMotion={reduceMotion} />
      <HomePostAction name="repost" label={t.feed_repost} count={repostCount} selected={reposted}
        onPress={() => onRepost(post)} reduceMotion={reduceMotion} />
      <HomePostAction name="share" label={t.mo_share} count={shareCount} trailing
        onPress={() => onShare(post)} reduceMotion={reduceMotion} />
    </View>
  )

  const commentsLabel = commentCount === 1
    ? t.home_see_comment
    : t.home_see_comments.replace('{count}', String(commentCount))

  return (
    <View style={s.item}>
      {header}
      {media}
      {actions}

      {/* A legenda do Feed System começa por quem escreveu. Sem caption não há
          linha nenhuma: a publicação fecha na fila de acções. */}
      {!isText && !!post.caption && (
        <View style={s.captionWrap}>
          <Text
            style={s.caption}
            numberOfLines={captionExpanded ? undefined : CAPTION_LINES}
          >
            <Text style={s.captionAuthor} onPress={() => onOpenAuthor(post)}>{post.user.name}</Text>
            {'  '}{post.caption}
          </Text>
          {/* O medidor. Tem de viver dentro de uma <View> com `pointerEvents`
              desligado: em <Text> essa prop não é respeitada e a cópia invisível
              ficava a comer o toque da legenda por baixo. */}
          <View style={s.captionMeasure} pointerEvents="none">
            <Text
              style={s.caption}
              onTextLayout={measureCaption}
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={s.captionAuthor}>{post.user.name}</Text>
              {'  '}{post.caption}
            </Text>
          </View>
          {captionClamped && !captionExpanded && (
            <Text
              style={s.captionMore}
              onPress={() => setCaptionExpanded(true)}
              accessibilityRole="button"
            >
              {t.home_caption_more}
            </Text>
          )}
        </View>
      )}

      {commentCount > 0 && (
        <TouchableOpacity style={s.conversation} onPress={() => onComment(post)} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={commentsLabel}>
          {commenters.length > 0 && (
            <View pointerEvents="none">
              <AvatarStack users={commenters} size={STACK_AVATAR} max={3} overlap={spacing.sm} />
            </View>
          )}
          <Text style={s.conversationText}>{commentsLabel}</Text>
        </TouchableOpacity>
      )}

      {/* O Círculo é a única publicação que traz uma segunda linha de autoria:
          o cabeçalho diz quem publicou, esta diz quem lá esteve. */}
      {isCircle && participants.length > 0 && (
        <View style={s.together}>
          <AvatarStack users={participants} size={STACK_AVATAR} max={3} overlap={spacing.sm} />
          <Text style={s.togetherText} numberOfLines={1}>
            {t.home_captured_together} · {peopleLabel}
          </Text>
          <HomeCircleJoin post={post} />
        </View>
      )}

      <View style={s.separator} />
    </View>
  )
}

export default memo(HomeFeedItem)

const s = StyleSheet.create({
  // O fim de uma publicação: 12 de ar depois da última linha e o fio. É a única
  // separação que a página usa — não há cartão, sombra nem fundo alternado.
  item: { paddingBottom: spacing.sm2 },
  separator: { marginTop: spacing.sm2, height: StyleSheet.hairlineWidth, backgroundColor: pageLine },

  // ── Cabeçalho da publicação ───────────────────────────────────────────────
  head: {
    minHeight: HEAD_HEIGHT,
    paddingLeft: SIDE,
    // O menu tem um alvo de 48 à direita; encostá-lo a 16 punha a tinta muito
    // para dentro. O recuo devolve o glifo à régua da página.
    paddingRight: SIDE - FEED_GLYPH_INK_INSET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headLeft: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  headText: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1, color: pageInk.primary, letterSpacing: -0.2, ...homeType.username },
  context: { color: pageInk.secondary, marginTop: 1, ...homeType.context },
  option: { width: OPTION_TARGET, alignItems: 'flex-end', justifyContent: 'center' },

  // ── Mídia ─────────────────────────────────────────────────────────────────
  frame: { position: 'relative', backgroundColor: pageSkeleton },
  media: { width: '100%', height: '100%' },
  mediaTap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  playMark: {
    position: 'absolute', left: '50%', top: '50%',
    marginLeft: -PLAY_DISC / 2, marginTop: -PLAY_DISC / 2,
    width: PLAY_DISC, height: PLAY_DISC, borderRadius: PLAY_DISC / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  circleStage: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  textStage: { minHeight: 260, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, justifyContent: 'center' },
  textPost: { color: feedInk.primary, letterSpacing: -0.44 },

  // ── Falha de mídia ────────────────────────────────────────────────────────
  // A publicação não desaparece: quem escreveu e o que escreveu continuam lá, e
  // só o quadro troca por um lugar de recuperação.
  failure: {
    backgroundColor: pageSkeleton,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  failureText: { color: pageInk.secondary, textAlign: 'center', ...homeType.caption },
  retry: {
    minHeight: 44, justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pageLine,
    backgroundColor: colors.white,
  },
  retryText: { color: pageDanger, ...homeType.username },

  // ── Acções ────────────────────────────────────────────────────────────────
  // A caixa de 32 traz 5,5 de vazio à volta do desenho: descontá-lo à margem põe
  // a TINTA do primeiro glifo na mesma régua do nome e da legenda, em vez da
  // borda invisível da caixa.
  actions: {
    paddingHorizontal: SIDE - FEED_GLYPH_INK_INSET,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },

  // ── Legenda e conversa ────────────────────────────────────────────────────
  captionWrap: { paddingHorizontal: SIDE },
  // 0/0 e não SIDE/SIDE: o Yoga posiciona um filho absoluto dentro da caixa
  // de conteúdo do pai, por isso a margem lateral já está descontada. Medir
  // numa largura menor que a real dava linhas a mais e um `mais` a mentir.
  captionMeasure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  caption: { color: pageInk.primary, ...homeType.caption },
  captionAuthor: { color: pageInk.primary, ...homeType.captionAuthor },
  captionMore: { marginTop: 2, color: pageInk.muted, ...homeType.caption },
  conversation: {
    marginHorizontal: SIDE, minHeight: 44,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  conversationText: { flexShrink: 1, color: pageInk.secondary, ...homeType.caption },
  together: {
    marginHorizontal: SIDE, minHeight: 32,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm2,
  },
  togetherText: { flex: 1, color: pageInk.secondary, ...homeType.context },
})
