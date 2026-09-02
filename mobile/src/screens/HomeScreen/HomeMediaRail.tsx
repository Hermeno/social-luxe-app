import React, { memo, useCallback, useMemo, useState } from 'react'
import {
  FlatList, Pressable, StyleSheet, Text, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

import AvatarImage from '../../components/AvatarImage'
import Icon from '../../components/Icon'
import VerifiedBadge from '../../components/VerifiedBadge'
import type { Post } from '../../types'
import { colors, fonts, gradients, spacing, typography } from '../../theme'
import { ACTION_INK, feedTextShadow } from '../FeedScreen/tokens'
import { resolveMediaUrl } from '../../utils/media'
import { readPost } from './homePostShape'
import { FRAME_BORDER, FRAME_INK, FRAME_RADIUS } from './homeFrame'
import HomeVideo from './HomeVideo'

const SIDE = spacing.md
const GAP = spacing.sm2

/**
 * O quanto do cartão seguinte fica à vista.
 *
 * É a única coisa que diz "isto arrasta-se". Uma fila que acaba certinha na
 * margem lê-se como uma imagem cortada pelo ecrã; com o vizinho a espreitar,
 * lê-se como uma fila — e ninguém precisa de uma seta nem de pontos a explicá-lo.
 *
 * 44 é o mínimo em que se reconhece que o que espreita é outro cartão e não uma
 * faixa de cor: abaixo disso o canto arredondado come quase tudo o que se vê.
 */
const PEEK = 44

/** Deitado. É o formato que a fila existe para servir. */
const CARD_ASPECT = 16 / 9

interface Props {
  posts: Post[]
  width: number
  /** O bloco está à vista na lista vertical. Só então algum vídeo pode tocar. */
  active: boolean
  onOpenMedia: (post: Post) => void
  onOpenAuthor: (post: Post) => void
}

/**
 * A fila horizontal da Home.
 *
 * Publicações deitadas, lado a lado, que se arrastam para o lado. Tocar num
 * cartão abre-o na feed imersiva — o cartão é a montra, não o leitor: um vídeo
 * dentro de uma lista horizontal a fingir que é um ecrã de reprodução é a pior
 * das duas coisas.
 *
 * ── O invariante do vídeo ───────────────────────────────────────────────────
 *
 * Em todo o ecrã há no máximo UMA superfície de vídeo montada, e é a do cartão
 * activo desta fila — desde que a fila esteja à vista na lista vertical.
 *
 * Não é uma optimização, é correcção. Duas superfícies de vídeo empilhadas no
 * Android desenham-se por cima uma da outra sem se comporem com a árvore, e o
 * resultado é som sem imagem — foi exactamente o que partiu a feed imersiva. Uma
 * fila horizontal é o sítio mais fácil do mundo para ter três à vista ao mesmo
 * tempo, por isso a condição é dupla: `active && index === current`.
 */
function HomeMediaRail({ posts, width, active, onOpenMedia, onOpenAuthor }: Props) {
  const cardWidth = width - SIDE * 2 - PEEK
  const cardHeight = Math.round(cardWidth / CARD_ASPECT)
  const step = cardWidth + GAP

  const [current, setCurrent] = useState(0)

  // O índice sai do deslocamento e não da viewabilidade: a fila tem passo fixo,
  // por isso uma divisão dá a resposta certa sem esperar por callbacks e sem
  // outro estado a que possa ficar dessincronizado.
  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / step)
    setCurrent(Math.max(0, Math.min(posts.length - 1, index)))
  }, [posts.length, step])

  const renderItem = useCallback(({ item, index }: { item: Post; index: number }) => (
    <RailCard
      post={item}
      width={cardWidth}
      height={cardHeight}
      active={active && index === current}
      onOpenMedia={onOpenMedia}
      onOpenAuthor={onOpenAuthor}
    />
  ), [active, cardHeight, cardWidth, current, onOpenMedia, onOpenAuthor])

  // Passo fixo e conhecido: dá-se à lista em vez de a deixar medir célula a
  // célula, que é o que lhe permite saltar para um índice sem o ter desenhado.
  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: step, offset: step * index, index,
  }), [step])

  return (
    <FlatList
      data={posts}
      horizontal
      keyExtractor={(post) => post.id}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.content}
      ItemSeparatorComponent={Separator}
      snapToInterval={step}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      onMomentumScrollEnd={onScrollEnd}
      onScrollEndDrag={onScrollEnd}
    />
  )
}

