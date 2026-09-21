import React, { useCallback, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useFonts } from 'expo-font'

import AuthNextExperience from '..'

/**
 * O anfitrião de desenvolvimento.
 *
 * Existe para a experiência poder correr sozinha, sem tocar no `App.tsx` da
 * aplicação nem no seu `package.json`. Faz só o que um anfitrião tem de fazer:
 * carregar as faces da marca, montar os providers nativos que o módulo espera
 * encontrar (gestos, áreas seguras, teclado) e receber o resultado.
 *
 * Não é a aplicação, e nota-se: o que aparece depois de `onComplete` é uma linha
 * de texto a dizer com que resultado o módulo terminou. Desenhar aqui uma Home
 * seria exactamente o que o contrato proíbe — e daria a ilusão de um produto
 * acabado onde só há uma ponte.
 */
export default function DevApp() {
  const [fontsLoaded] = useFonts({
    'Jakarta-Light':      require('../../../../assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Light.ttf'),
    'Jakarta-Regular':    require('../../../../assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Regular.ttf'),
    'Jakarta-Medium':     require('../../../../assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Medium.ttf'),
    'Jakarta-SemiBold':   require('../../../../assets/Plus_Jakarta_Sans/static/PlusJakartaSans-SemiBold.ttf'),
    'Jakarta-Bold':       require('../../../../assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Bold.ttf'),
    'Jakarta-ExtraBold':  require('../../../../assets/Plus_Jakarta_Sans/static/PlusJakartaSans-ExtraBold.ttf'),
  })

  const [outcome, setOutcome] = useState<string | null>(null)
  const onComplete = useCallback((result: { reason: string; completedOptional: boolean }) => {
    setOutcome(`${result.reason} · optional=${result.completedOptional}`)
  }, [])

  // Sem as faces carregadas o primeiro frame sairia na fonte do sistema e
  // trocaria depois. O A00 existe para esconder esperas destas, mas esta é do
  // anfitrião e tem de ser resolvida antes de ele montar o módulo.
  if (!fontsLoaded) return <View style={s.blank} />

  return (
    <GestureHandlerRootView style={s.fill}>
      <SafeAreaProvider>
        <KeyboardProvider>
          {outcome ? (
            <View style={s.done}>
              <Text style={s.doneText}>onComplete({outcome})</Text>
            </View>
          ) : (
            <AuthNextExperience onComplete={onComplete} />
          )}
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  blank: { flex: 1, backgroundColor: '#FFFFFF' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  doneText: { fontFamily: 'Jakarta-Medium', fontSize: 14, color: '#737373' },
})
