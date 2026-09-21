import type { Lang } from '../i18n'

/**
 * O catálogo de países.
 *
 * Os pares ISO/indicativo são exactamente os que a aplicação já pratica no ecrã
 * de telefone actual — a mesma lista, os mesmos códigos, a mesma ordem de
 * cabeça (os países lusófonos primeiro, depois o resto por alfabeto). Tiveram
 * de ser reescritos aqui e não importados porque a lista original vive dentro
 * do componente do ecrã antigo e não é exportada; o módulo não pode editá-lo
 * para a expor.
 *
 * O que muda é uma coluna: o nome passa a existir nas duas línguas. A lista
 * antiga só tinha português, e um ecrã em inglês a listar "Alemanha" é uma
 * tradução por acabar.
 *
 * A selecção continua ancorada no ISO e não no indicativo — `+1` serve os
 * Estados Unidos e o Canadá, e uma lista com chave no indicativo faria os dois
 * acenderem-se ao mesmo tempo.
 */
export interface Country {
  /** Chave estável. Dois países podem partilhar indicativo; o ISO não. */
  iso: string
  /** Indicativo com `+`, tal como entra no número enviado à API. */
  code: string
  flag: string
  pt: string
  en: string
}

export const COUNTRIES: Country[] = [
  { iso: 'AO',  code: '+244',   flag: '🇦🇴', pt: 'Angola',                  en: 'Angola' },
  { iso: 'PT',  code: '+351',   flag: '🇵🇹', pt: 'Portugal',                en: 'Portugal' },
  { iso: 'MZ',  code: '+258',   flag: '🇲🇿', pt: 'Moçambique',              en: 'Mozambique' },
  { iso: 'BR',  code: '+55',    flag: '🇧🇷', pt: 'Brasil',                  en: 'Brazil' },
  { iso: 'US',  code: '+1',     flag: '🇺🇸', pt: 'Estados Unidos',          en: 'United States' },
  { iso: 'CV',  code: '+238',   flag: '🇨🇻', pt: 'Cabo Verde',              en: 'Cape Verde' },
  { iso: 'GW',  code: '+245',   flag: '🇬🇼', pt: 'Guiné-Bissau',            en: 'Guinea-Bissau' },
  { iso: 'GQ',  code: '+240',   flag: '🇬🇶', pt: 'Guiné Equatorial',        en: 'Equatorial Guinea' },
  { iso: 'ST',  code: '+239',   flag: '🇸🇹', pt: 'São Tomé e Príncipe',     en: 'São Tomé and Príncipe' },
  { iso: 'ZA',  code: '+27',    flag: '🇿🇦', pt: 'África do Sul',           en: 'South Africa' },
  { iso: 'DZ',  code: '+213',   flag: '🇩🇿', pt: 'Argélia',                 en: 'Algeria' },
  { iso: 'AR',  code: '+54',    flag: '🇦🇷', pt: 'Argentina',               en: 'Argentina' },
  { iso: 'AU',  code: '+61',    flag: '🇦🇺', pt: 'Austrália',               en: 'Australia' },
  { iso: 'BE',  code: '+32',    flag: '🇧🇪', pt: 'Bélgica',                 en: 'Belgium' },
  { iso: 'BO',  code: '+591',   flag: '🇧🇴', pt: 'Bolívia',                 en: 'Bolivia' },
  { iso: 'CA',  code: '+1',     flag: '🇨🇦', pt: 'Canadá',                  en: 'Canada' },
  { iso: 'CL',  code: '+56',    flag: '🇨🇱', pt: 'Chile',                   en: 'Chile' },
  { iso: 'CN',  code: '+86',    flag: '🇨🇳', pt: 'China',                   en: 'China' },
  { iso: 'CO',  code: '+57',    flag: '🇨🇴', pt: 'Colômbia',                en: 'Colombia' },
  { iso: 'CR',  code: '+506',   flag: '🇨🇷', pt: 'Costa Rica',              en: 'Costa Rica' },
  { iso: 'CU',  code: '+53',    flag: '🇨🇺', pt: 'Cuba',                    en: 'Cuba' },
  { iso: 'DK',  code: '+45',    flag: '🇩🇰', pt: 'Dinamarca',               en: 'Denmark' },
  { iso: 'EC',  code: '+593',   flag: '🇪🇨', pt: 'Equador',                 en: 'Ecuador' },
  { iso: 'ES',  code: '+34',    flag: '🇪🇸', pt: 'Espanha',                 en: 'Spain' },
  { iso: 'ET',  code: '+251',   flag: '🇪🇹', pt: 'Etiópia',                 en: 'Ethiopia' },
  { iso: 'FR',  code: '+33',    flag: '🇫🇷', pt: 'França',                  en: 'France' },
  { iso: 'GH',  code: '+233',   flag: '🇬🇭', pt: 'Gana',                    en: 'Ghana' },
  { iso: 'GR',  code: '+30',    flag: '🇬🇷', pt: 'Grécia',                  en: 'Greece' },
  { iso: 'IN',  code: '+91',    flag: '🇮🇳', pt: 'Índia',                   en: 'India' },
  { iso: 'ID',  code: '+62',    flag: '🇮🇩', pt: 'Indonésia',               en: 'Indonesia' },
  { iso: 'IE',  code: '+353',   flag: '🇮🇪', pt: 'Irlanda',                 en: 'Ireland' },
  { iso: 'IL',  code: '+972',   flag: '🇮🇱', pt: 'Israel',                  en: 'Israel' },
  { iso: 'IT',  code: '+39',    flag: '🇮🇹', pt: 'Itália',                  en: 'Italy' },
  { iso: 'JP',  code: '+81',    flag: '🇯🇵', pt: 'Japão',                   en: 'Japan' },
  { iso: 'KE',  code: '+254',   flag: '🇰🇪', pt: 'Quénia',                  en: 'Kenya' },
  { iso: 'MX',  code: '+52',    flag: '🇲🇽', pt: 'México',                  en: 'Mexico' },
  { iso: 'MA',  code: '+212',   flag: '🇲🇦', pt: 'Marrocos',                en: 'Morocco' },
  { iso: 'NG',  code: '+234',   flag: '🇳🇬', pt: 'Nigéria',                 en: 'Nigeria' },
  { iso: 'NO',  code: '+47',    flag: '🇳🇴', pt: 'Noruega',                 en: 'Norway' },
  { iso: 'NL',  code: '+31',    flag: '🇳🇱', pt: 'Países Baixos',           en: 'Netherlands' },
  { iso: 'PE',  code: '+51',    flag: '🇵🇪', pt: 'Peru',                    en: 'Peru' },
  { iso: 'PL',  code: '+48',    flag: '🇵🇱', pt: 'Polónia',                 en: 'Poland' },
  { iso: 'GB',  code: '+44',    flag: '🇬🇧', pt: 'Reino Unido',             en: 'United Kingdom' },
  { iso: 'RU',  code: '+7',     flag: '🇷🇺', pt: 'Rússia',                  en: 'Russia' },
  { iso: 'SN',  code: '+221',   flag: '🇸🇳', pt: 'Senegal',                 en: 'Senegal' },
  { iso: 'SE',  code: '+46',    flag: '🇸🇪', pt: 'Suécia',                  en: 'Sweden' },
  { iso: 'CH',  code: '+41',    flag: '🇨🇭', pt: 'Suíça',                   en: 'Switzerland' },
  { iso: 'TZ',  code: '+255',   flag: '🇹🇿', pt: 'Tanzânia',                en: 'Tanzania' },
  { iso: 'TR',  code: '+90',    flag: '🇹🇷', pt: 'Turquia',                 en: 'Türkiye' },
  { iso: 'UA',  code: '+380',   flag: '🇺🇦', pt: 'Ucrânia',                 en: 'Ukraine' },
  { iso: 'UY',  code: '+598',   flag: '🇺🇾', pt: 'Uruguai',                 en: 'Uruguay' },
  { iso: 'VE',  code: '+58',    flag: '🇻🇪', pt: 'Venezuela',               en: 'Venezuela' },
  { iso: 'VN',  code: '+84',    flag: '🇻🇳', pt: 'Vietname',                en: 'Vietnam' },
  { iso: 'ZM',  code: '+260',   flag: '🇿🇲', pt: 'Zâmbia',                  en: 'Zambia' },
  { iso: 'ZW',  code: '+263',   flag: '🇿🇼', pt: 'Zimbabwe',                en: 'Zimbabwe' },
]

