import React from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

// A assinatura da marca vive num só sítio — splash, feed, convidado, login e
// Sobre desenham todos daqui.
//
// O ficheiro é a caligrafia oficial sobre fundo TRANSPARENTE, com a arte a
// preto puro: a cor sai sempre do `tintColor`, nunca do PNG. É isso que deixa
// o mesmo asset servir a splash laranja, a feed escura e o Sobre claro sem
// exportar uma versão por fundo. Se algum dia for substituído, o novo ficheiro
// tem de manter o alfa — com fundo branco, o tint pinta o retângulo inteiro.
const SOURCE = require('../../assets/files/luxee-wordmark.png')

// Proporção do ficheiro já aparado (1200 × 543). Fixada aqui para que nenhum
// ecrã invente a sua e achate a caligrafia — num logo manuscrito a distorção
// lê-se de imediato.
//
// A caligrafia actual tem ascendente alto e descendente longo: o corpo das
// letras ocupa 38% da altura do ficheiro, contra 51% da anterior. Por isso as
// alturas pedidas pelos ecrãs subiram ~1,34× na troca — para a assinatura ficar
// do mesmo tamanho aos olhos, não do mesmo número.
const RATIO = 1200 / 543

type Props = {
  /** Altura da caligrafia em pontos. A largura sai da proporção. */
  height?: number
  color?: string
  /** Separação para quando a assinatura assenta sobre fotografia. */
  shadow?: boolean
  style?: StyleProp<ViewStyle>
}

export default function Wordmark({
  height = 28,
  color = '#FFFFFF',
  shadow = false,
  style,
}: Props) {
  return (
    <View style={[{ height, width: height * RATIO }, style]} pointerEvents="none">
      {/* A sombra é uma segunda cópia da própria caligrafia, deslocada por
          baixo. As sombras nativas não servem aqui: no Android seguem o fundo
          da view, e o fundo desta arte é transparente — não apareceria nada. */}
      {shadow && (
        <Image
          source={SOURCE}
          resizeMode="contain"
          style={[
            StyleSheet.absoluteFillObject,
            { width: '100%', height: '100%', tintColor: 'rgba(0,0,0,0.5)', transform: [{ translateY: 1.5 }] },
          ]}
        />
      )}
      <Image
        source={SOURCE}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Luxey"
        style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', tintColor: color }]}
      />
    </View>
  )
}
