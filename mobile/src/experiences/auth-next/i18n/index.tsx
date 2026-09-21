import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { NativeModules, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { PT, type Strings } from './pt'
import { EN } from './en'

export type Lang = 'pt' | 'en'

export type { Strings }

/**
 * A chave de idioma é a que a aplicação já usa.
 *
 * Trocar a língua aqui e a app abrir noutra seria o mesmo produto a discordar de
 * si próprio. Partilhamos a chave — `@language` — e as duas formas de valor
 * (`'pt'` / `'en'`); o que não partilhamos é o dicionário, que é novo.
 */
const KEY_LANG = '@language'

/** O idioma do telemóvel, lido pelo mesmo caminho que a aplicação já usa. */
function deviceLang(): Lang {
  try {
    const settings = (NativeModules as any).SettingsManager?.settings
    const raw: unknown = Platform.OS === 'ios'
      ? (settings?.AppleLocale ?? settings?.AppleLanguages?.[0])
      : (NativeModules as any).I18nManager?.localeIdentifier
    return typeof raw === 'string' && raw.toLowerCase().startsWith('pt') ? 'pt' : 'en'
  } catch {
    return 'en'
  }
}

interface I18nValue {
  lang: Lang
  t: Strings
  ready: boolean
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * O idioma do módulo.
 *
 * O `ready` existe para o A00 poder esperar: pintar o primeiro ecrã em inglês e
 * trocar para português no frame seguinte é um flash que se vê, e a pessoa lê-o
 * como um erro da aplicação.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(KEY_LANG)
      .then((saved) => {
        if (!alive) return
        if (saved === 'pt' || saved === 'en') setLangState(saved)
        else setLangState(deviceLang())
      })
      .catch(() => { if (alive) setLangState(deviceLang()) })
      .finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    AsyncStorage.setItem(KEY_LANG, next).catch(() => {})
  }, [])

  const value = useMemo<I18nValue>(() => ({
    lang,
    t: lang === 'pt' ? PT : EN,
    ready,
    setLang,
  }), [lang, ready, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n fora de <I18nProvider>')
  return value
}

export function useT(): Strings {
  return useI18n().t
}

/** `fill(t.x, { count: 3 })` — substituição de marcadores sem dependência. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.keys(values).reduce(
    (out, key) => out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(values[key])),
    template,
  )
}
