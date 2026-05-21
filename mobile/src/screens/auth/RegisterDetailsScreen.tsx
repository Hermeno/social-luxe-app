import React, { useState } from 'react'
import { StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput, Alert, ScrollView, View, Text } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth.store'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { colors, spacing, radius, fonts } from '../../theme'
import ScreenEntry from '../../components/ScreenEntry'
type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'RegisterDetails'>

export default function RegisterDetailsScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { register } = useAuthStore()
  const { phone, countryCode } = route.params
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [secure, setSecure]     = useState(true)
  const [loading, setLoading]   = useState(false)

  async function handleRegister() {
    if (!name || !password || !confirm) return Alert.alert('Erro', 'Preencha todos os campos')
    setLoading(true)
    try { await register(name, phone, countryCode, password, confirm) } catch (e: unknown) { Alert.alert('Erro', e instanceof Error ? e.message : 'Falha no cadastro') } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.back} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <ScreenEntry style={s.top}>
          <Text style={s.logo}>luxe</Text>
          <Text style={s.heading}>Quase lá!</Text>
          <Text style={s.sub}>Escolha seu nome e crie uma senha</Text>
        </ScreenEntry>
        <View style={s.form}>
          <TextInput style={s.input} placeholder="Nome de exibição" placeholderTextColor={colors.gray400}
            value={name} onChangeText={setName} autoCapitalize="words" />
          <View style={s.inputRow}>
            <TextInput style={s.inputFlex} placeholder="Senha (mín. 6 caracteres)" placeholderTextColor={colors.gray400}
              value={password} onChangeText={setPassword} secureTextEntry={secure} />
            <TouchableOpacity onPress={() => setSecure(!secure)} style={s.eye}>
              <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.gray400} />
            </TouchableOpacity>
          </View>
          <TextInput style={s.input} placeholder="Confirmar senha" placeholderTextColor={colors.gray400}
            value={confirm} onChangeText={setConfirm} secureTextEntry />
          <TouchableOpacity
            style={[s.btn, (!name || !password || loading) && s.btnOff]}
            onPress={handleRegister}
            disabled={!name || !password || loading}
          >
            <Text style={s.btnText}>{loading ? 'Criando conta...' : 'Criar Conta'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: colors.white },
  container:{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: 80, gap: spacing.xl },
  back:     { position: 'absolute', top: 16, left: 0 },
  top:      { alignItems: 'center', gap: spacing.sm },
  logo:     { fontSize: 56, fontFamily: fonts.extraBold, color: colors.primary, letterSpacing: -2 },
  heading:  { fontSize: 22, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.4 },
  sub:      { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center' },
  form:     { gap: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, borderRadius: radius.md, paddingHorizontal: spacing.md },
  input:    { backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md, color: colors.gray800, fontSize: 15, fontFamily: fonts.medium },
  inputFlex:{ flex: 1, padding: spacing.md, color: colors.gray800, fontSize: 15, fontFamily: fonts.medium },
  eye:      { padding: spacing.sm },
  btn:      { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  btnOff:   { opacity: 0.45 },
  btnText:  { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
})
