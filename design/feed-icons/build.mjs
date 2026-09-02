#!/usr/bin/env node
// Gera design/feed-icons/index.html — a folha de medidas dos ícones das duas feeds.
//
// Porque é gerada e não escrita à mão: os números têm de vir do que a app desenha
// mesmo. Este ficheiro reimplementa a pintura do <FeedIcon> e do <Icon> a partir
// dos mesmos `paths.ts` que o telemóvel carrega, e mede a tinta com o Chrome —
// contando pixels pintados, não a caixa da geometria, que ignora as bicas dos
// cantos vivos. Mexeste num SVG? Corre `npm run icons:feed` e depois isto.
//
//   node design/feed-icons/build.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { SPECS, SCREENS, PALETTE } from './specs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const MOBILE = join(ROOT, 'mobile/src')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = join(HERE, 'index.html')

// ─── As duas famílias, lidas dos ficheiros que a app usa ────────────────────
function objectLiteral(file, name) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf(`export const ${name} = `) + `export const ${name} = `.length
  const end = src.indexOf('\n} satisfies', start)
  return new Function(`return ${src.slice(start, end + 2)}`)()
}
const feedIcons = objectLiteral(join(MOBILE, 'components/FeedIcon/paths.ts'), 'feedIcons')
const iconPaths = objectLiteral(join(MOBILE, 'components/Icon/paths.ts'), 'iconPaths')

const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
const num = (v, n = 2) => +Number(v).toFixed(n)

/**
 * 2·área/perímetro mede a espessura de uma banda. Numa forma cheia a conta
 * continua a correr, mas o que devolve é a largura média do bolo — não um
 * traço. Acima de 40% do lado menor da tinta já não há banda nenhuma.
 */
const isSolid = (ink) => !!ink?.t && ink.t > 0.4 * Math.min(ink.w, ink.h)
const strokeLabel = (ink) => !ink?.t ? '—' : isSolid(ink) ? 'cheio' : num(ink.t) + ' px'


/**
 * Resolve um uso em formas pintadas — o mesmo cálculo que corre no telemóvel.
 * Devolve as formas já com `stroke-width` em unidades da caixa, que é o único
 * sítio onde os dois componentes divergem: um pensa em px, o outro na grelha.
 */
function resolve(spec) {
  const { comp, name, size, color, props = {} } = spec
  if (comp === 'FeedIcon') {
    const icon = feedIcons[name]
    if (!icon) throw new Error(`FeedIcon "${name}" não existe`)
    const vbSide = Number(icon.viewBox.trim().split(/\s+/)[2]) || 24
    const mediumBoost = vbSide * 0.01
    const toUnits = (px) => (px * vbSide) / size
    const paint = (v, fb) => (v === 'currentColor' ? color : v ?? fb)
    const shapes = icon.shapes.map(([tag, attrs]) => {
      const own = { ...attrs }
      const fill = paint(own.fill, 'none')
      let stroke = paint(own.stroke, 'none')
      delete own.fill; delete own.stroke
      const hasStroke = stroke !== 'none' && stroke !== 'transparent'
      const hasFill = fill !== 'none' && fill !== 'transparent'
      if (props.strokePx != null && hasStroke) {
        own.strokeWidth = String(num(toUnits(props.strokePx), 4))
      } else if (props.boostPx != null && hasFill) {
        stroke = fill
        own.strokeWidth = String(num(toUnits(props.boostPx), 4))
        own.strokeLinejoin ??= 'round'
      } else if (props.weight === 'medium') {
        if (hasStroke) own.strokeWidth = String(num(Number(own.strokeWidth ?? 1) + mediumBoost, 4))
        else if (hasFill) {
          stroke = fill
          own.strokeWidth = String(num(mediumBoost, 4))
          own.strokeLinejoin ??= 'round'
        }
      }
      return [tag, { ...own, fill, stroke }]
    })
    return { viewBox: icon.viewBox, nativeViewBox: icon.nativeViewBox, vbSide, shapes, family: 'feed-icons' }
  }

  const list = iconPaths[name]
  if (!list) throw new Error(`Icon "${name}" não existe`)
  const strokeWidth = props.strokeWidth ?? 1.75
  const sw = props.absoluteStrokeWidth ? (strokeWidth * 24) / size : strokeWidth
  const shapes = list.map(([tag, attrs]) => {
    const own = { ...attrs }
    const fill = own.fill ? (own.fill === 'currentColor' ? color : own.fill) : (props.fill ?? 'none')
    const stroke = own.stroke ? (own.stroke === 'currentColor' ? color : own.stroke) : color
    delete own.fill; delete own.stroke
    return [tag, {
      ...own, fill, stroke,
      ...(stroke === 'none' ? {} : { strokeWidth: String(num(sw, 4)) }),
      strokeLinecap: own.strokeLinecap ?? 'round',
      strokeLinejoin: own.strokeLinejoin ?? 'round',
    }]
  })
  return { viewBox: '0 0 24 24', nativeViewBox: '0 0 24 24', vbSide: 24, shapes, family: 'icons' }
}