const Separator = () => <View style={{ width: GAP }} />

interface CardProps {
  post: Post
  width: number
  height: number
  active: boolean
  onOpenMedia: (post: Post) => void
  onOpenAuthor: (post: Post) => void
}

/**
 * Um cartão da fila.
 *
 * A mídia vai de traço a traço — não há afastamento nenhum, e é por isso que o
 * `overflow` recorta: o raio interior é o exterior menos a espessura do
 * contorno, e o recorte entrega-o sem se ter de o escrever em lado nenhum.
 *
 * Por cima, e só no fundo, o autor sobre um véu. Um cartão deitado e pequeno não
 * tem espaço para uma fila de acções sem passar a ser um formulário: gostar e
 * comentar estão a um toque de distância, na imersiva, que é onde a publicação
 * se vê inteira.
 */
const RailCard = memo(function RailCard({
  post, width, height, active, onOpenMedia, onOpenAuthor,
}: CardProps) {
  const shape = useMemo(() => readPost(post), [post])
  const isVideo = shape.kind === 'video'
  const poster = shape.urls[0]

  return (
    <View style={[s.card, { width, height }]}>
      <View style={s.mediaStack}>
        {!!poster && (
          <Image
            source={{ uri: poster }}
            style={s.media}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={`${post.id}:rail`}
            transition={120}
          />
        )}
        {/* O leitor entra por cima do cartaz e nunca o substitui: sem isto havia
            um frame em branco entre o cartaz sair e o vídeo pintar. */}
        {isVideo && active && !!shape.videoUri && (
          <HomeVideo uri={shape.videoUri} active={active} />
        )}
        {isVideo && !active && (
          <View style={s.playMark} pointerEvents="none">
            <Icon name="play" size={22} color={ACTION_INK} strokeWidth={1.9} absoluteStrokeWidth />
          </View>
        )}
      </View>

      {/* O véu existe para o nome se ler sobre qualquer fotografia. Não escurece
          o cartão: só o fundo, onde o texto assenta. */}
      <LinearGradient
        colors={gradients.feedBottom}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.veil}
        pointerEvents="none"
      />

      {/* O alvo do toque é uma camada por cima da mídia — nunca a caixa que a
          contém. Por baixo, bastava um filho não deixar passar `pointerEvents`
          para o cartão inteiro deixar de abrir, sem erro nenhum. */}
      <Pressable
        style={s.tap}
        onPress={() => onOpenMedia(post)}
        accessibilityRole="button"
        accessibilityLabel={post.caption || post.user.name}
      />

      <View style={s.author} pointerEvents="box-none">
        <Pressable
          style={s.authorLeft}
          onPress={() => onOpenAuthor(post)}
          accessibilityRole="button"
          accessibilityLabel={post.user.name}
        >
          <AvatarImage uri={resolveMediaUrl(post.user.avatar)} name={post.user.name} size={22} />
          <Text style={s.name} numberOfLines={1}>{post.user.name}</Text>
          {post.user.isVerified && <VerifiedBadge size={12} color={colors.white} />}
        </Pressable>
      </View>
    </View>
  )
})

export default memo(HomeMediaRail)

const s = StyleSheet.create({
  content: { paddingHorizontal: SIDE },
  card: {
    borderWidth: FRAME_BORDER,
    borderColor: FRAME_INK,
    borderRadius: FRAME_RADIUS,
    backgroundColor: colors.gray100,
    // Recorta a mídia pelo raio interior sem o escrever: é o contorno menos a
    // sua própria espessura, que é a regra concêntrica no caso mais simples.
    overflow: 'hidden',
  },
  mediaStack: { ...StyleSheet.absoluteFillObject },
  media: { width: '100%', height: '100%' },
  playMark: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -19,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  veil: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  // zIndex 1: por cima da mídia e do véu, por baixo da linha do autor (2).
  tap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  author: {
    position: 'absolute',
    zIndex: 2,
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.sm2,
    paddingBottom: spacing.sm2,
  },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  name: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: fonts.semiBold,
    fontSize: typography.secondary,
    letterSpacing: -0.1,
    ...feedTextShadow,
  },
})
