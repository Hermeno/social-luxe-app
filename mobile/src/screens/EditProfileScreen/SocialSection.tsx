import React from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fonts } from '../../theme'
import { useT } from '../../i18n'
import { SOCIALS, SocialKey, SocialLinks, extractHandle } from '../../utils/social'

const T  = '#1A1A1A'
const M  = '#ABABAB'
const SX = '#F9F9FB'
const CARD_BD = '#EDEDF1'

interface Props {
  links: SocialLinks
  onChange: (next: SocialLinks) => void
}

export default function SocialSection({ links, onChange }: Props) {
  const t = useT()

  function set(key: SocialKey, raw: string) {
    const handle = extractHandle(key, raw)
    const next = { ...links }
    if (handle) next[key] = handle
    else delete next[key]
    onChange(next)
  }

  return (
    <>
      <Text style={s.sectionLabel}>{t.sl_title}</Text>
      <View style={s.card}>
        {SOCIALS.map((d, i) => (
          <View key={d.key}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.row}>
              {/* O quadrado leva a cor da marca — é o que torna a linha legível de relance */}
              <View style={[s.badge, { backgroundColor: d.color }]}>
                <Ionicons name={d.icon} size={15} color="#fff" />
              </View>
              <Text style={s.label}>{d.label}</Text>
              <View style={s.inputWrap}>
                {!!d.prefix && <Text style={s.prefix}>{d.prefix}</Text>}
                <TextInput
                  style={s.input}
                  value={links[d.key] ?? ''}
                  onChangeText={(v) => set(d.key, v)}
                  placeholder={d.key === 'website' ? 'exemplo.com' : t.sl_handle_ph}
                  placeholderTextColor={M}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={60}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text style={s.hint}>{t.sl_hint}</Text>
    </>
  )
}

const s = StyleSheet.create({
  sectionLabel: {
    fontFamily: fonts.bold, fontSize: 11, color: M,
    letterSpacing: 1, textTransform: 'uppercase',
    paddingLeft: 6, paddingBottom: 8, marginTop: 16,
  },
  card: {
    backgroundColor: SX, borderRadius: 18,
    borderWidth: 1, borderColor: CARD_BD, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: CARD_BD, marginLeft: 52 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, gap: 10,
  },
  badge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  label: { fontFamily: fonts.semiBold, fontSize: 13.5, color: T, width: 74, flexShrink: 0 },

  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  prefix: { fontFamily: fonts.regular, fontSize: 14, color: M },
  input:  { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: T, padding: 0 },

  hint: {
    fontFamily: fonts.regular, fontSize: 12, color: M,
    marginTop: 7, marginHorizontal: 4, lineHeight: 16,
  },
})
