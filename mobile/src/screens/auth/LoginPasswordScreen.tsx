import React, { useState } from 'react'
import { StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput, Alert, View, Text } from 'react-native'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth.store'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { colors, spacing, radius } from '../../theme'
import ScreenEntry from '../../components/ScreenEntry'
type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'LoginPassword'>
export default function LoginPasswordScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { login } = useAuthStore()
  const { phone } = route.params
  const [password, setPassword] = useState('')
  const [secure, setSecure]     = useState(true)
  const [loading, setLoading]   = useState(false)
  async function handleLogin() {
    if (!password) return
    setLoading(true)
    try { await login(phone, password) } catch (e: unknown) { Alert.alert('Erro', e instanceof Error ? e.message : 'Falha no login') } finally { setLoading(false) }
  }
  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenEntry style={s.container}>
        <TouchableOpacity style={s.back} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <View style={s.top}>
          <Text style={s.logo}>luxe</Text>
          <Text style={s.heading}>Qual é a sua senha?</Text>
          <Text style={s.sub}>{phone}</Text>
        </View>
        <View style={s.form}>
          <View style={s.inputRow}>
            <TextInput style={s.input} placeholder="Senha" placeholderTextColor={colors.gray400} value={password} onChangeText={setPassword} secureTextEntry={secure} />
            <TouchableOpacity onPress={() => setSecure(!secure)} style={s.eye}>
              <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.gray400} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.btn, (!password || loading) && s.btnOff]} onPress={handleLogin} disabled={!password || loading}>
            <Text style={s.btnText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
          </TouchableOpacity>
        </View>
      </ScreenEntry>
    </KeyboardAvoidingView>
  )
}
const s = StyleSheet.create({
  flex:     { flex: 1, backgroundColor: colors.white },
  container:{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xl },
  back:     { position: 'absolute', top: 60, left: spacing.xl },
  top:      { alignItems: 'center', gap: spacing.sm },
  logo:     { fontSize: 56, fontWeight: '800', color: colors.primary },
  heading:  { fontSize: 22, fontWeight: '700', color: colors.gray800 },
  sub:      { fontSize: 14, color: colors.gray400 },
  form:     { gap: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, borderRadius: radius.md, paddingHorizontal: spacing.md },
  input:    { flex: 1, padding: spacing.md, color: colors.gray800, fontSize: 15 }, eye: { padding: spacing.sm },
  btn:      { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  btnOff:   { opacity: 0.45 }, btnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
})
