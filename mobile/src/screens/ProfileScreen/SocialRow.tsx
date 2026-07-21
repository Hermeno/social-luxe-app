import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { fonts } from '../../theme'
import { useT } from '../../i18n'
import { SOCIALS, SocialLinks, normalizeSocials } from '../../utils/social'

// ─── Fila de redes sociais ────────────────────────────────────────────────────
// Cada botão leva a cor da própria marca — é isso que os torna reconhecíveis
// sem se ler o rótulo. Rola na horizontal para nunca partir a linha nem
// espremer os botões quando alguém preenche as nove.

interface Props {
  socialLinks: unknown
}

export default function SocialRow({ socialLinks }: Props) {
  const t = useT()
  const links: SocialLinks = normalizeSocials(socialLinks)
  const present = SOCIALS.filter((d) => !!links[d.key])
  if (present.length === 0) return null

  async function open(url: string) {
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert(t.error, t.bp_open_fail)
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.scroll}
      contentContainerStyle={s.content}
    >
      {present.map((d) => (
        <TouchableOpacity
          key={d.key}
          style={[s.btn, { backgroundColor: d.color }]}
          onPress={() => open(d.url(links[d.key]!))}
          activeOpacity={0.82}
        >
          <Ionicons name={d.icon} size={15} color="#fff" />
          <Text style={s.txt} numberOfLines={1}>{d.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll:  { flexGrow: 0, marginBottom: 14 },
  content: { paddingHorizontal: 16, gap: 8 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
  },
  txt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 13, letterSpacing: -0.1 },
})
