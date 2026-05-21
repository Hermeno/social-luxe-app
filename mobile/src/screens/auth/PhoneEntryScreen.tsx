import React, { useState } from 'react'
import { StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, View, Alert, Text } from 'react-native'
import PhoneInput from 'react-native-phone-number-input'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { colors, spacing, radius, fonts } from '../../theme'
import ScreenEntry from '../../components/ScreenEntry'
type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'PhoneEntry'>

export default function PhoneEntryScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const mode  = route.params?.mode ?? 'login'
  const isLogin = mode === 'login'
  const [phone, setPhone] = useState(''); const [code, setCode] = useState('+244')

  function handleContinue() {
    if (!phone) return Alert.alert('Atenção', 'Insira seu número de telefone')
    if (isLogin) nav.navigate('LoginPassword', { phone, countryCode: code })
    else         nav.navigate('RegisterDetails', { phone, countryCode: code })
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenEntry style={s.container}>
        <View style={s.top}>
          <Text style={s.logo}>luxe</Text>
          <Text style={s.heading}>{isLogin ? 'Bem‑vindo de volta' : 'Criar sua conta'}</Text>
          <Text style={s.sub}>Insira seu número de telefone para continuar</Text>
        </View>
        <View style={s.form}>
          <PhoneInput defaultCode="AO" layout="first"
            onChangeFormattedText={setPhone}
            onChangeCountry={(c) => setCode(`+${c.callingCode[0]}`)}
            containerStyle={s.phoneBox} textContainerStyle={s.phoneText}
            textInputStyle={{ color: colors.gray800, fontFamily: fonts.medium }}
            codeTextStyle={{ color: colors.gray800, fontFamily: fonts.medium }}
            flagButtonStyle={{ backgroundColor: colors.gray100 }}
          />
          <TouchableOpacity style={[s.btn, !phone && s.btnOff]} onPress={handleContinue} disabled={!phone}>
            <Text style={s.btnText}>Continuar</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => nav.navigate('PhoneEntry', { mode: isLogin ? 'register' : 'login' })}>
          <Text style={s.link}>
            {isLogin ? 'Novo por aqui?  ' : 'Já tem conta?  '}
            <Text style={s.linkBold}>{isLogin ? 'Criar conta' : 'Entrar'}</Text>
          </Text>
        </TouchableOpacity>
      </ScreenEntry>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: colors.white },
  container:{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xl },
  top:      { alignItems: 'center', gap: spacing.sm },
  logo:     { fontSize: 56, fontFamily: fonts.extraBold, color: colors.primary, letterSpacing: -2 },
  heading:  { fontSize: 22, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.4 },
  sub:      { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center' },
  form:     { gap: spacing.md },
  phoneBox: { backgroundColor: colors.gray100, borderRadius: radius.md, width: '100%', borderWidth: 0 },
  phoneText:{ backgroundColor: colors.gray100, borderRadius: radius.md },
  btn:      { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  btnOff:   { opacity: 0.45 },
  btnText:  { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  link:     { color: colors.gray400, fontFamily: fonts.regular, textAlign: 'center' },
  linkBold: { color: colors.primary, fontFamily: fonts.bold },
})
