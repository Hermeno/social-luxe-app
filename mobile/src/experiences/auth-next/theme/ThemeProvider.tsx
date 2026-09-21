import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'
import { Appearance, StyleSheet, type TextStyle } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  ACCENT_ORDER, brand, DEFAULT_TEXT_LEVEL, darkPalette, faceFor, lightPalette,
  TEXT_SCALE, type AccentKey, type Palette, type TypeRole, type as typeScale,
} from './tokens'

export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * As chaves de preferência.
 *
 * São exactamente as que o ecrã de Aparência da aplicação já lê e escreve —
 * `@theme`, `@text_size`, `@accent_color` — e com as mesmas formas de valor: o
 * modo em minúsculas, o tamanho como `"1"`..`"5"`, o acento em hexadecimal
 * maiúsculo da paleta oficial.
 *
 * Foi uma escolha, não um descuido. Inventar `@authnext_theme` faria a pessoa
 * escolher o tema duas vezes no mesmo produto, e deixaria a definição que ela
 * acabou de tomar invisível para o ecrã que existe para a mostrar. O risco do
 * lado oposto — escrever numa chave partilhada — está limitado: os dois lados
 * escrevem os mesmos valores e nenhum deles lê a chave do outro em ciclo.
 */
const KEY_THEME = '@theme'
const KEY_SIZE = '@text_size'
const KEY_ACCENT = '@accent_color'

interface ThemePrefs {
  mode: ThemeMode
  /** 1 a 5. O desenho aprovado é o 3. */
  textLevel: number
  accent: AccentKey
}

const DEFAULTS: ThemePrefs = { mode: 'auto', textLevel: DEFAULT_TEXT_LEVEL, accent: 'blue' }

export interface Theme {
  palette: Palette
  /** O esquema realmente em uso depois de resolver `auto`. */
  scheme: 'light' | 'dark'
  accent: string
  accentKey: AccentKey
  prefs: ThemePrefs
  /** Um papel tipográfico já com o tamanho da pessoa aplicado. */
  text: (role: TypeRole) => TextStyle
  ready: boolean
  setMode: (mode: ThemeMode) => void
  setTextLevel: (level: number) => void
  setAccent: (accent: AccentKey) => void
}

const ThemeContext = createContext<Theme | null>(null)

function accentKeyFromHex(hex: string | null | undefined): AccentKey | null {
  if (!hex) return null
  const upper = hex.trim().toUpperCase()
  const found = ACCENT_ORDER.find((key) => brand[key].toUpperCase() === upper)
  return found ?? null
}

/**
 * O tema desta experiência — e só desta.
 *
 * Implementa o X01 a sério dentro do módulo: o que a pessoa escolhe muda os
 * ecrãs do módulo no instante, sobrevive a um reinício e é lido de volta no
 * arranque. O que NÃO faz é prometer que muda a aplicação inteira: os ecrãs
 * antigos não consomem estes tokens, e dizer o contrário seria mentir sobre o
 * alcance da escolha. A preferência fica guardada nas chaves que o produto já
 * usa, à espera de quem a queira aplicar mais além.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULTS)
  const [ready, setReady] = useState(false)
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    let alive = true
    AsyncStorage.multiGet([KEY_THEME, KEY_SIZE, KEY_ACCENT])
      .then(([[, mode], [, size], [, accent]]) => {
        if (!alive) return
        const level = Number(size)
        setPrefs({
          mode: mode === 'light' || mode === 'dark' || mode === 'auto' ? mode : DEFAULTS.mode,
          textLevel: Number.isFinite(level) && level >= 1 && level <= 5 ? level : DEFAULTS.textLevel,
          accent: accentKeyFromHex(accent) ?? DEFAULTS.accent,
        })
      })
      .catch(() => {})
      .finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light')
    })
    return () => sub.remove()
  }, [])

  const setMode = useCallback((mode: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, mode }))
    AsyncStorage.setItem(KEY_THEME, mode).catch(() => {})
  }, [])

  const setTextLevel = useCallback((textLevel: number) => {
    const clamped = Math.max(1, Math.min(5, Math.round(textLevel)))
    setPrefs((prev) => ({ ...prev, textLevel: clamped }))
    AsyncStorage.setItem(KEY_SIZE, String(clamped)).catch(() => {})
  }, [])

  const setAccent = useCallback((accent: AccentKey) => {
    setPrefs((prev) => ({ ...prev, accent }))
    AsyncStorage.setItem(KEY_ACCENT, brand[accent].toUpperCase()).catch(() => {})
  }, [])

  const value = useMemo<Theme>(() => {
    const scheme = prefs.mode === 'auto' ? systemScheme : prefs.mode
    const palette = scheme === 'dark' ? darkPalette : lightPalette
    const factor = TEXT_SCALE[prefs.textLevel - 1] ?? 1

    // O papel tipográfico resolvido: tamanho, entrelinha e face de uma só vez.
    // Os ecrãs nunca escrevem `fontSize`; pedem um papel.
    const text = (role: TypeRole): TextStyle => {
      const token = typeScale[role]
      return {
        fontFamily: faceFor(token.weight),
        fontSize: Math.round(token.size * factor),
        lineHeight: Math.round(token.line * factor),
        // O multiplicador do sistema continua a valer por cima deste; o que a
        // escala do X01 faz é mover o ponto de partida, não substituí-lo.
        color: palette.ink,
      }
    }

    return {
      palette,
      scheme,
      accent: brand[prefs.accent],
      accentKey: prefs.accent,
      prefs,
      text,
      ready,
      setMode,
      setTextLevel,
      setAccent,
    }
  }, [prefs, ready, setAccent, setMode, setTextLevel, systemScheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme fora de <ThemeProvider>')
  return value
}

/** Traço de meio pixel — separadores que não engordam em ecrãs densos. */
export const hairline = StyleSheet.hairlineWidth
