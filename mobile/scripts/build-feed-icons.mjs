#!/usr/bin/env node
// Gera src/components/FeedIcon/paths.ts a partir dos .svg em src/assets/feed-icons.
//
// Porque é que isto não usa o scripts/build-icons.mjs: estes ícones vêm de famílias
// diferentes e cada um traz a sua própria caixa (15, 16, 24, 32, 40, 256) e o seu
// próprio modelo de pintura — uns são traço, outros são preenchimento com o contorno
// já cozido na forma. O <Icon> da Luxee força viewBox 24 e uma só espessura, o que
// cortaria metade destes desenhos. Aqui preserva-se o viewBox e a pintura de origem.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/assets/feed-icons')
const OUT = join(ROOT, 'src/components/FeedIcon/paths.ts')
const BOUNDS = join(SRC, '_bounds.json')

/**
 * Fração da caixa que a tinta de cada ícone deve ocupar.
 *
 * 0.78 não é arbitrário: é o que a grelha da Luxee já pratica (área viva 3–21 de 24,
 * mais meio traço de cada lado). Assim um FeedIcon e um <Icon> lado a lado — como
 * acontece na TabBar e no menu do post — leem do mesmo tamanho.
 */
const TARGET_INK = 0.78

const TAGS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon']
// Atributos que um <g> passa aos filhos.
const INHERITABLE = [
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'fill-rule', 'clip-rule', 'stroke-miterlimit', 'opacity',
]

const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

function attrsOf(raw) {
  const out = {}
  for (const [, key, value] of raw.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[key] = value
  return out
}

function parse(svg, file) {
  const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1]
  if (!viewBox) throw new Error(`${file}: sem viewBox`)

  // <title> só atrapalha e o react-native-svg não o quer aqui.
  let body = svg.replace(/<title[\s\S]*?<\/title>/g, '')

  // Empilha o contexto dos <g> para os filhos herdarem o que devem.
  const shapes = []
  const stack = []
  const token = /<(\/?)(g|path|circle|rect|line|polyline|polygon)\b([^>]*?)(\/?)>/g
  let m
  while ((m = token.exec(body))) {
    const [, closing, tag, raw, selfClose] = m
    if (tag === 'g') {
      if (closing) stack.pop()
      else if (!selfClose) {
        const a = attrsOf(raw)
        stack.push(Object.fromEntries(INHERITABLE.filter((k) => k in a).map((k) => [k, a[k]])))
      }
      continue
    }
    if (closing) continue
    const inherited = Object.assign({}, ...stack)
    const own = attrsOf(raw)
    const merged = { ...inherited, ...own } // o próprio ganha ao herdado
    shapes.push([tag, Object.fromEntries(Object.entries(merged).map(([k, v]) => [camel(k), v]))])
  }

  if (!shapes.length) throw new Error(`${file}: nenhuma forma reconhecida`)
  return { viewBox, shapes }
}

/**
 * Reenquadra a caixa para a tinta ficar centrada e ocupar TARGET_INK do lado.
 * Não mexe na geometria — só na janela por onde se olha para ela. É isto que faz
 * ícones de famílias diferentes lerem do mesmo tamanho com o mesmo `size`.
 */
function normalize(viewBox, bounds) {
  if (!bounds) return viewBox
  const [x, y, w, h] = bounds.ink
  const side = Math.max(w, h) / TARGET_INK
  const cx = x + w / 2
  const cy = y + h / 2
  const r = (n) => +n.toFixed(3)
  return `${r(cx - side / 2)} ${r(cy - side / 2)} ${r(side)} ${r(side)}`
}

const measured = existsSync(BOUNDS) ? JSON.parse(readFileSync(BOUNDS, 'utf8')) : null
if (!measured) {
  console.warn('! _bounds.json em falta — corre `npm run icons:feed:measure`.')
  console.warn('! Sem medidas os ícones saem com o tamanho aparente de origem, que não bate certo.')
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort()
const entries = files.map((f) => {
  const name = f.replace(/\.svg$/, '')
  const icon = parse(readFileSync(join(SRC, f), 'utf8'), f)
  const out = {
    viewBox: normalize(icon.viewBox, measured?.[name]),
    nativeViewBox: icon.viewBox,
    shapes: icon.shapes,
  }
  return `  '${name}': ${JSON.stringify(out)},`
})

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  `// GERADO POR scripts/build-feed-icons.mjs — não editar à mão.
// Fonte: src/assets/feed-icons/*.svg · corre \`npm run icons:feed\` depois de mexeres nos SVG.

export type FeedIconShape = [string, Record<string, string>]
export interface FeedIconDef {
  /** Caixa reenquadrada para a tinta ocupar ${TARGET_INK} do lado — é esta que se usa. */
  viewBox: string
  /** A caixa com que o desenho veio da sua família. Só para depurar. */
  nativeViewBox: string
  shapes: FeedIconShape[]
}

export const feedIcons = {
${entries.join('\n')}
} satisfies Record<string, FeedIconDef>

export type FeedIconName = keyof typeof feedIcons
`,
)

console.log(`paths.ts: ${files.length} ícones de feed`)
