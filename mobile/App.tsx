import 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useFonts } from 'expo-font'
import * as Location from 'expo-location'
import { Image, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import RootNavigator from './src/navigation/RootNavigator'
import LanguageOnboardingScreen from './src/screens/LanguageOnboardingScreen'
import { useAuthStore } from './src/store/auth.store'
import { useI18n } from './src/i18n'
import { useFriendsStore } from './src/store/friends.store'
import { useGuestStore } from './src/store/guest.store'
import { usePostFontsStore } from './src/store/postFonts.store'
import { getMyFollowerCount } from './src/services/follow.service'
import { api, onTokenExpired } from './src/services/api'

// Hold the native splash screen open until we explicitly release it.
// Must be called before any rendering occurs.
SplashScreen.preventAutoHideAsync().catch(() => {})

const DARK        = '#0E0E12'

function TokenExpiryWatcher() {
  const { logout } = useAuthStore()
  useEffect(() => {
    return onTokenExpired(() => { logout() })
  }, [])
  return null
}

function LocationSync() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return
    ;(async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync()
        if (status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        await api.put('/users/profile', {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        })
      } catch {}
    })()
  }, [isAuthenticated])

  return null
}

function LangInit() {
  const { init } = useI18n()
  useEffect(() => { init() }, [])
  return null
}

function FollowerPoller() {
  const { isAuthenticated } = useAuthStore()
  const { setFollowerCount } = useFriendsStore()

  useEffect(() => {
    if (!isAuthenticated) return
    const poll = async () => {
      try {
        setFollowerCount(await getMyFollowerCount())
      } catch {}
    }
    poll()
    const id = setInterval(poll, 60000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  return null
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Jakarta-Light':      require('./assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Light.ttf'),
    'Jakarta-Regular':    require('./assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Regular.ttf'),
    'Jakarta-Medium':     require('./assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Medium.ttf'),
    'Jakarta-SemiBold':   require('./assets/Plus_Jakarta_Sans/static/PlusJakartaSans-SemiBold.ttf'),
    'Jakarta-Bold':       require('./assets/Plus_Jakarta_Sans/static/PlusJakartaSans-Bold.ttf'),
    'Jakarta-ExtraBold':  require('./assets/Plus_Jakarta_Sans/static/PlusJakartaSans-ExtraBold.ttf'),
  })

  const { isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [defaultTab, setDefaultTab] = useState<'Feed' | 'Messages' | null>(null)
  // Idioma: no 1.º arranque (sem preferência guardada) mostramos o seletor.
  const [needsLanguage, setNeedsLanguage] = useState<boolean | null>(null)

  useEffect(() => { loadUser() }, [])

  // Cursivas das publicações de texto: pedidas aqui para já estarem prontas
  // quando a feed abrir, mas fora do `useFonts` — este não segura o splash.
  useEffect(() => { usePostFontsStore.getState().ensureLoaded() }, [])

  useEffect(() => {
    AsyncStorage.getItem('@language')
      .then((v) => setNeedsLanguage(!(v === 'pt' || v === 'en')))
      .catch(() => setNeedsLanguage(false))
  }, [])

  // Ao terminar sessão, volta sempre ao seletor de idioma (mesmo já tendo usado).
  const prevAuth = useRef(isAuthenticated)
  useEffect(() => {
    if (prevAuth.current && !isAuthenticated) setNeedsLanguage(true)
    prevAuth.current = isAuthenticated
  }, [isAuthenticated])

  useEffect(() => {
    // Nesta versão a feed é sempre o ecrã inicial (o seletor Feed/Chat está
    // escondido no Editar perfil). A preferência guardada fica intacta para
    // quando o seletor voltar — basta reler `default_tab` aqui.
    setDefaultTab('Feed')
  }, [])

  useEffect(() => {
    if (!isAuthenticated) { setOnboardingDone(null); return }
    AsyncStorage.getItem('onboarding_done')
      .then((v) => setOnboardingDone(v === '1'))
      .catch(() => setOnboardingDone(true))
  }, [isAuthenticated])

  // Quem chega sem sessão: perguntar se há acervo público. Uma vez por arranque
  // — ao terminar sessão mais tarde a porta é sempre a entrada normal. Fica
  // aqui, e não no RootNavigator, para a splash esperar por isto em vez de
  // piscar o ecrã de login antes de saltar para a vitrina.
  const guestMode = useGuestStore((g) => g.mode)
  const guestAsked = useRef(false)
  useEffect(() => {
    if (authLoading || isAuthenticated || guestAsked.current) return
    guestAsked.current = true
    useGuestStore.getState().bootstrap()
  }, [authLoading, isAuthenticated])

  const ready =
    fontsLoaded &&
    !authLoading &&
    defaultTab !== null &&
    needsLanguage !== null &&
    (isAuthenticated || guestMode !== 'checking') &&
    (!isAuthenticated || onboardingDone !== null)

  // Release the native splash only after the full app tree is painted.
  // useEffect fires post-commit, so the screen is already rendered when
  // the native splash fades — zero blank frames.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [ready])

  return (
    <GestureHandlerRootView style={s.root}>
      {/* KeyboardProvider: lê o inset real do teclado (WindowInsets IME no
          Android) em vez de o adivinhar por eventos. É o que permite ao
          KeyboardAvoidingView do keyboard-controller funcionar em edge-to-edge,
          onde o do React Native falha. Tem de envolver a app toda. */}
      <KeyboardProvider>
      <SafeAreaProvider style={s.root}>
        <StatusBar style="light" />
        {!ready ? (
          // Cobertura de arranque com o gradiente laranja da marca. Visível no
          // Expo Go (onde a splash nativa não é controlável); invisível em builds
          // standalone (a splash nativa cobre antes do hideAsync).
          <View style={s.cover}>
            <LinearGradient
              colors={['#FF6A00', '#FF7A1C', '#FFC58A']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Image
              source={require('./assets/files/luxee-L-symbol.png')}
              style={s.splashIcon}
              resizeMode="contain"
            />
            <Text style={s.splashText}>luxee</Text>
          </View>
        ) : needsLanguage ? (
          <LanguageOnboardingScreen onDone={() => setNeedsLanguage(false)} />
        ) : (
          <>
            <LangInit />
            <TokenExpiryWatcher />
            <FollowerPoller />
            <LocationSync />
            <RootNavigator
              onboardingDone={onboardingDone}
              setOnboardingDone={setOnboardingDone}
              defaultTab={defaultTab ?? 'Feed'}
            />
          </>
        )}
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: DARK },
  cover:      { flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  splashIcon: { width: 92, height: 92, tintColor: 'rgba(255,255,255,0.96)' },
  splashText: {
    position: 'absolute', bottom: 52,
    color: '#FFFFFF', fontSize: 28, fontFamily: 'Jakarta-Bold', letterSpacing: 8,
  },
})
