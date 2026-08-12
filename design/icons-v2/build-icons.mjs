#!/usr/bin/env node
// Gera o pacote de ícones Luxee v2 (outline, interior vazado) em design/icons-v2/svg
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '/Users/cash/Desktop/lux/design/icons-v2/svg'
mkdirSync(OUT, { recursive: true })

// Grelha 24×24 · área viva 3..21 · traço 1.75 · pontas e junções redondas · interior vazado.
const I = {
  // ── Feed ────────────────────────────────────────────────────────────────
  heart: `<path d="M12 20.75S3.15 15.7 3.15 9.45c0-2.9 2.15-5.1 5-5.1 1.7 0 3.12.82 3.85 2.18.73-1.36 2.15-2.18 3.85-2.18 2.85 0 5 2.2 5 5.1 0 6.25-8.85 11.3-8.85 11.3Z"/>`,

  'heart-plus': `<path d="M8.8 20.2C8.8 20.2 3.2 16.4 3.2 12.3A3.4 3.4 0 0 1 8.8 10 3.4 3.4 0 0 1 14.4 12.3C14.4 16.4 8.8 20.2 8.8 20.2Z"/>
  <path d="M18.7 3.6v4.8M21.1 6h-4.8"/>`,

  // Balão com a setinha virada para a DIREITA (pedido do Herminio)
  comment: `<path d="M7.6 4.2H16.4A4.4 4.4 0 0 1 20.8 8.6V11.4A4.4 4.4 0 0 1 16.4 15.8H14.6l3.4 4.1-7-4.1H7.6A4.4 4.4 0 0 1 3.2 11.4V8.6A4.4 4.4 0 0 1 7.6 4.2Z"/>`,

  share: `<path d="M3.4 19.8C3.5 14 8.4 9.4 15 9.4H20.4"/>
  <path d="M15.4 4.4 20.4 9.4 15.4 14.4"/>`,

  bookmark: `<path d="M6.5 3.25h11a2.1 2.1 0 0 1 2.1 2.1v15.4L12 16.2l-7.6 4.55V5.35a2.1 2.1 0 0 1 2.1-2.1Z"/>`,

  remix: `<circle cx="9.6" cy="9.6" r="5.6"/>
  <circle cx="14.4" cy="14.4" r="5.6"/>`,

  // "Mais" em formato VERTICAL (pedido do Herminio)
  'more-vertical': `<circle cx="12" cy="5.2" r="1.5" fill="currentColor" stroke="none"/>
  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
  <circle cx="12" cy="18.8" r="1.5" fill="currentColor" stroke="none"/>`,

  music: `<circle cx="7.2" cy="17.6" r="3.2"/>
  <circle cx="17.8" cy="15.4" r="3.2"/>
  <path d="M10.4 17.6V7.4l10.6-2.2v10.2"/>`,

  // ── Navegação ───────────────────────────────────────────────────────────
  home: `<path d="m3.25 10.45 8.75-7.2 8.75 7.2v8.1a2.2 2.2 0 0 1-2.2 2.2H5.45a2.2 2.2 0 0 1-2.2-2.2Z"/>`,

  search: `<circle cx="10.6" cy="10.6" r="6.85"/>
  <path d="m15.65 15.65 4.85 4.85"/>`,

  plus: `<path d="M12 4.25v15.5M4.25 12h15.5"/>`,

  bell: `<path d="M5.5 10.4a6.5 6.5 0 0 1 13 0c0 3.35.85 5.25 1.5 6.2a.75.75 0 0 1-.62 1.18H4.62A.75.75 0 0 1 4 16.6c.65-.95 1.5-2.85 1.5-6.2Z"/>
  <path d="M9.9 20.4a2.35 2.35 0 0 0 4.2 0"/>`,

  user: `<circle cx="12" cy="8" r="4"/>
  <path d="M4.1 20.75c0-4.25 3.45-7.15 7.9-7.15s7.9 2.9 7.9 7.15Z"/>`,

  // ── Perfil / Social ─────────────────────────────────────────────────────
  'user-plus': `<circle cx="8.75" cy="8" r="3.65"/>
  <path d="M2.45 20.75c0-4 2.75-6.8 6.3-6.8s6.3 2.8 6.3 6.8Z"/>
  <path d="M18.6 5.4v5.6m2.8-2.8h-5.6"/>`,

  'user-check': `<circle cx="8.6" cy="8" r="3.5"/>
  <path d="M2.5 20.75c0-4 2.75-6.8 6.1-6.8s6.1 2.8 6.1 6.8Z"/>
  <path d="m15.8 8.2 2 2 3.4-3.7"/>`,

  'user-minus': `<circle cx="8.75" cy="8" r="3.65"/>
  <path d="M2.45 20.75c0-4 2.75-6.8 6.3-6.8s6.3 2.8 6.3 6.8Z"/>
  <path d="M15.8 8.2h5.6"/>`,

  invite: `<path d="M12 15.2V3.9"/>
  <path d="M7.9 8 12 3.9 16.1 8"/>
  <path d="M5.2 13.4v5.2a2.4 2.4 0 0 0 2.4 2.4h8.8a2.4 2.4 0 0 0 2.4-2.4v-5.2"/>`,

  send: `<path d="M21 3.6 14.34 21.2a.55.55 0 0 1-1.03.03L10.5 13.5 2.77 10.69a.55.55 0 0 1 .03-1.03Z"/>
  <path d="M21 3.6 10.5 13.5"/>`,

  users: `<circle cx="9.3" cy="8" r="3.6"/>
  <path d="M2.8 20.6c0-3.8 2.9-6.8 6.5-6.8s6.5 3 6.5 6.8Z"/>
  <path d="M16.4 4.9a3.6 3.6 0 0 1 0 6.6"/>
  <path d="M17.5 14.1c2.2.7 3.7 2.9 3.7 6.5h-2.6"/>`,

  verified: `<path d="M10.4 2.63a2.25 2.25 0 0 1 3.2 0l.9.9a2.25 2.25 0 0 0 1.75.65l1.27-.07a2.25 2.25 0 0 1 2.37 2.37l-.07 1.27a2.25 2.25 0 0 0 .65 1.75l.9.9a2.25 2.25 0 0 1 0 3.2l-.9.9a2.25 2.25 0 0 0-.65 1.75l.07 1.27a2.25 2.25 0 0 1-2.37 2.37l-1.27-.07a2.25 2.25 0 0 0-1.75.65l-.9.9a2.25 2.25 0 0 1-3.2 0l-.9-.9a2.25 2.25 0 0 0-1.75-.65l-1.27.07a2.25 2.25 0 0 1-2.37-2.37l.07-1.27a2.25 2.25 0 0 0-.65-1.75l-.9-.9a2.25 2.25 0 0 1 0-3.2l.9-.9a2.25 2.25 0 0 0 .65-1.75l-.07-1.27a2.25 2.25 0 0 1 2.37-2.37l1.27.07a2.25 2.25 0 0 0 1.75-.65Z"/>
  <path d="m8.7 11.9 2.3 2.3 4.3-4.6"/>`,

  // ── Controlos de vídeo ──────────────────────────────────────────────────
  play: `<path d="M7.6 5 18.8 12 7.6 19Z"/>`,

  pause: `<rect x="6.6" y="4.6" width="4.4" height="14.8" rx="2.2"/>
  <rect x="13" y="4.6" width="4.4" height="14.8" rx="2.2"/>`,

  volume: `<path d="M12.4 4.9 7.2 9.1H3.6a1.4 1.4 0 0 0-1.4 1.4v3a1.4 1.4 0 0 0 1.4 1.4h3.6l5.2 4.2Z"/>
  <path d="M15.6 9.4a3.8 3.8 0 0 1 0 5.2"/>
  <path d="M18.4 6.6a7.8 7.8 0 0 1 0 10.8"/>`,

  'volume-off': `<path d="M12.4 4.9 7.2 9.1H3.6a1.4 1.4 0 0 0-1.4 1.4v3a1.4 1.4 0 0 0 1.4 1.4h3.6l5.2 4.2Z"/>
  <path d="m16.4 10 5 4m0-4-5 4"/>`,

  fullscreen: `<path d="M3.2 8.8V5.6a2.4 2.4 0 0 1 2.4-2.4h3.2"/>
  <path d="M15.2 3.2h3.2a2.4 2.4 0 0 1 2.4 2.4v3.2"/>
  <path d="M20.8 15.2v3.2a2.4 2.4 0 0 1-2.4 2.4h-3.2"/>
  <path d="M8.8 20.8H5.6a2.4 2.4 0 0 1-2.4-2.4v-3.2"/>`,

  pip: `<rect x="2.8" y="4.6" width="18.4" height="14.8" rx="3.4"/>
  <rect x="12.4" y="12" width="7" height="5.4" rx="1.8"/>`,

  speed: `<circle cx="12" cy="12" r="8.8"/>
  <circle cx="12" cy="12" r="1.9"/>
  <path d="m16.5 7.9-3.15 2.75"/>`,

  'rewind-10': `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
  <path d="M3 3v5h5"/>
  <path d="M8.8 11.1 10 10.2v5.6"/>
  <rect x="11.8" y="10.2" width="3.4" height="5.6" rx="1.7"/>`,

  'forward-10': `<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
  <path d="M21 3v5h-5"/>
  <path d="M8.8 11.1 10 10.2v5.6"/>
  <rect x="11.8" y="10.2" width="3.4" height="5.6" rx="1.7"/>`,

  // ── Outros ──────────────────────────────────────────────────────────────
  camera: `<rect x="2.8" y="4.6" width="18.4" height="15" rx="4.2"/>
  <circle cx="12" cy="12.1" r="4.15"/>`,

  video: `<rect x="2.8" y="5.8" width="12.8" height="12.4" rx="3.6"/>
  <path d="m15.6 11.1 5.6-3.3v8.4l-5.6-3.3Z"/>`,

  image: `<rect x="3.3" y="4.4" width="17.4" height="15.2" rx="3.2"/>
  <circle cx="8.9" cy="9.7" r="1.75"/>
  <path d="m3.6 18.4 4.9-4.6a2 2 0 0 1 2.7 0l4.1 3.85"/>
  <path d="m14.4 15.5 1.5-1.4a2 2 0 0 1 2.7 0l1.8 1.7"/>`,

  live: `<circle cx="12" cy="12" r="2.3"/>
  <path d="M7.6 8.9a5.4 5.4 0 0 0 0 6.2"/>
  <path d="M16.4 15.1a5.4 5.4 0 0 0 0-6.2"/>
  <path d="M4.6 6.8a9 9 0 0 0 0 10.4"/>
  <path d="M19.4 17.2a9 9 0 0 0 0-10.4"/>`,

  settings: `<path d="M12.22 2.4h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73v.18a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4.4a2 2 0 0 0-2-2Z"/>
  <circle cx="12" cy="12" r="3"/>`,
}

const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">\n  ${body.trim()}\n</svg>\n`

for (const [name, body] of Object.entries(I)) {
  writeFileSync(join(OUT, `${name}.svg`), wrap(body))
}
writeFileSync(join(OUT, '..', 'manifest.json'), JSON.stringify(Object.keys(I), null, 2))
console.log(`${Object.keys(I).length} ícones → ${OUT}`)
