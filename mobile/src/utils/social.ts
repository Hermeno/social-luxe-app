import { Ionicons } from '@expo/vector-icons'

// ─── Redes sociais do perfil ──────────────────────────────────────────────────
// Guardamos handles, nunca URLs — o link é construído aqui. Colar
// "instagram.com/joao?igsh=..." não pode virar um link partido.
//
// As cores são as das próprias marcas, não invenções nossas: é o que torna cada
// botão reconhecível de relance. A paleta da luxee continua a mandar em tudo o
// resto do ecrã.

export type SocialKey =
  | 'whatsapp' | 'instagram' | 'facebook' | 'github'
  | 'linkedin' | 'tiktok' | 'youtube' | 'x' | 'website'

export interface SocialDef {
  key:    SocialKey
  label:  string
  icon:   keyof typeof Ionicons.glyphMap
  color:  string                       // cor da marca, fundo do botão
  prefix: string                       // mostrado no editor antes do campo
  url:    (handle: string) => string
}

// `whatsapp` fica de fora: já tem campo próprio na conta profissional.
export const SOCIALS: SocialDef[] = [
  {
    key: 'instagram', label: 'Instagram', icon: 'logo-instagram',
    color: '#E1306C', prefix: '@',
    url: (h) => `https://instagram.com/${h}`,
  },
  {
    key: 'facebook', label: 'Facebook', icon: 'logo-facebook',
    color: '#1877F2', prefix: '/',
    url: (h) => `https://facebook.com/${h}`,
  },
  {
    key: 'github', label: 'GitHub', icon: 'logo-github',
    color: '#181717', prefix: '@',
    url: (h) => `https://github.com/${h}`,
  },
  {
    key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin',
    color: '#0A66C2', prefix: '/in/',
    url: (h) => `https://linkedin.com/in/${h}`,
  },
  {
    key: 'tiktok', label: 'TikTok', icon: 'musical-notes',
    color: '#010101', prefix: '@',
    url: (h) => `https://tiktok.com/@${h}`,
  },
  {
    key: 'youtube', label: 'YouTube', icon: 'logo-youtube',
    color: '#FF0000', prefix: '@',
    url: (h) => `https://youtube.com/@${h}`,
  },
  {
    key: 'x', label: 'X', icon: 'close',
    color: '#000000', prefix: '@',
    url: (h) => `https://x.com/${h}`,
  },
  {
    key: 'website', label: 'Website', icon: 'globe-outline',
    color: '#5B5B60', prefix: '',
    // O utilizador escreve o domínio; o esquema entra aqui se faltar
    url: (h) => (/^https?:\/\//i.test(h) ? h : `https://${h}`),
  },
]

export type SocialLinks = Partial<Record<SocialKey, string>>

export function normalizeSocials(raw: unknown): SocialLinks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: SocialLinks = {}
  for (const def of SOCIALS) {
    const v = (raw as any)[def.key]
    if (typeof v === 'string' && v.trim()) out[def.key] = v.trim()
  }
  return out
}

// Aceita o que o utilizador colar e devolve só o handle. Cobre o caso comum de
// se colar o URL inteiro em vez do nome de utilizador.
export function extractHandle(key: SocialKey, raw: string): string {
  let v = raw.trim()
  if (key === 'website') return v.replace(/\s/g, '')
  v = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  // Fica com o último segmento não vazio do caminho, sem query string
  if (v.includes('/')) {
    const parts = v.split('?')[0].split('/').filter(Boolean)
    v = parts[parts.length - 1] ?? ''
  }
  return v.replace(/^@/, '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 40)
}
