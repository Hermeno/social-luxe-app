import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Keyboard, Platform } from 'react-native'

// ─── useKeyboardPad ───────────────────────────────────────────────────────────
// Devolve um Animated.Value com o espaço que é preciso abrir em baixo para o
// teclado. Usa-se como `paddingBottom` num contentor com flex: 1.
//
// Porque não KeyboardAvoidingView: em edge-to-edge (o defeito do SDK 54 no
// Android) o KAV mede o inset da barra de navegação como se fosse teclado e,
// com behavior="height", redimensiona em ciclo — a folha pisca.
//
// Porque não somar sempre a altura do teclado: se a janela já tiver encolhido
// sozinha, o padding soma-se a isso e o conteúdo salta o dobro, deixando um
// buraco entre ele e o teclado.
//
// O que fazemos: `endCoordinates.screenY` é onde começa o topo do teclado. A
// diferença para o fundo da janela é quanto o teclado tapa DE FACTO. Se a
// janela já encolheu, essa diferença é ~0 e não acrescentamos nada. Se não
// encolheu, é a altura do teclado. A mesma conta serve as duas plataformas.
export function useKeyboardPad(): Animated.Value {
  const pad = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const onShow = (e: any) => {
      const kbH     = e?.endCoordinates?.height ?? 0
      const screenY = e?.endCoordinates?.screenY
      const winH    = Dimensions.get('window').height

      // Sem screenY (raro) caímos na altura do teclado, que é o palpite seguro.
      const covered = typeof screenY === 'number'
        ? Math.min(kbH, Math.max(0, winH - screenY))
        : kbH

      Animated.timing(pad, {
        toValue: covered,
        duration: e?.duration ?? 220,
        useNativeDriver: false,
      }).start()
    }

    // Zero explícito: deixar o valor por conta da animação de fecho deixava um
    // resíduo de ~20px no Android.
    const onHide = (e: any) => {
      Animated.timing(pad, {
        toValue: 0,
        duration: e?.duration ?? 180,
        useNativeDriver: false,
      }).start()
    }

    const s1 = Keyboard.addListener(showEvt, onShow)
    const s2 = Keyboard.addListener(hideEvt, onHide)
    return () => { s1.remove(); s2.remove() }
  }, [])

  return pad
}
