import React from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import AuthorAvatar from '../../components/AuthorAvatar'
import { colors, radius, spacing } from '../../theme'
import type { ActiveCircle } from '../../services/circle.service'
import { feedInk, feedType } from './tokens'

const AVATAR = 52
const RING_WIDTH = 1.5
const RING_GAP = 2
/** Lado da caixa do avatar depois do anel — o `AuthorAvatar` desenha-o por fora. */
const OUTER = AVATAR + (RING_WIDTH + RING_GAP) * 2
const LABEL_GAP = spacing.xs2
const ITEM_WIDTH = 68

/**
 * Altura ocupada pela fila, sem as folgas de cima e de baixo.
 *
 * Exportada porque não é só esta fila que precisa dela: a mídia do post desce
 * por baixo desta faixa, e as duas medidas têm de sair do mesmo número. Escrita
 * duas vezes, bastava mexer numa para a fotografia passar a entrar por baixo dos
 * rostos ou a deixar uma banda vazia entre as duas.
 */
export const FEED_CIRCLE_BAR_HEIGHT = OUTER + LABEL_GAP + feedType.meta.lineHeight

interface Props {
  circles: ActiveCircle[]
  onPress: (circle: ActiveCircle) => void
}

/**
 * Os Círculos que estão a acontecer agora, em fila no topo da Feed.
 *
 * Um Círculo aqui não é um álbum já publicado — é uma sessão aberta, gente
 * reunida neste momento. Por isso a fila mostra rostos e não capas: o que se
 * decide ao olhar para ela é *com quem*, não *o quê*.
 *
 * O anel cromático não é decoração de estado; é a única marca que distingue esta
 * fila de uma lista de contactos qualquer. Vem do `AuthorAvatar`, o mesmo
 * componente que desenha o anel do autor dentro do post — a geometria do anel
 * está centralizada lá justamente para não variar de espessura entre superfícies.
 *
 * Nem tudo o que aparece aqui está vivo. Quando não há sessões abertas que
 * cheguem, a API completa a fila com Círculos recentes já fechados — e é por isso
 * que o anel importa: aceso, está a acontecer agora; apagado, já aconteceu. O
 * `AuthorAvatar` reserva a caixa do anel mesmo quando o esconde, portanto os dois
 * estados medem o mesmo e a fila não dança quando uma sessão fecha.
 *
 * Sem Círculo nenhum para mostrar, o ecrã não guarda o espaço da fila: a mídia
 * volta a subir e a Feed fica exactamente como era. Uma faixa vazia à espera de
 * conteúdo custaria altura de fotografia todos os dias para servir uma coisa que
 * acontece em alguns.
 */
export default function FeedCircleBar({ circles, onPress }: Props) {
  return (
    <FlatList
      data={circles}
      horizontal
      keyExtractor={(circle) => circle.sessionId}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.content}
      style={s.list}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={s.item}
          onPress={() => onPress(item)}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`${item.host.name}, ${item.memberCount}`}
        >
          <View style={s.face}>
            <AuthorAvatar
              uri={item.host.avatar}
              name={item.host.name}
              avatarSize={AVATAR}
              ringWidth={RING_WIDTH}
              gap={RING_GAP}
              ringVisible={item.live}
              wellColor={colors.feedSurface}
            />
            {item.memberCount > 1 && (
              <View style={s.count}>
                <Text style={s.countTxt}>{item.memberCount}</Text>
              </View>
            )}
          </View>

          <Text style={[s.name, item.live && s.nameLive]} numberOfLines={1}>
            {item.host.name.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      )}
    />
  )
}

const s = StyleSheet.create({
  // `flexGrow: 0` para a fila medir o conteúdo e não esticar até ao fim do ecrã:
  // sem isto o `FlatList` horizontal reclama a altura toda que lhe derem.
  list:    { flexGrow: 0 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm2 },
  item:    { width: ITEM_WIDTH, alignItems: 'center' },
  face:    { width: OUTER, height: OUTER },
  // O número encosta ao anel e não o tapa: diz quantos estão lá dentro sem
  // esconder a cara de quem abriu.
  count: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.feedSurface,
  },
  countTxt: {
    ...feedType.badge,
    color: colors.white,
  },
  name: {
    marginTop: LABEL_GAP,
    maxWidth: ITEM_WIDTH,
    ...feedType.meta,
    color: feedInk.muted,
    textAlign: 'center',
  },
  // O nome acende com o anel. Sem isto, um Círculo antigo e um a acontecer agora
  // liam-se igual assim que o anel saísse, e a fila deixava de dizer o que é.
  nameLive: { color: feedInk.secondary },
})
