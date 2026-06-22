import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TravelStats as TStats } from '../../types'
import { fonts } from '../../theme'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('')
}

interface Props { stats: TStats }

export default function TravelStats({ stats }: Props) {
  const items = [
    { icon: '🌍', value: String(stats.totalCountries),   label: 'Países' },
    { icon: '👁',  value: fmt(stats.totalViews),          label: 'Views' },
    { icon: '💬', value: fmt(stats.totalComments),        label: 'Comentários' },
    { icon: '🎒', value: String(stats.totalObjects),      label: 'Objetos' },
    stats.lastCountry
      ? { icon: countryFlag(stats.lastCountry.code), value: stats.lastCountry.name, label: 'Último' }
      : null,
    stats.mostActiveCountry
      ? { icon: '🔥', value: stats.mostActiveCountry.name, label: 'Mais ativo' }
      : null,
  ].filter(Boolean) as { icon: string; value: string; label: string }[]

  return (
    <View style={s.container}>
      {items.map((item) => (
        <View key={item.label} style={s.row}>
          <Text style={s.icon}>{item.icon}</Text>
          <Text style={s.value}>{item.value}</Text>
          <Text style={s.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius:    14,
    padding:         12,
    gap:             7,
    minWidth:        160,
  },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  icon:  { fontSize: 13, width: 20, textAlign: 'center' },
  value: { fontSize: 12, fontFamily: fonts.semiBold, color: '#fff', flex: 1 },
  label: { fontSize: 10, fontFamily: fonts.regular,  color: 'rgba(255,255,255,0.6)' },
})