const shapesMarkup = (shapes) => shapes.map(([tag, attrs]) =>
  `<${tag} ${Object.entries(attrs).map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`).join('')

const svgMarkup = (r, px, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${r.viewBox}" fill="none"${extra}>${shapesMarkup(r.shapes)}</svg>`

const resolved = SPECS.map((spec) => ({ spec, r: resolve(spec) }))

// ─── Medir a tinta: pixels pintados, com supersampling ──────────────────────
const SS = (size) => Math.max(4, Math.min(16, Math.round(1400 / size)))
const page = `<body style="margin:0"><script>
const JOBS = ${JSON.stringify(resolved.map(({ spec, r }, i) => ({
  i, size: spec.size, ss: SS(spec.size), svg: svgMarkup(r, spec.size * SS(spec.size)),
})))}
const out = {}
async function run() {
  for (const job of JOBS) {
    const px = Math.ceil(job.size * job.ss)
    const img = new Image()
    await new Promise((ok, no) => {
      img.onload = ok; img.onerror = () => no(new Error('svg ' + job.i))
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(job.svg)
    })
    const c = document.createElement('canvas'); c.width = px; c.height = px
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, px, px)
    const d = g.getImageData(0, 0, px, px).data
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      if (d[(y * px + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x
        if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
    // Espessura da banda: área = comprimento × espessura e o bordo (fora mais
    // dentro) = 2 × comprimento, logo espessura = 2A/P. O perímetro sai do
    // próprio anti-aliasing — pela fórmula da co-área, a soma do módulo do
    // gradiente da cobertura é o comprimento do bordo.
    let A = 0, P = 0
    const al = (x, y) => (x < 0 || y < 0 || x >= px || y >= px ? 0 : d[(y * px + x) * 4 + 3] / 255)
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const a = al(x, y)
      A += a
      const gx = (al(x + 1, y) - al(x - 1, y)) / 2
      const gy = (al(x, y + 1) - al(x, y - 1)) / 2
      P += Math.hypot(gx, gy)
    }
    out[job.i] = x1 < 0 ? null : {
      x: x0 / job.ss, y: y0 / job.ss,
      w: (x1 - x0 + 1) / job.ss, h: (y1 - y0 + 1) / job.ss,
      t: P ? (2 * A / P) / job.ss : null,
    }
  }
  document.title = 'JSON_START' + JSON.stringify(out) + 'JSON_END'
  document.body.textContent = document.title
}
run()
</script></body>`

const tmp = join(tmpdir(), `luxey-feed-icons-${Date.now()}.html`)
writeFileSync(tmp, page)
const dom = execFileSync(CHROME, [
  '--headless', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=20000',
  '--dump-dom', `file://${tmp}`,
], { encoding: 'utf8', maxBuffer: 1 << 28 })
const raw = dom.match(/JSON_START([\s\S]*?)JSON_END/)
if (!raw) throw new Error('o Chrome não devolveu medidas')
const inkOf = JSON.parse(raw[1])
resolved.forEach((row, i) => { row.ink = inkOf[i] })

writeFileSync(join(HERE, 'measurements.json'), JSON.stringify(
  resolved.map(({ spec, r, ink }) => ({
    screen: spec.screen, label: spec.label, family: r.family, name: spec.name,
    size: spec.size, viewBox: r.viewBox, nativeViewBox: r.nativeViewBox,
    ink: ink && { x: num(ink.x), y: num(ink.y), w: num(ink.w), h: num(ink.h) },
    stroke: ink?.t && !isSolid(ink) ? num(ink.t) : null,
    declared: declared({ spec, r }),
    where: spec.where,
  })), null, 2) + '\n')

// ─── Números derivados ──────────────────────────────────────────────────────
// A espessura vive em unidades da caixa; quem desenha à mão precisa dela em px
// do tamanho renderizado, que é a única medida comparável entre famílias.
function declared({ spec, r }) {
  const p = spec.props ?? {}
  if (p.strokePx != null) return `strokePx ${p.strokePx}`
  if (p.boostPx != null) return `boostPx ${p.boostPx}`
  if (p.strokeWidth != null) return `${p.strokeWidth}${p.absoluteStrokeWidth ? ' abs' : ' na caixa'}`
  if (p.weight === 'medium') return 'weight medium'
  return r.family === 'feed-icons' ? 'pintura de origem' : '1.75 na caixa'
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pct = (a, b) => Math.round((a / b) * 100)

/** A ampliação: grelha em px reais, o glifo por cima, a tinta medida marcada. */
function stage({ spec, r, ink }) {
  const S = spec.size
  const k = S / r.vbSide
  const [vx, vy] = r.viewBox.trim().split(/\s+/).map(Number)
  const step = Math.max(1, Math.ceil(S / 52))
  const lines = []
  for (let i = 0; i <= S + 0.001; i += step) {
    const major = Math.round(i / step) % 4 === 0
    const c = `class="${major ? 'g-major' : 'g-minor'}"`
    lines.push(`<line ${c} x1="${num(i)}" y1="0" x2="${num(i)}" y2="${S}"/>`)
    lines.push(`<line ${c} x1="0" y1="${num(i)}" x2="${S}" y2="${num(i)}"/>`)
  }
  const box = ink
    ? `<rect class="inkbox" x="${num(ink.x)}" y="${num(ink.y)}" width="${num(ink.w)}" height="${num(ink.h)}"/>`
    : ''
  return `<svg class="stage" viewBox="-1 -1 ${S + 2} ${S + 2}" role="img" aria-label="${esc(spec.label)} ampliado">
      <rect class="bleed" x="0" y="0" width="${S}" height="${S}"/>
      <g class="grid">${lines.join('')}</g>
      <g class="glyph" transform="scale(${num(k, 6)}) translate(${num(-vx, 4)} ${num(-vy, 4)})">${shapesMarkup(r.shapes)}</g>
      ${box}
    </svg>`
}

function plate(row) {
  const { spec, r, ink } = row
  const on = spec.on === 'media' ? 'media' : spec.on === 'paper' ? 'paper'
    : spec.on ? 'custom' : (SCREENS.find((s) => s.id === spec.screen).surface)
  const style = spec.on && spec.on !== 'media' && spec.on !== 'paper' ? ` style="--surface:${spec.on}"` : ''
  return `<article class="plate${spec.star ? ' is-new' : ''}">
    <header>
      <h4>${esc(spec.label)}${spec.star ? '<i class="tag">novo</i>' : ''}</h4>
      <code>${esc(spec.name)}</code>
    </header>
    <div class="surface surface--${on}"${style}>
      ${stage(row)}
      <div class="real" title="tamanho real, 1:1">${svgMarkup(r, spec.size, ' class="one-to-one"')}</div>
    </div>
    <dl>
      <div><dt>caixa</dt><dd>${num(spec.size)} px</dd></div>
      <div><dt>tinta</dt><dd>${ink ? `${num(ink.w)} × ${num(ink.h)} px` : '—'}</dd></div>
      <div><dt>ocupa</dt><dd>${ink ? pct(Math.max(ink.w, ink.h), spec.size) + '%' : '—'}</dd></div>
      <div><dt>traço</dt><dd>${strokeLabel(ink)}</dd></div>
      <div><dt>declara</dt><dd>${esc(declared(row))}</dd></div>
      <div><dt>família</dt><dd>${r.family}</dd></div>
    </dl>
    ${spec.note ? `<p class="note">${esc(spec.note)}</p>` : ''}
    <p class="where"><code>${esc(spec.where)}</code></p>
  </article>`
}

const byScreen = (id) => resolved.filter((row) => row.spec.screen === id)
const groupsOf = (rows) => [...new Set(rows.map((r) => r.spec.group))]

function section(screen) {
  const rows = byScreen(screen.id)
  const strip = rows.map(({ spec, r }) =>
    `<span class="strip-item" title="${esc(spec.label)} · ${num(spec.size)} px">${svgMarkup(r, spec.size)}</span>`).join('')
  const body = groupsOf(rows).map((g) => `<h3 class="group">${esc(g)}</h3>
    <div class="plates">${rows.filter((r) => r.spec.group === g).map(plate).join('')}</div>`).join('')
  return `<section id="${screen.id}">
    <div class="section-head">
      <h2>${esc(screen.title)}</h2>
      <p class="route"><code>${esc(screen.route)}</code> · ${rows.length} ícones</p>
      <p class="lede">${esc(screen.note)}</p>
    </div>
    <div class="strip surface--${screen.surface}">
      <span class="strip-label">escala real</span>${strip}
    </div>
    ${body}
  </section>`
}

const tableRows = resolved.map(({ spec, r, ink }) => {
  return `<tr>
    <td>${esc(SCREENS.find((s) => s.id === spec.screen).title)}</td>
    <td>${esc(spec.label)}</td>
    <td><code>${esc(spec.name)}</code></td>
    <td class="n">${num(spec.size)}</td>
    <td class="n">${ink ? `${num(ink.w)}×${num(ink.h)}` : '—'}</td>
    <td class="n">${ink ? pct(Math.max(ink.w, ink.h), spec.size) + '%' : '—'}</td>
    <td class="n">${strokeLabel(ink).replace(' px', '')}</td>
    <td>${esc(declared({ spec, r }))}</td>
    <td>${r.family}</td>
    <td class="where"><code>${esc(spec.where)}</code></td>
  </tr>`
}).join('')

const sizes = [...new Set(resolved.map((r) => r.spec.size))].sort((a, b) => a - b)
const stamp = new Date().toISOString().slice(0, 10)

const html = `<title>Folha de Medidas dos Ícones</title>
<style>
:root{
  --bg:#fbfaf9; --card:#fff; --ink:#17171a; --ink-2:#5c5c66; --ink-3:#8d8d99;
  --line:#e6e4e0; --line-2:#f0eeeb; --accent:#7A47F5; --heart:#C846E2;
  --media:#14181b; --paper:#fff; --surface:#fff;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0e0e10; --card:#161619; --ink:#f2f1ef; --ink-2:#a3a2ad; --ink-3:#75747f;
  --line:#26262b; --line-2:#1d1d21; --paper:#f7f7f7;
}}
:root[data-theme="dark"]{
  --bg:#0e0e10; --card:#161619; --ink:#f2f1ef; --ink-2:#a3a2ad; --ink-3:#75747f;
  --line:#26262b; --line-2:#1d1d21; --paper:#f7f7f7;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--sans);
  -webkit-font-smoothing:antialiased}
code{font-family:var(--mono);font-size:.86em}
h1,h2,h3,h4{margin:0;font-weight:640;letter-spacing:-.015em}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}

header.top{padding:56px 0 28px;border-bottom:1px solid var(--line)}
header.top h1{font-size:34px;letter-spacing:-.03em}
header.top .sub{margin:10px 0 0;color:var(--ink-2);max-width:62ch}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.meta b{font:500 12px/1 var(--mono);color:var(--ink-2);background:var(--line-2);
  border:1px solid var(--line);border-radius:999px;padding:7px 11px}

nav.bar{position:sticky;top:0;z-index:9;background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
nav.bar .wrap{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding-block:10px}
nav.bar a{color:var(--ink-2);text-decoration:none;font-size:13px;padding:6px 10px;border-radius:8px}
nav.bar a:hover{color:var(--ink);background:var(--line-2)}
nav.bar .spacer{flex:1}
.toggle{font:12px/1 var(--sans);color:var(--ink-2);border:1px solid var(--line);background:var(--card);
  border-radius:8px;padding:7px 11px;cursor:pointer}
.toggle[aria-pressed="true"]{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}

section{padding:52px 0 8px;border-bottom:1px solid var(--line)}
.section-head h2{font-size:24px;letter-spacing:-.025em}
.section-head .route{margin:6px 0 0;color:var(--ink-3);font-size:13px}
.section-head .lede{margin:10px 0 0;color:var(--ink-2);max-width:70ch}
h3.group{margin:34px 0 14px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3)}

.strip{display:flex;align-items:center;gap:22px;flex-wrap:wrap;margin-top:22px;
  border:1px solid var(--line);border-radius:14px;padding:20px 22px}
.strip-label{font:11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;opacity:.5}
.strip-item{display:inline-flex;align-items:center;justify-content:center}
.surface--paper{background:var(--paper)}
.surface--media{background:var(--media)}
.surface--custom{background:var(--surface)}
.strip.surface--paper .strip-label{color:#8d8d99}
.strip.surface--media .strip-label{color:rgba(255,255,255,.55)}

.plates{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(268px,1fr))}
.plate{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;
  display:flex;flex-direction:column}
.plate.is-new{border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.plate>header{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:12px}
.plate h4{font-size:14px}
.plate h4 .tag{font:600 9px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;
  color:#fff;background:var(--accent);border-radius:4px;padding:3px 5px;margin-left:7px;
  vertical-align:2px;font-style:normal}
.plate>header code{color:var(--ink-3)}

.surface{position:relative;border-radius:10px;overflow:hidden;display:flex;
  align-items:center;justify-content:center;padding:14px}
.stage{width:100%;max-width:230px;height:auto;display:block;overflow:visible}
.bleed{fill:none}
.grid line{stroke:currentColor;vector-effect:non-scaling-stroke}
.g-minor{stroke-width:.5;opacity:.16}
.g-major{stroke-width:.5;opacity:.36}
.surface--paper .grid{color:#0a0a0f}
.surface--media .grid,.surface--custom .grid{color:#fff}
.inkbox{fill:none;stroke:var(--accent);stroke-width:1;stroke-dasharray:3 2.5;
  vector-effect:non-scaling-stroke;opacity:.9}
.real{position:absolute;right:10px;bottom:8px;display:flex;align-items:flex-end;gap:6px;
  padding:5px 7px;border-radius:8px;background:color-mix(in srgb,var(--paper) 78%,transparent)}
.surface--media .real{background:rgba(255,255,255,.10)}
body.no-grid .grid{display:none}
body.no-ink .inkbox{display:none}
body.trace .glyph{opacity:.22}
body.trace .real{display:none}

.plate dl{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;margin:14px 0 0}
.plate dl div{display:flex;justify-content:space-between;gap:8px;
  border-bottom:1px dotted var(--line);padding:4px 0}
.plate dt{color:var(--ink-3);font-size:11.5px}
.plate dd{margin:0;font:12px/1.3 var(--mono)}
.plate .note{margin:12px 0 0;color:var(--ink-2);font-size:12.5px;line-height:1.5}
.plate .where{margin:10px 0 0;color:var(--ink-3);font-size:11px;word-break:break-all}
.plate .where code{font-size:11px}

.rules{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:24px}
.rule{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.rule h4{font-size:13.5px;margin-bottom:8px}
.rule p{margin:0 0 10px;color:var(--ink-2);font-size:13.5px}
.rule p:last-child{margin-bottom:0}
.rule code{color:var(--ink);background:var(--line-2);padding:1px 5px;border-radius:4px}

.tablewrap{overflow-x:auto;margin-top:24px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line-2);white-space:nowrap}
th{font:600 11px/1 var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);
  position:sticky;top:0;background:var(--card)}
td.n{font-family:var(--mono);text-align:right}
td.where code{color:var(--ink-3);font-size:11px}
tr:last-child td{border-bottom:0}

footer{padding:36px 0 64px;color:var(--ink-3);font-size:13px}
footer code{color:var(--ink-2)}

@media print{
  :root{--bg:#fff;--card:#fff;--line:#ddd;--line-2:#eee}
  nav.bar,.toggle{display:none}
  section{break-before:page;border:0}
  .plate{break-inside:avoid}
  .plates{grid-template-columns:repeat(2,1fr)}
  header.top{padding-top:0}
}
</style>

<header class="top"><div class="wrap">
  <h1>Ícones da feed · folha de medidas</h1>
  <p class="sub">Todos os glifos que aparecem na feed inicial e na feed imersiva, medidos como
  a app os desenha: caixa, tinta real, ocupação e espessura em px do tamanho renderizado.
  É esta a folha para redesenhar à mão — as medidas são o contrato, o desenho é livre.</p>
  <div class="meta">
    <b>${resolved.length} usos</b>
    <b>${new Set(resolved.map((r) => r.spec.name)).size} desenhos</b>
    <b>2 famílias</b>
    <b>${sizes.length} tamanhos: ${sizes.map((s) => num(s)).join(' · ')}</b>
    <b>${stamp}</b>
  </div>
</div></header>

<nav class="bar"><div class="wrap">
  ${SCREENS.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}
  <a href="#regras">Como ler</a><a href="#tabela">Tabela</a>
  <span class="spacer"></span>
  <button class="toggle" aria-pressed="false" data-class="no-grid">grelha</button>
  <button class="toggle" aria-pressed="false" data-class="no-ink">caixa de tinta</button>
  <button class="toggle" aria-pressed="false" data-class="trace">modo decalque</button>
</div></nav>

<div class="wrap">
  <section id="regras">
    <div class="section-head">
      <h2>Como ler esta folha</h2>
      <p class="lede">Duas famílias convivem nas duas feeds e não se medem da mesma maneira.
      A grelha desenhada em cada ampliação é em <b>px do tamanho real</b> — não em unidades
      da caixa do SVG —, que é a única régua comum às duas.</p>
    </div>
    <div class="rules">
      <div class="rule">
        <h4>família <code>icons</code> — o design system</h4>
        <p>Grelha 24×24, área viva 2..22, traço definido pelo componente.
        <code>absoluteStrokeWidth</code> converte a espessura para px do tamanho renderizado;
        sem ele, o traço escala com a caixa — é por isso que o <code>play</code> de 64 chega
        aos 4.7px enquanto o de 26 fica em 1.9.</p>
        <p>Pontas e junções redondas, salvo onde a forma declarar cantos vivos.</p>
      </div>
      <div class="rule">
        <h4>família <code>feed-icons</code> — a feed</h4>
        <p>Cada desenho traz a caixa da sua origem. O build reenquadra-a para a tinta ocupar
        <code>0.78</code> do lado: é isso que faz um coração e um balão de famílias diferentes
        lerem do mesmo tamanho com o mesmo <code>size</code>.</p>
        <p>A pintura de origem manda. <code>strokePx</code> fixa a espessura em px reais e só
        actua onde há traço; <code>boostPx</code> engrossa formas preenchidas contornando-as
        com a própria cor; <code>weight="medium"</code> soma 1% da caixa.</p>
      </div>
      <div class="rule">
        <h4>a caixa de tinta</h4>
        <p>O tracejado violeta é a tinta medida: os pixels realmente pintados, contados num
        render supersampled do Chrome. Conta o traço e as bicas dos cantos vivos — coisas
        que a caixa da geometria ignora.</p>
        <p><b>Traço</b> é a espessura que o olho recebe, não a que o ficheiro declara: sai de
        2·área/perímetro sobre o mesmo render. Num desenho onde o contorno vem cozido no
        preenchimento, o ficheiro só declara o reforço — <code>boostPx 0.5</code> — e essa
        conta é a única maneira de o comparar com um traço a sério.</p>
        <p><b>Ocupa</b> é o maior lado da tinta a dividir pela caixa. Entre 78% e 80% o
        conjunto lê alinhado; um valor fora disso salta ao lado dos vizinhos.</p>
      </div>
    </div>
  </section>

  ${SCREENS.map(section).join('')}

  <section id="tabela">
    <div class="section-head"><h2>Tabela completa</h2>
      <p class="lede">Os mesmos números, para copiar. Também em <code>measurements.json</code>.</p></div>
    <div class="tablewrap"><table>
      <thead><tr><th>ecrã</th><th>papel</th><th>desenho</th><th>caixa</th><th>tinta</th>
        <th>ocupa</th><th>traço</th><th>declara</th><th>família</th><th>onde</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>
  </section>

  <footer>
    Gerado por <code>node design/feed-icons/build.mjs</code> a partir de
    <code>mobile/src/components/{Icon,FeedIcon}/paths.ts</code>.
    Mexeste num SVG? <code>npm run icons</code> ou <code>npm run icons:feed</code> primeiro.
  </footer>
</div>

<script>
for (const b of document.querySelectorAll('.toggle')) {
  b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') === 'true'
    b.setAttribute('aria-pressed', String(!on))
    document.body.classList.toggle(b.dataset.class, !on)
  })
}
</script>
`

writeFileSync(OUT, html)
console.log(`index.html: ${resolved.length} usos · ${new Set(resolved.map((r) => r.spec.name)).size} desenhos`)
