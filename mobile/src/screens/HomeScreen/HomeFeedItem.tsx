import React, { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'

import AvatarImage from '../../components/AvatarImage'
import Icon from '../../components/Icon'
import VerifiedBadge from '../../components/VerifiedBadge'
import { useT } from '../../i18n'
import type { Post } from '../../types'
import { resolveMediaUrl } from '../../utils/media'
import { colors, fonts, radius, spacing, typography } from '../../theme'
import PostOptionsMenu from '../FeedScreen/PostOptionsMenu'
import CirclePhotoComposition from './CirclePhotoComposition'

const AVATAR = 44
const ACTION_ICON = 26
const SIDE = spacing.md

function timeAgo(iso: string, nowLabel: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return nowLabel
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export interface HomePostShape {
  kind: 'circle' | 'image' | 'video'
  urls: string[]
  people: number
}

/**
 * Lê a publicação e decide o que ela é, uma vez só.
 *
 * O modelo não tem um campo "tipo": um Círculo reconhece-se por ter capturas
 * colectivas, um vídeo pelo `mediaType`. A leitura vive aqui para a lista, a
 * célula e a altura estimada não poderem discordar sobre o que estão a desenhar.
 */
export function readPost(post: Post): HomePostShape {
  const captures = Array.isArray(post.collectiveMoment?.captures)
    ? post.collectiveMoment.captures
    : []
  const participants = Array.isArray(post.collectiveMoment?.participants)
    ? post.collectiveMoment.participants
    : []

  if (post.mediaType !== 'VIDEO' && post.mediaType !== 'TEXT' && captures.length > 0) {
    return {
      kind: 'circle',
      urls: captures.map((capture, index) => resolveMediaUrl(
        post.mediaUrls?.[capture.mediaIndex ?? index] ?? capture.mediaUrl,
      )),
      people: participants.length || captures.length,
    }
  }

  if (post.mediaType === 'VIDEO') {
    return { kind: 'video', urls: [resolveMediaUrl(post.thumbnailUrl || post.mediaUrl)], people: 0 }
  }

  return {
    kind: 'image',
    urls: (post.mediaUrls?.length ? post.mediaUrls : [post.mediaUrl]).map(resolveMediaUrl),
    people: 0,
  }
}

interface Props {
  post: Post
  width: number
  liked: boolean
  commentCount: number
  onOpenAuthor: (post: Post) => void
  onOpenMedia: (post: Post) => void
  onLike: (post: Post) => void
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
 * — **Imagem**: a fotografia, com o canto suavizado e nada mais.
 * — **Vídeo**: a mesma moldura da imagem, com um alvo de reprodução ao centro;
 *   tocar leva ao ecrã inteiro, porque um vídeo dentro de uma lista é uma
 *   miniatura a fingir que é um leitor.
 */
function HomeFeedItem({
  post, width, liked, commentCount,
  onOpenAuthor, onOpenMedia, onLike, onComment, onShare, onDeleted, onEdited,
}: Props) {
  const t = useT()
  const shape = useMemo(() => readPost(post), [post])
  const contentWidth = width - SIDE * 2

  const peopleLabel = shape.people === 1
    ? t.home_people_one
    : t.home_people_many.replace('{count}', String(shape.people))

  return (
    <View style={s.item}>
      {/* ── Autor ─────────────────────────────────────────────────────────── */}
      <View style={s.author}>
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
              <Text style={s.name} numberOfLines={1}>{post.user.name}</Text>
              {post.user.isVerified && <VerifiedBadge />}
            </View>
            <Text style={s.time}>{timeAgo(post.createdAt, t.time_now)}</Text>
          </View>
        </TouchableOpacity>

        {/* O menu é o componente que a Feed já usa: traz o gatilho e toda a
            lógica de apagar, editar, bloquear e silenciar. Redesenhar aqui um
            botão próprio significava reescrever isso ao lado. */}
        <View style={s.optionsHit}>
          <PostOptionsMenu
            post={post}
            onDeleted={onDeleted}
            onEdited={onEdited}
            triggerSize={22}
          />
        </View>
      </View>

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <View style={s.content}>
        {shape.kind === 'circle' ? (
          <CirclePhotoComposition urls={shape.urls} width={contentWidth} postId={post.id} />
        ) : (
          <Pressable
            onPress={() => onOpenMedia(post)}
            accessibilityRole="button"
            accessibilityLabel={post.caption || post.user.name}
          >
            <View style={[s.frame, { width: contentWidth, height: contentWidth * 1.25 }]}>
              {!!shape.urls[0] && (
                <Image
                  source={{ uri: shape.urls[0] }}
                  style={s.media}
                  contentFit="cover"
                  cachePolicy="disk"
                  recyclingKey={post.id}
                  transition={140}
                />
              )}
              {shape.kind === 'video' && (
                <View style={s.playMark} pointerEvents="none">
                  <Icon name="play" size={26} color={colors.white} strokeWidth={1.9} absoluteStrokeWidth />
                </View>
              )}
            </View>
          </Pressable>
        )}
      </View>

      {!!post.caption && (
        <Text style={s.caption} numberOfLines={3}>{post.caption}</Text>
      )}

      {/* ── Rodapé ────────────────────────────────────────────────────────── */}
      <View style={s.footer}>
        {shape.kind === 'circle' ? (
          <View style={s.together}>
            <Icon name="users" size={22} color={colors.gray800} strokeWidth={1.7} absoluteStrokeWidth />
            <View>
              <Text style={s.togetherTitle}>{t.home_captured_together}</Text>
              <Text style={s.togetherSub}>{peopleLabel}</Text>
            </View>
          </View>
        ) : (
          <View style={s.together} />
        )}

        <View style={s.actions}>
          <TouchableOpacity
            style={s.actionHit}
            onPress={() => onLike(post)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={t.nf_likes}
            accessibilityState={{ selected: liked }}
          >
            <Icon
              name="heart"
              size={ACTION_ICON}
              color={liked ? colors.heart : colors.gray800}
              fill={liked ? colors.heart : 'none'}
              strokeWidth={1.7}
              absoluteStrokeWidth
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionHit}
            onPress={() => onComment(post)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`${commentCount} ${commentCount === 1 ? t.comment_one : t.comment_many}`}
          >
            <Icon name="message" size={ACTION_ICON} color={colors.gray800} strokeWidth={1.7} absoluteStrokeWidth />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionHit}
            onPress={() => onShare(post)}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={t.mo_share}
          >
            <Icon name="forward" size={ACTION_ICON} color={colors.gray800} strokeWidth={1.7} absoluteStrokeWidth />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default memo(HomeFeedItem)

const s = StyleSheet.create({
  // Sem fundo, sem contorno, sem sombra: o que separa uma publicação da seguinte
  // é espaço. Um cartão aqui transformava a página numa lista de caixas.
  item: { paddingBottom: spacing.xl },

  author: {
    minHeight: 56,
    paddingHorizontal: SIDE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
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
  time: {
    marginTop: 1,
    color: colors.gray500,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: 17,
  },
  optionsHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  content: { marginTop: spacing.xs2, paddingHorizontal: SIDE, alignItems: 'center' },
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  media: { width: '100%', height: '100%' },
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
    marginTop: spacing.sm2,
    paddingHorizontal: SIDE,
    color: colors.gray800,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: 19,
  },

  footer: {
    marginTop: spacing.md,
    paddingHorizontal: SIDE,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  together: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
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
  actions:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
