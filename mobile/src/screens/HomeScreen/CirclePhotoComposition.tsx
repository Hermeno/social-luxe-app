import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { colors } from '../../theme'
import { circleClusterLayout } from './circleCluster'

/**
 * Espessura do recorte entre discos sobrepostos.
 *
 * Não é uma moldura: é da cor do fundo. Serve só para dois discos que se tocam
 * não se fundirem num borrão — sem ele, duas fotografias escuras encostadas
 * lêem-se como uma mancha só. À volta da figura inteira não desenha nada, porque
 * é da cor do que está por baixo.
 */
const CUT = 3

interface Props {
  /** URLs já resolvidos, na ordem em que foram capturados. */
  urls: string[]
  /** Largura disponível — a altura sai da composição. */
  width: number
  /** Identidade da publicação: fixa a composição, que nunca muda entre renders. */
  postId: string
}

/**
 * A composição circular de um Círculo.
 *
 * É o elemento visual da publicação, não uma ilustração dentro dela: não leva
 * cartão, moldura, sombra nem fundo próprio. As fotografias assentam no branco
 * da página e a figura que formam é o post.
 *
 * A geometria vive em `circleCluster.ts`, separada de propósito — é matemática
 * pura, verificável sem montar nada, e foi assim que se apanhou o caso em que a
 * variação de tamanho empurrava um disco 4pt para fora da margem.
 */
export default function CirclePhotoComposition({ urls, width, postId }: Props) {
  const layout = useMemo(
    () => circleClusterLayout(urls.length, width, postId),
    [postId, urls.length, width],
  )

  return (
    <View style={{ width, height: layout.height }} pointerEvents="none">
      {layout.discs.map((disc, index) => (
        <View
          key={`${postId}-${index}`}
          style={[
            s.disc,
            {
              left: disc.x,
              top: disc.y,
              width: disc.d,
              height: disc.d,
              borderRadius: disc.d / 2,
              zIndex: disc.z,
            },
          ]}
        >
          {urls[index] ? (
            <Image
              source={{ uri: urls[index] }}
              style={s.photo}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={`${postId}-${index}`}
              transition={140}
            />
          ) : (
            <View style={s.empty} />
          )}
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  disc: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: CUT,
    borderColor: colors.white,
    backgroundColor: colors.gray100,
  },
  photo: { width: '100%', height: '100%' },
  empty: { flex: 1, backgroundColor: colors.gray200 },
})
