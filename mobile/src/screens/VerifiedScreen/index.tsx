import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'

type Nav = StackNavigationProp<AppStackParams>

export default function VerifiedScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()

  return (
    <View style={[s.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>conta verificada</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Locked state */}
      <View style={[s.body, { paddingBottom: bottom + 40 }]}>
        <Ionicons name="lock-closed-outline" size={52} color={colors.gray400} />
        <Text style={s.title}>página indisponível</Text>
        <Text style={s.sub}>
          Esta funcionalidade ainda não está disponível.{'\n'}
          Em breve poderás obter a tua conta verificada no luxee.
        </Text>
        <TouchableOpacity style={s.backLink} onPress={() => nav.goBack()} activeOpacity={0.7}>
          <Text style={s.backLinkText}>voltar ao perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2,
  },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 14,
  },
  title: {
    fontSize: 20, fontFamily: fonts.semiBold, color: colors.gray800,
    letterSpacing: -0.4, textAlign: 'center',
  },
  sub: {
    fontSize: 14, fontFamily: fonts.regular, color: colors.gray400,
    textAlign: 'center', lineHeight: 22,
  },
  backLink: { marginTop: 8 },
  backLinkText: {
    fontSize: 14, fontFamily: fonts.semiBold, color: colors.primary,
  },
})
