import React from 'react'
import { Image, StyleSheet, View } from 'react-native'

import { useTheme } from '../theme/ThemeProvider'
import { useT } from '../i18n'
import { BrandSpinner } from '../components/primitives'
import { Wordmark } from '../components/AuthScreen'
import { space } from '../theme/tokens'

/**
 * O símbolo oficial. Asset, não desenho — vale aqui o mesmo que para a
 * assinatura: é a arte a preto sobre transparente, tingida no sítio.
 */
const SYMBOL = require('../../../../assets/files/luxee-L-symbol.png')
const SYMBOL_SIZE = 72

/**
 * A00 — o arranque.
 *
 * Não é uma página de entrada. Não tem frase de marca, nem botão, nem
 * fotografia, nem carrossel de vantagens. É o estado em que a aplicação ainda
 * está a decidir o que mostrar, e a única coisa honesta a pôr nele é a
 * identidade e o sinal de que algo está a acontecer.
 *
 * O que se resolve por trás, antes de haver segunda pintura: o idioma guardado,
 * as preferências de tema, a sessão e — a partir dela — o destino. Pintar o
 * telefone e saltar para outro ecrã meio segundo depois é um flash que a pessoa
 * lê como avaria; e se a sessão anterior for de outra pessoa, é também conteúdo
 * de uma identidade que já não está ali.
 *
 * O anel é o único sítio do módulo onde a progressão da marca aparece.
 */
export default function BootScreen() {
  const { palette } = useTheme()
  const t = useT()

  return (
    <View style={[s.screen, { backgroundColor: palette.surface }]}>
      <View style={s.mark}>
        <Image
          source={SYMBOL}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={t.brand}
          style={{ width: SYMBOL_SIZE, height: SYMBOL_SIZE, tintColor: palette.ink }}
        />
        <Wordmark height={44} />
      </View>
      <View style={s.signal}>
        <BrandSpinner label={t.bootLabel} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // O conjunto fica ligeiramente acima do centro óptico: centrado à régua, um
  // bloco desta altura lê-se como se estivesse caído para baixo.
  mark: { alignItems: 'center', gap: space.lg, marginTop: -space.section },
  signal: { position: 'absolute', bottom: '22%' },
})
