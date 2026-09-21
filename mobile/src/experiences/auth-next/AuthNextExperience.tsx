import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'

import { I18nProvider, useI18n } from './i18n'
import { ThemeProvider, useTheme } from './theme/ThemeProvider'
import BootScreen from './screens/BootScreen'
import PhoneScreen from './screens/PhoneScreen'
import SignInScreen from './screens/SignInScreen'
import PasswordScreen from './screens/PasswordScreen'
import IdentityScreen from './screens/IdentityScreen'
import PhotoScreen from './screens/PhotoScreen'
import InterestsScreen from './screens/InterestsScreen'
import SuggestionsScreen from './screens/SuggestionsScreen'
import LanguageScreen from './screens/LanguageScreen'
import AppearanceScreen from './screens/AppearanceScreen'
import { isOnboardingDone } from './adapters/profile.adapter'
import { currentUser, restoreSession, signOut } from './adapters/auth.adapter'
import { detectCountry, type Country } from './data/countries'
import type { Step } from './state/flow'

export interface AuthNextProps {
  /**
   * A ponte de saída.
   *
   * O módulo termina aqui e não decide para onde se vai a seguir. A Home, a feed
   * e o perfil não lhe pertencem — quem o montou é que sabe o que fazer com uma
   * sessão autenticada. Chamada uma só vez, com o motivo.
   */
  onComplete: (outcome: {
    reason: 'signedIn' | 'registered' | 'alreadySignedIn'
    /** A pessoa passou pelos passos opcionais ou saltou-os. */
    completedOptional: boolean
  }) => void
  /**
   * Onde entrar. Por omissão, o arranque — que resolve sessão e destino.
   * Serve para um host que já saiba que precisa só de um passo: a aplicação,
   * por exemplo, já restaurou a sessão antes de montar isto, e repetir o
   * arranque seria uma segunda chamada à API e um ecrã branco a mais.
   */
  initialStep?: Step
  /**
   * A saída para a vitrina pública, quando existe acervo para onde voltar.
   *
   * É o botão de voltar do A01 e mais nada. Sem ela o A01 não tem voltar —
   * que é o correcto quando não há nada atrás.
   */
  onExitToGuest?: () => void
}

/**
 * A experiência de autenticação, identidade e personalização.
 *
 * Onze ecrãs e uma máquina de estados linear. Não usa `react-navigation`: o
 * percurso é uma sequência com dois ramos (conta existente / conta nova) e um
 * componente que troca de ecrã diz isso melhor do que um navegador com um stack
 * a que se teria de dar rotas, nomes e um histórico que ninguém percorre. Também
 * evita tocar nos navegadores existentes, que é o que o contrato pede.
 *
 * O que este módulo NÃO contém, deliberadamente: Home, feed, perfil, navegação
 * principal, ecrã de permissões, página comemorativa e "a preparar o teu
 * algoritmo". A última coisa que faz é chamar `onComplete`.
 */
