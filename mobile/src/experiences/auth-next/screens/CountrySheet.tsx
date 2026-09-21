import React, { useMemo, useRef, useState } from 'react'
import {
  FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Icon from '../../../components/Icon'
import { FieldFrame } from '../components/Field'
import { Radio } from '../components/choice'
import { useI18n, useT } from '../i18n'
import { useTheme, hairline } from '../theme/ThemeProvider'
import { COUNTRIES, countryName, searchCountries, type Country } from '../data/countries'
import { control, GUTTER, radius, space } from '../theme/tokens'

const ROW_HEIGHT = 68

/**
 * A02 — a folha de países.
 *
 * Sobe a partir do seletor do A01 e devolve o controlo lá. Nunca substitui o
 * ecrã: o número já escrito continua por baixo, e fechar sem escolher deixa
 * tudo exactamente como estava — nem o telefone, nem o foco, nem o país
 * anterior se perdem.
 *
 * A lista é virtualizada com altura fixa. São cinquenta e cinco linhas hoje, o
 * que ainda caberia numa lista simples, mas o catálogo cresce por acrescento e
 * uma lista não virtualizada só se nota tarde — quando já são trezentas.
 */
export default function CountrySheet({
  visible, selectedIso, onSelect, onClose,
}: {
  visible: boolean
  selectedIso: string
  onSelect: (country: Country) => void
  onClose: () => void
}) {
  const { palette, text } = useTheme()
  const { lang } = useI18n()
  const t = useT()
  const { bottom } = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const listRef = useRef<FlatList<Country>>(null)

  const results = useMemo(() => searchCountries(query), [query])

  function close() {
    setQuery('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        {/* O que está por baixo continua visível e escurecido: a folha é um
            passo lateral dentro da mesma tarefa, não outro ecrã. */}
        <Pressable
          style={[s.scrim, { backgroundColor: palette.scrim }]}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t.close}
        />

        <View style={[s.sheet, { backgroundColor: palette.surface, paddingBottom: bottom }]}>
          <View style={s.grabberWrap}>
            <View style={[s.grabber, { backgroundColor: palette.line }]} />
          </View>

          <View style={s.head}>
            <Text style={[text('row'), { color: palette.ink }]} accessibilityRole="header">
              {t.countryTitle}
            </Text>
            {/* Botão visível de fechar: arrastar para baixo pode coexistir, mas
                não pode ser a única saída — não se descobre sem se tentar. */}
            <Pressable
              onPress={close}
              style={({ pressed }) => [s.closeTarget, { opacity: pressed ? 0.55 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t.close}
            >
              <Icon name="close" size={20} color={palette.ink} />
            </Pressable>
          </View>

          <View style={s.searchWrap}>
            <FieldFrame focused={focused}>
              <View style={s.searchIcon}>
                <Icon name="search" size={18} color={focused ? palette.ink : palette.inkFaint} />
              </View>
              <TextInput
                style={[text('value'), s.searchInput, { color: palette.ink }]}
                placeholder={t.countrySearch}
                placeholderTextColor={palette.inkFaint}
                value={query}
                onChangeText={(value) => {
                  setQuery(value)
                  listRef.current?.scrollToOffset({ offset: 0, animated: false })
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel={t.countrySearch}
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => setQuery('')}
                  style={({ pressed }) => [s.clearTarget, { opacity: pressed ? 0.55 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t.clear}
                >
                  <Icon name="close" size={16} color={palette.inkMuted} />
                </Pressable>
              )}
            </FieldFrame>
          </View>

          <FlatList
            ref={listRef}
            data={results}
            keyExtractor={(item) => item.iso}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={12}
            windowSize={9}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            contentContainerStyle={s.listContent}
            ItemSeparatorComponent={() => (
              <View style={[s.separator, { backgroundColor: palette.line }]} />
            )}
            ListEmptyComponent={(
              <View style={s.empty}>
                <Text style={[text('intro'), { color: palette.inkMuted }]}>{t.countryEmpty}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const active = item.iso === selectedIso
              return (
                <Pressable
                  onPress={() => { onSelect(item); close() }}
                  style={({ pressed }) => [
                    s.row,
                    { backgroundColor: pressed ? palette.field : 'transparent' },
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={`${countryName(item, lang)}, ${item.code}`}
                  accessibilityState={{ selected: active, checked: active }}
                >
                  <Text style={s.flag}>{item.flag}</Text>
                  <View style={s.rowText}>
                    <Text style={[text('row'), { color: palette.ink }]} numberOfLines={1}>
                      {countryName(item, lang)}
                    </Text>
                    <Text style={[text('rowSub'), { color: palette.inkMuted }]}>{item.code}</Text>
                  </View>
                  <Radio selected={active} />
                </Pressable>
              )
            }}
          />
        </View>
      </View>
    </Modal>
  )
}

/** Quantos países há, para quem precise de saber sem importar a lista toda. */
export const COUNTRY_COUNT = COUNTRIES.length

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    // Alta o suficiente para se ver a lista sem parecer um ecrã inteiro. A folha
    // tem de deixar ver que há alguma coisa por trás dela.
    maxHeight: '84%',
    minHeight: '62%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
  },
  grabberWrap: { alignItems: 'center', paddingTop: space.md },
  grabber: { width: 36, height: 4, borderRadius: 2 },
  head: {
    height: 56,
    paddingLeft: GUTTER,
    paddingRight: GUTTER - (control.target - 20) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeTarget: {
    width: control.target, height: control.target,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: GUTTER, paddingBottom: space.lg },
  searchIcon: { width: control.target, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, paddingRight: space.md },
  clearTarget: {
    width: control.target, height: control.target,
    alignItems: 'center', justifyContent: 'center',
  },
  listContent: { paddingBottom: space.block },
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  // A bandeira é o glifo emoji do sistema — território, não ícone de interface.
  // É o mesmo desenho que o ecrã actual já mostra.
  flag: { fontSize: 26, lineHeight: 32, width: 34 },
  separator: { height: hairline, marginLeft: GUTTER + 34 + space.md },
  empty: { paddingHorizontal: GUTTER, paddingTop: space.block },
})
