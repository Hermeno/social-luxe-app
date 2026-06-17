import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PT } from './pt'
import { EN } from './en'

export type Lang = 'pt' | 'en'

interface I18nStore {
  lang: Lang
  setLang: (l: Lang) => Promise<void>
  init: () => Promise<void>
}

export const useI18n = create<I18nStore>((set) => ({
  lang: 'pt',
  setLang: async (l) => {
    await AsyncStorage.setItem('@language', l)
    set({ lang: l })
  },
  init: async () => {
    const saved = await AsyncStorage.getItem('@language')
    if (saved === 'pt' || saved === 'en') { set({ lang: saved as Lang }); return }
    // No saved preference — detect device locale
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? ''
      if (locale.toLowerCase().startsWith('en')) set({ lang: 'en' })
    } catch {}
  },
}))

export type Strings = { [K in keyof typeof PT]: string }

export function useT(): Strings {
  const { lang } = useI18n()
  return lang === 'en' ? EN : PT
}
