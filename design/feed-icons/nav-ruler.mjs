#!/usr/bin/env node
// ARQUIVO HISTÓRICO: calibração anterior. A família atual usa geometria autoral 24×24 e caixas de navegação 26px.
// A régua da barra de navegação.
//
// Os cinco separadores vêm de duas famílias que se medem de maneiras diferentes,
// e o tamanho de cada um era um número escrito à mão. Isto mede-os: renderiza
// cada glifo com a pintura exacta que a barra lhe dá, conta os pixels pintados e
// resolve o tamanho que põe a tinta nos NAV_INK. O que sai vai para o NAV_GLYPHS.
//
//   node design/feed-icons/nav-ruler.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE = join(HERE, '../../mobile/src')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const NAV_INK = 21      // massa visual alvo, em px
const STROKE = 1.9      // traço da barra, em px do tamanho renderizado
const FILL_BOOST = 0.5  // reforço dos preenchidos, em px

function literal(file, name) {
  const src = readFileSync(file, 'utf8')
  const i = src.indexOf(`export const ${name} = `) + `export const ${name} = `.length
  return new Function(`return ${src.slice(i, src.indexOf('\n} satisfies', i) + 2)}`)()
}
const feedIcons = literal(join(MOBILE, 'components/FeedIcon/paths.ts'), 'feedIcons')
const iconPaths = literal(join(MOBILE, 'components/Icon/paths.ts'), 'iconPaths')