function Flow({ onComplete, initialStep, onExitToGuest }: AuthNextProps) {
  const { ready: langReady } = useI18n()
  const { ready: themeReady, scheme } = useTheme()

  const [step, setStep] = useState<Step>(initialStep ?? 'boot')

  // ── Rascunho ──────────────────────────────────────────────────────────────
  // Tudo em memória. Ver `state/flow.ts` para o porquê de cada nível.
  const [country, setCountry] = useState<Country>(detectCountry)
  const [localNumber, setLocalNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState<string | null>(null)
  const [photoUri, setPhotoUri] = useState<string | null>(null)

  /**
   * A senha vive fora do estado de render, de propósito.
   *
   * Numa `ref` não entra em nenhuma árvore de props, não aparece num despejo de
   * estado de um devtool e não sobrevive a nada: é escrita em A04, lida uma vez
   * no registo em A05 e apagada no mesmo instante. Nunca é escrita em disco.
   */
  const passwordRef = useRef('')
  const [passwordDraft, setPasswordDraft] = useState('')

  const finished = useRef(false)
  const finish = useCallback((reason: 'signedIn' | 'registered' | 'alreadySignedIn', completedOptional: boolean) => {
    if (finished.current) return
    finished.current = true
    passwordRef.current = ''
    setPasswordDraft('')
    setStep('done')
    onComplete({ reason, completedOptional })
  }, [onComplete])

  /**
   * Para onde vai quem já tem sessão.
   *
   * O destino sai do que a conta tem, não de um contador de passos: quem fechou
   * a app nas sugestões volta às sugestões, e não ao princípio.
   *
   * Serve o arranque E o login, de propósito. Entrar numa conta que ficou a
   * meio do onboarding tem de retomar o onboarding — dar por terminado só
   * porque a palavra-passe estava certa deixaria a pessoa sem fotografia, sem
   * interesses e sem maneira óbvia de lá voltar.
   */
  const resolveDestination = useCallback(async (
    reason: 'signedIn' | 'alreadySignedIn',
  ) => {
    if (await isOnboardingDone()) { finish(reason, true); return }
    const user = currentUser()
    if ((user?.interests?.length ?? 0) >= 3) { setStep('suggestions'); return }
    if (user?.avatar) { setStep('interests'); return }
    setStep('photo')
  }, [finish])

  // ── A00: resolver tudo antes da segunda pintura ───────────────────────────
  useEffect(() => {
    if (step !== 'boot' || !langReady || !themeReady) return
    let alive = true

    ;(async () => {
      const user = await restoreSession().catch(() => null)
      if (!alive) return
      if (!user) { setStep('phone'); return }
      await resolveDestination('alreadySignedIn')
    })()

    return () => { alive = false }
  }, [langReady, resolveDestination, step, themeReady])

  // ── Ramos ─────────────────────────────────────────────────────────────────
  const handleExists = useCallback((full: string) => { setPhone(full); setStep('signIn') }, [])
  const handleNew = useCallback((full: string) => { setPhone(full); setStep('password') }, [])

  const switchAccount = useCallback(() => {
    // Sair limpa a sessão anterior antes de voltar ao telefone: o ecrã seguinte
    // não pode mostrar nada de quem estava autenticado.
    void signOut().catch(() => {})
    setPhone('')
    setLocalNumber('')
    setStep('phone')
  }, [])

  const afterRegister = useCallback(() => {
    // A senha deixa de ser precisa no momento exacto em que a conta existe.
    passwordRef.current = ''
    setPasswordDraft('')
    setStep('photo')
  }, [])

  const statusBar = scheme === 'dark' ? 'light' : 'dark'

  return (
    <>
      <StatusBar style={statusBar} />
      {renderStep()}
    </>
  )

  function renderStep() {
    switch (step) {
      case 'boot':
      case 'done':
        return <BootScreen />

      case 'phone':
        return (
          <PhoneScreen
            country={country}
            localNumber={localNumber}
            onCountryChange={setCountry}
            onNumberChange={setLocalNumber}
            onExists={handleExists}
            onNew={handleNew}
            onBack={onExitToGuest}
          />
        )

      case 'signIn':
        return (
          <SignInScreen
            phone={phone}
            country={country}
            onSignedIn={() => { void resolveDestination('signedIn') }}
            onSwitchAccount={switchAccount}
            onBack={() => setStep('phone')}
          />
        )

      case 'password':
        return (
          <PasswordScreen
            value={passwordDraft}
            onChange={(value) => { passwordRef.current = value; setPasswordDraft(value) }}
            onContinue={() => setStep('identity')}
            onBack={() => {
              passwordRef.current = ''
              setPasswordDraft('')
              setStep('phone')
            }}
          />
        )

      case 'identity':
        return (
          <IdentityScreen
            name={name}
            handle={handle}
            phone={phone}
            country={country}
            password={passwordRef.current}
            onNameChange={setName}
            onHandleChange={setHandle}
            onRegistered={(assigned) => { setHandle(assigned); afterRegister() }}
            onBack={() => setStep('password')}
          />
        )

      case 'photo':
        return (
          <PhotoScreen
            photoUri={photoUri}
            onPhotoChange={setPhotoUri}
            onDone={() => setStep('interests')}
          />
        )

      case 'interests':
        return <InterestsScreen onDone={() => setStep('suggestions')} />

      case 'suggestions':
        return (
          <SuggestionsScreen
            onDone={() => setStep('language')}
            onSkip={() => setStep('language')}
          />
        )

      case 'language':
        return (
          <LanguageScreen
            onDone={() => setStep('appearance')}
            onSkip={() => finish('registered', false)}
            onBack={() => setStep('suggestions')}
          />
        )

      case 'appearance':
        return (
          <AppearanceScreen
            onDone={() => finish('registered', true)}
            onSkip={() => finish('registered', false)}
            onBack={() => setStep('language')}
          />
        )
    }
  }
}

/**
 * O ponto de montagem público.
 *
 * Traz os seus próprios providers de idioma e de tema — não herda nem substitui
 * os da aplicação. É isso que torna o módulo montável em qualquer sítio (o
 * arranque da app, um ecrã de definições, um harness de desenvolvimento) sem
 * arrastar contexto de fora.
 */
export default function AuthNextExperience(props: AuthNextProps) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <Flow {...props} />
      </ThemeProvider>
    </I18nProvider>
  )
}
