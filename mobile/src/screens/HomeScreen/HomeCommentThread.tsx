import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import AvatarImage from '../../components/AvatarImage'
import { homeType, pageInk, pageLine } from '../FeedScreen/tokens'
import { useT } from '../../i18n'
import { Post } from '../../types'
import { spacing } from '../../theme'

/**
 * A conversa dentro do cartão.
 *
 * A feed mostrava um contador — "Ver 12 comentários" — e a conversa vivia toda
 * atrás de um toque. Um contador diz quantos; não diz nada do que lá está, e
 * uma publicação com conversa boa lê-se igual a uma sem conversa nenhuma. Aqui
 * os últimos aparecem com rosto, nome e texto, e o contador passa a ser a porta
 * para o resto.
 *
 * Os comentários vêm no corpo da própria publicação (`post.recentComments`),
 * cortados e ordenados pela API. Não há pedido por publicação: uma feed que
 * buscasse conversa célula a célula fazia dez chamadas por ecrã.
 */

/** O rosto de quem comentou. Pequeno: o que se lê é o texto, não a cara. */
const AVATAR = 22
/**
 * O degrau de cada nível.
 *
 * A conversa desce em escada em vez de ficar numa coluna: duas mensagens
 * alinhadas à mesma margem leem-se como uma lista, e uma escada lê-se como
 * uma a responder à outra. 20 é o passo que ainda deixa linha de texto útil ao
 * terceiro degrau — acima disto a última mensagem fica estreita e parte em
 * demasiadas linhas.
 */
const STEP = 20
/** O ar entre duas mensagens. É também o que o cotovelo atravessa. */
const GAP = 10
/** A curva do cotovelo. Abaixo de 8 o canto lê-se como um bico. */
const ELBOW = 8

/**
 * O ramo que liga uma mensagem à seguinte.
 *
 * São duas peças, e cada uma pertence à linha que a desenha — nenhuma precisa
 * de saber a altura da outra, que é variável (o texto quebra em uma ou duas
 * linhas):
 *
 *   `tail`    desce do rosto até ao fim da própria linha
 *   `elbow`   começa um `GAP` acima da sua linha — exactamente onde a anterior
 *             acabou — e curva para dentro do rosto desta
 *
 * As duas encostam no limite entre as linhas, e o ramo lê-se contínuo sem que
 * ninguém meça nada.
 */
function Branch({ index, last }: { index: number; last: boolean }) {
  const eixo = index * STEP + AVATAR / 2
  return (
    <>
      {index > 0 && (
        <View
          pointerEvents="none"
          style={[
            s.elbow,
            {
              left: (index - 1) * STEP + AVATAR / 2,
              top: -GAP,
              height: GAP + AVATAR / 2,
              width: STEP - AVATAR / 2 + 1,
            },
          ]}
        />
      )}
      {!last && <View pointerEvents="none" style={[s.tail, { left: eixo, top: AVATAR }]} />}
    </>
  )
}

interface Props {
  post: Post
  /** Abrir a conversa toda. É para onde o contador leva. */
  onOpenAll: () => void
  onOpenAuthor: (userId: string) => void
}

export default function HomeCommentThread({ post, onOpenAll, onOpenAuthor }: Props) {
  const t = useT()
  const comments = post.recentComments ?? []
  const total = post._count?.comments ?? 0

  if (comments.length === 0) {
    // Sem conversa não há nada a dizer. Um "sê o primeiro a comentar" ocupava
    // uma linha em cada publicação da feed para pedir o que o ícone já pede.
    return null
  }

  const restantes = total - comments.length

  return (
    <View style={s.wrap}>
      {comments.map((comment, index) => (
        <View
          key={comment.id}
          style={[s.row, index > 0 && { marginTop: GAP }]}
        >
          {/* O ramo fica fora do conteúdo deslocado: em Yoga um filho absoluto
              conta a partir da caixa de conteúdo do pai, e com `paddingLeft` na
              linha as contas do cotovelo saíam todas deslocadas um degrau. */}
          <Branch index={index} last={index === comments.length - 1} />
          <View style={[s.content, { marginLeft: index * STEP }]}>
            <TouchableOpacity
              onPress={() => onOpenAuthor(comment.user.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={comment.user.name}
            >
              <AvatarImage uri={comment.user.avatar} name={comment.user.name} size={AVATAR} />
            </TouchableOpacity>
            {/* Duas linhas, e o resto fica atrás do contador. É isto que impede
                o cartão de crescer com o tamanho do que alguém escreveu. */}
            <Text style={s.text} numberOfLines={2}>
              <Text style={s.name} onPress={() => onOpenAuthor(comment.user.id)}>
                {comment.user.name}
              </Text>
              {'  '}{comment.content}
            </Text>
          </View>
        </View>
      ))}

      {restantes > 0 && (
        <TouchableOpacity
          style={s.more}
          onPress={onOpenAll}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t.home_see_comments.replace('{count}', String(total))}
        >
          <Text style={s.moreText}>{t.home_see_comments.replace('{count}', String(total))}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: { position: 'relative' },
  content: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, color: pageInk.primary, ...homeType.caption },
  name: { color: pageInk.primary, ...homeType.captionAuthor },

  // ── O ramo ────────────────────────────────────────────────────────────────
  // Desenhado a bordas e não em SVG: são duas linhas de um pixel e uma curva,
  // e um SVG por mensagem seria uma superfície nova em cada célula da feed.
  tail: {
    position: 'absolute',
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: pageLine,
  },
  elbow: {
    position: 'absolute',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: pageLine,
    borderBottomLeftRadius: ELBOW,
  },

  more: { marginTop: GAP, minHeight: 28, justifyContent: 'center' },
  moreText: { color: pageInk.muted, ...homeType.caption },
})