const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/** Um glifo `ui` desenhado a um tamanho, com o traço em px reais. */
function ui(name, px, strokePx) {
  const sw = (strokePx * 24) / px
  const shapes = iconPaths[name].map(([tag, a]) => {
    const own = { ...a }
    const fill = own.fill ? own.fill.replace('currentColor', '#000') : 'none'
    const stroke = own.stroke ? own.stroke.replace('currentColor', '#000') : '#000'
    delete own.fill; delete own.stroke
    const attrs = { ...own, fill, stroke, ...(stroke === 'none' ? {} : { strokeWidth: sw }) }
    return `<${tag} ${Object.entries(attrs).map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')} stroke-linecap="round" stroke-linejoin="round"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none">${shapes}</svg>`
}

/** Um glifo `feed`, com o reforço dos preenchidos em px reais. */
function feed(name, px, boostPx) {
  const icon = feedIcons[name]
  const vb = Number(icon.viewBox.trim().split(/\s+/)[2]) || 24
  const toUnits = (v) => (v * vb) / px
  const shapes = icon.shapes.map(([tag, a]) => {
    const own = { ...a }
    const fill = own.fill === 'currentColor' ? '#000' : (own.fill ?? 'none')
    let stroke = own.stroke === 'currentColor' ? '#000' : (own.stroke ?? 'none')
    delete own.fill; delete own.stroke
    if (boostPx != null && fill !== 'none') {
      stroke = fill
      own.strokeWidth = String(+toUnits(boostPx).toFixed(4))
      own.strokeLinejoin ??= 'round'
    }
    const attrs = { ...own, fill, stroke }
    return `<${tag} ${Object.entries(attrs).map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${icon.viewBox}" fill="none">${shapes}</svg>`
}

// Os cinco separadores, com a pintura que a barra lhes dá.
const GLYPHS = [
  { key: 'home',    family: 'ui',   icon: 'home' },
  { key: 'search',  family: 'ui',   icon: 'search' },
  { key: 'circle',  family: 'ui',   icon: 'circle-add' },
  { key: 'message', family: 'feed', icon: 'chat-outline' },
  { key: 'profile', family: 'ui',   icon: 'user' },
]

/** Conta os pixels pintados de cada SVG: caixa de tinta e espessura da banda. */
function measure(jobs) {
  const page = `<body style="margin:0"><script>
const JOBS = ${JSON.stringify(jobs)}
const out = {}
async function run() {
  for (const job of JOBS) {
    const px = job.px
    const img = new Image()
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(job.svg) })
    const c = document.createElement('canvas'); c.width = c.height = px
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, px, px)
    const d = g.getImageData(0, 0, px, px).data
    const al = (x, y) => (x < 0 || y < 0 || x >= px || y >= px ? 0 : d[(y * px + x) * 4 + 3] / 255)
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, A = 0, P = 0
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const a = al(x, y)
      A += a
      P += Math.hypot((al(x+1,y) - al(x-1,y)) / 2, (al(x,y+1) - al(x,y-1)) / 2)
      if (a > 0.03) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    out[job.key] = { w: x1 - x0 + 1, h: y1 - y0 + 1, t: 2 * A / P, cy: (y0 + y1 + 1) / 2, box: px }
  }
  document.title = 'JSON_START' + JSON.stringify(out) + 'JSON_END'
}
run()
</script></body>`
  const tmp = join(tmpdir(), `luxey-nav-ruler-${Date.now()}-${Math.random().toString(36).slice(2)}.html`)
  writeFileSync(tmp, page)
  const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
    '--virtual-time-budget=20000', '--dump-dom', `file://${tmp}`],
    { encoding: 'utf8', maxBuffer: 1 << 28 })
  return JSON.parse(dom.match(/JSON_START([\s\S]*?)JSON_END/)[1])
}

// ── 1ª passagem: a geometria, sem peso nenhum ──────────────────────────────
// Um traço tem de estar lá para a forma existir, mas fica em fio de cabelo: o
// que se quer é a caixa do desenho, não a da tinta.
const REF = 600
const HAIR = 0.4
const geometry = measure(GLYPHS.map((g) => ({
  key: g.key, px: REF,
  svg: g.family === 'ui' ? ui(g.icon, REF, HAIR) : feed(g.icon, REF, null),
})))

// ── o tamanho que põe a tinta nos NAV_INK ──────────────────────────────────
// Nas duas famílias a tinta cresce com o tamanho e o reforço não: para os `ui`
// o traço é absoluto em px, para o `feed` o `boostPx` também. Logo
// tinta(S) = fracção·S + reforço, e o tamanho sai por conta directa.
const r2 = (v) => +v.toFixed(2)
const plan = GLYPHS.map((g) => {
  const m = geometry[g.key]
  const frac = (Math.max(m.w, m.h) - HAIR) / REF
  const boost = g.family === 'ui' ? STROKE : FILL_BOOST
  return { ...g, frac, size: r2((NAV_INK - boost) / frac) }
})

// ── 2ª passagem: conferir no tamanho final, com supersampling ──────────────
const SS = 12
const check = measure(plan.map((g) => ({
  key: g.key, px: Math.round(g.size * SS),
  svg: g.family === 'ui'
    ? ui(g.icon, Math.round(g.size * SS), STROKE * SS)
    : feed(g.icon, Math.round(g.size * SS), FILL_BOOST * SS),
})))

// ── os atalhos revelados: mesma conta, alvo mais baixo ─────────────────────
const REVEAL_INK = 18
const REVEALS = [
  { key: 'plus',        family: 'ui', icon: 'plus' },
  { key: 'circle-add',  family: 'ui', icon: 'circle-add' },
]
const revealGeo = measure(REVEALS.map((g) => ({ key: g.key, px: REF, svg: ui(g.icon, REF, HAIR) })))
const revealPlan = REVEALS.map((g) => {
  const m = revealGeo[g.key]
  const frac = (Math.max(m.w, m.h) - HAIR) / REF
  return { ...g, size: r2((REVEAL_INK - STROKE) / frac) }
})
const revealCheck = measure(revealPlan.map((g) => ({
  key: g.key, px: Math.round(g.size * SS), svg: ui(g.icon, Math.round(g.size * SS), STROKE * SS),
})))

console.log(`régua da barra · alvo: tinta ${NAV_INK}px de lado maior, traço ${STROKE}px\n`)
console.log('glifo      família   size     tinta medida    traço  nudgeY')
const sizes = {}
for (const g of plan) {
  const c = check[g.key]
  sizes[g.key] = g.size
  console.log(
    g.key.padEnd(10), g.family.padEnd(8),
    String(g.size).padStart(6), '  ',
    `${r2(c.w / SS)} × ${r2(c.h / SS)}`.padEnd(16),
    String(r2(c.t / SS)).padStart(5),
    String(r2((c.box / 2 - c.cy) / SS)).padStart(7),
  )
}
console.log('\nNAV_GLYPHS size:', JSON.stringify(sizes))
console.log('\natalhos · alvo: tinta ' + REVEAL_INK + 'px')
for (const g of revealPlan) {
  const c = revealCheck[g.key]
  console.log(' ', g.key.padEnd(12), String(g.size).padStart(6), '  ',
    `${r2(c.w / SS)} × ${r2(c.h / SS)}`.padEnd(16), String(r2(c.t / SS)).padStart(5))
}