export function countryName(country: Country, lang: Lang): string {
  return lang === 'pt' ? country.pt : country.en
}

/** O fallback do produto quando nada mais se sabe. */
export const DEFAULT_ISO = 'AO'

export function countryByIso(iso: string): Country {
  return COUNTRIES.find((item) => item.iso === iso) ?? COUNTRIES[0]
}

/**
 * O país do telemóvel, quando dá para o saber.
 *
 * Lê a região do locale (o `AO` de `pt-AO`). Sem região reconhecida, Angola —
 * que é o fallback que o produto já pratica, e não uma escolha nova.
 */
export function detectCountry(): Country {
  try {
    const parts = Intl.DateTimeFormat().resolvedOptions().locale.split('-')
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]
      if (part.length === 2 && part === part.toUpperCase()) {
        const found = COUNTRIES.find((item) => item.iso === part)
        if (found) return found
      }
    }
  } catch {}
  return countryByIso(DEFAULT_ISO)
}

/**
 * Filtra por nome ou indicativo, nas duas línguas.
 *
 * Procurar "244" ou "+244" tem de dar Angola, e procurar "Mozambique" com a app
 * em português também: quem escreve o nome em inglês não devia ter de descobrir
 * como o produto o escreve.
 */
export function searchCountries(query: string): Country[] {
  const raw = query.trim().toLowerCase()
  if (!raw) return COUNTRIES
  const digits = raw.replace(/[^0-9]/g, '')
  return COUNTRIES.filter((item) => (
    item.pt.toLowerCase().includes(raw)
    || item.en.toLowerCase().includes(raw)
    || (digits.length > 0 && item.code.replace('+', '').startsWith(digits))
  ))
}
