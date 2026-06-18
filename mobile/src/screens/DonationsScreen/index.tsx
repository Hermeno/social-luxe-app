import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { TouchableOpacity } from 'react-native'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, fonts } from '../../theme'

export default function DonationsScreen() {
  const { top } = useSafeAreaInsets()
  const nav = useNavigation()
  const canGoBack = nav.canGoBack()

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: top + 12 }]}>
        {canGoBack
          ? <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={26} color={colors.dark} />
            </TouchableOpacity>
          : <View style={{ width: 26 }} />
        }
        <Text style={s.headerTitle}>Piedade</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Content */}
      <View style={s.body}>
        <LinearGradient
          colors={['#CA2851', '#FF6766', '#FFB173']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.iconWrap}
        >
          <Feather name="hexagon" size={36} color="#fff" />
        </LinearGradient>

        <Text style={s.title}>Funcionalidade indisponível</Text>
        <Text style={s.sub}>
          Esta secção está em desenvolvimento e será lançada em breve.{'\n'}
          Fique atento às atualizações do luxee.
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.dark,
    letterSpacing: -0.2,
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    gap: 16,
  },

  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.dark,
    letterSpacing: -0.4,
    textAlign: 'center',
  },

  sub: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
})
