import { create } from 'zustand'
import { NativeModules, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PT } from './pt'
import { EN } from './en'

export type Lang = 'pt' | 'en'

interface I18nStore {
  lang: Lang
  setLang: (l: Lang) => Promise<void>
  init: () => Promise<void>
}

// Idioma do sistema sem dependência extra: o módulo nativo já vem com o React
// Native. Qualquer variante de português (pt, pt-PT, pt-AO, pt-BR) conta como
// `pt`; tudo o resto cai em inglês.
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

export const useI18n = create<I18nStore>((set) => ({
  lang: 'en',                       // English is always the default
  setLang: async (l) => {
    await AsyncStorage.setItem('@language', l)
    set({ lang: l })
  },
  init: async () => {
    // A preferência guardada manda sempre.
    const saved = await AsyncStorage.getItem('@language')
    if (saved === 'pt' || saved === 'en') { set({ lang: saved as Lang }); return }
    // Sem preferência: segue o idioma do telemóvel. Substitui o ecrã de escolha
    // que corria antes da entrada — quem quiser trocar tem Definições → Idioma.
    set({ lang: deviceLang() })
  },
}))

export type Strings = { [K in keyof typeof PT]: string }

export function useT(): Strings {
  const { lang } = useI18n()
  return lang === 'en' ? EN : PT
}
