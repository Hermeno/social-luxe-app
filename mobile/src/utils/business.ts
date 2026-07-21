// ─── Conta profissional ───────────────────────────────────────────────────────
// Categorias e horário de funcionamento. Tal como os interesses e os rótulos de
// estado, a categoria é guardada em português (ID estável na base de dados) e
// traduzida só na apresentação — mudar de idioma nunca reescreve dados.

export type ProfileAction = 'call' | 'whatsapp' | 'message' | 'directions'

export const PROFILE_ACTIONS: ProfileAction[] = ['call', 'whatsapp', 'message', 'directions']

export interface DayHours {
  closed: boolean
  open:   string   // "08:00"
  close:  string   // "18:00"
}

export const BUSINESS_CATEGORIES: { value: string; en: string }[] = [
  { value: 'Restaurante',      en: 'Restaurant'      },
  { value: 'Padaria',          en: 'Bakery'          },
  { value: 'Mercearia',        en: 'Grocery'         },
  { value: 'Loja de roupa',    en: 'Clothing store'  },
  { value: 'Beleza',           en: 'Beauty'          },
  { value: 'Barbearia',        en: 'Barbershop'      },
  { value: 'Farmácia',         en: 'Pharmacy'        },
  { value: 'Serviços',         en: 'Services'        },
  { value: 'Transporte',       en: 'Transport'       },
  { value: 'Educação',         en: 'Education'       },
  { value: 'Saúde',            en: 'Health'          },
  { value: 'Tecnologia',       en: 'Technology'      },
  { value: 'Artista',          en: 'Artist'          },
  { value: 'Fotografia',       en: 'Photography'     },
  { value: 'Música',           en: 'Music'           },
  { value: 'Eventos',          en: 'Events'          },
  { value: 'Imobiliária',      en: 'Real estate'     },
  { value: 'Construção',       en: 'Construction'    },
  { value: 'Oficina',          en: 'Auto repair'     },
  { value: 'Outro',            en: 'Other'           },
]

export function categoryLabel(value: string | null | undefined, lang: string): string {
  if (!value) return ''
  if (lang !== 'en') return value
  return BUSINESS_CATEGORIES.find((c) => c.value === value)?.en ?? value
}

// Semana inteira fechada — ponto de partida do editor.
export function emptyHours(): DayHours[] {
  return Array.from({ length: 7 }, () => ({ closed: true, open: '09:00', close: '18:00' }))
}

export function normalizeHours(raw: unknown): DayHours[] | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null
  return raw.map((d: any) => ({
    closed: d?.closed === true,
    open:   typeof d?.open  === 'string' ? d.open  : '',
    close:  typeof d?.close === 'string' ? d.close : '',
  }))
}

function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export interface OpenState {
  open: boolean
  /** Minuto do dia em que o estado muda — para "fecha às 18:00" / "abre às 08:00". */
  until: string | null
}

// Aberto agora? Trata o negócio que atravessa a meia-noite (fecho <= abertura):
// nesse caso a janela de ontem ainda conta para as horas pequenas de hoje.
export function isOpenNow(hours: DayHours[] | null, now = new Date()): OpenState {
  if (!hours) return { open: false, until: null }

  const day  = now.getDay()               // 0 = domingo
  const mins = now.getHours() * 60 + now.getMinutes()

  const check = (dayIdx: number, offset: number): OpenState | null => {
    const d = hours[dayIdx]
    if (!d || d.closed) return null
    const o = toMinutes(d.open)
    const c = toMinutes(d.close)
    if (o == null || c == null) return null
    // Fecho <= abertura significa que atravessa a meia-noite
    const end = c <= o ? c + 1440 : c
    const t   = mins + offset
    return t >= o && t < end ? { open: true, until: d.close } : null
  }

  // Hoje, e a janela de ontem que possa ter transbordado para depois da meia-noite
  const today     = check(day, 0)
  if (today) return today
  const yesterday = check((day + 6) % 7, 1440)
  if (yesterday) return yesterday

  // Fechado — procura a próxima abertura nos 7 dias seguintes
  for (let i = 0; i < 7; i++) {
    const idx = (day + i) % 7
    const d   = hours[idx]
    if (!d || d.closed) continue
    const o = toMinutes(d.open)
    if (o == null) continue
    if (i > 0 || o > mins) return { open: false, until: d.open }
  }
  return { open: false, until: null }
}

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
