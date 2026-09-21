import React from 'react'
import {
  Image, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions, type StyleProp, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import Icon from '../../../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { useT } from '../i18n'
import { control, GUTTER, GUTTER_NARROW, NARROW_WIDTH, space } from '../theme/tokens'

/**
 * A assinatura oficial, tratada como asset.
 *
 * O ficheiro é a caligrafia da marca a preto puro sobre transparente: a cor vem
 * sempre do `tintColor`. É por isso que o mesmo ficheiro serve o papel branco e
 * o tema escuro sem precisar de uma segunda exportação — e é por isso que nunca
 * se escreve "Luxey" numa fonte parecida: o logótipo não é uma palavra, é um
 * desenho.
 */
const WORDMARK = require('../../../../assets/files/luxee-wordmark.png')
const WORDMARK_RATIO = 1200 / 543
const WORDMARK_HEIGHT = 34

export function Wordmark({ height = WORDMARK_HEIGHT }: { height?: number }) {
  const { palette } = useTheme()
  return (
    <Image
      source={WORDMARK}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Luxey"
      style={{ height, width: height * WORDMARK_RATIO, tintColor: palette.ink }}
    />
  )
}

/**
 * O cabeçalho.
 *
 * Três posições: voltar à esquerda, assinatura ao centro, acção contextual à
 * direita. Nunca um indicador de progresso — os dois percursos desta
 * experiência têm comprimentos diferentes e os passos opcionais podem ser
 * saltados, por isso qualquer "3 de 5" estaria errado em metade dos casos. Um
 * passo mal contado é pior do que passo nenhum: mina a confiança em tudo o resto
 * que o ecrã afirma.
 *
 * As laterais têm largura reservada igual, senão a assinatura desloca-se de ecrã
 * para ecrã conforme haja ou não botão à direita.
 */
export function AuthHeader({
  onBack, right,
}: {
  onBack?: () => void
  right?: React.ReactNode
}) {
  const { palette } = useTheme()
  const t = useT()

  return (
    <View style={s.header}>
      <View style={s.headerSide}>
        {onBack && (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [s.headerTarget, { opacity: pressed ? 0.55 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t.back}
          >
            <Icon name="chevron-left" size={22} color={palette.ink} />
          </Pressable>
        )}
      </View>
      <Wordmark />
      <View style={[s.headerSide, s.headerRight]}>{right}</View>
    </View>
  )
}

interface Props {
  /** Título da tarefa. Vazio em A00. */
  title?: string
  intro?: string
  onBack?: () => void
  headerRight?: React.ReactNode
  children?: React.ReactNode
  /** Rodapé fixo — acompanha o teclado e nunca fica inalcançável. */
  footer?: React.ReactNode
  /**
   * Conteúdo que gere o seu próprio scroll (uma lista, uma grelha longa).
   * Nesse caso a casca não embrulha nada num ScrollView.
   */
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
}

/**
 * A casca de um ecrã da experiência.
 *
 * Garante o que os onze ecrãs têm em comum e nada do que os distingue: áreas
 * seguras, margem lateral, o bloco de título, e um rodapé que sobe com o
 * teclado. O meio é livre — um formulário curto, uma grelha de etiquetas e uma
 * lista de pessoas não têm por que ter a mesma composição, e forçá-la seria
 * fazer três tarefas diferentes parecerem a mesma.
 */
export default function AuthScreen({
  title, intro, onBack, headerRight, children, footer, scroll = true, contentStyle,
}: Props) {
  const { palette, text } = useTheme()
  const { top, bottom } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const gutter = width < NARROW_WIDTH ? GUTTER_NARROW : GUTTER

  const head = (title || intro) ? (
    <View style={s.titleBlock}>
      {!!title && (
        <Text
          // O título encolhe um degrau em ecrãs estreitos em vez de partir em
          // três linhas. É o único sítio onde o tamanho depende da largura.
          style={[text(width < NARROW_WIDTH ? 'titleSm' : 'title'), { color: palette.ink }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
      )}
      {!!intro && (
        <Text style={[text('intro'), { color: palette.inkMuted, marginTop: space.md }]}>
          {intro}
        </Text>
      )}
    </View>
  ) : null

  const body = (
    <View style={[{ paddingHorizontal: gutter }, contentStyle]}>
      {head}
      {children}
    </View>
  )

  return (
    <View style={[s.screen, { backgroundColor: palette.surface, paddingTop: top }]}>
      <View style={{ paddingHorizontal: gutter }}>
        <AuthHeader onBack={onBack} right={headerRight} />
      </View>

      <KeyboardAvoidingView
        style={s.fill}
        // No Android o `softwareKeyboardLayoutMode: pan` do app.json já move a
        // janela; somar `padding` empilhava os dois e abria um vazio por baixo
        // do rodapé.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={s.fill}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          <View style={s.fill}>{body}</View>
        )}

        {footer && (
          <View
            style={[
              s.footer,
              {
                paddingHorizontal: gutter,
                paddingBottom: Math.max(bottom, space.lg),
                // Opaco. O rodapé fica FORA do scroll — nada passa por baixo
                // dele hoje — mas um fundo transparente é o tipo de omissão que
                // só se nota no dia em que um ecrã precisa de o sobrepor.
                backgroundColor: palette.surface,
              },
            ]}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // As duas laterais medem o mesmo para a assinatura ficar mesmo ao centro.
  headerSide: { minWidth: 64, height: control.target, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTarget: {
    width: control.target,
    height: control.target,
    alignItems: 'center',
    justifyContent: 'center',
    // A tinta do glifo assenta na régua da página; a caixa de 48 estende-se
    // para fora dela, que é o que separa alvo de toque de alinhamento óptico.
    marginLeft: -(control.target - 22) / 2,
  },
  scrollContent: { paddingBottom: space.section, flexGrow: 1 },
  // O título arranca bem abaixo do cabeçalho: é o que o separa do cromado e o
  // faz ler-se como o começo da tarefa.
  titleBlock: { paddingTop: space.xxl, paddingBottom: space.block },
  footer: { paddingTop: space.md, gap: space.md },
})
