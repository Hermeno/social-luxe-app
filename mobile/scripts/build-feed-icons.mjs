#!/usr/bin/env node
// Os SVGs são a fonte de verdade: preserva a grelha e as correções ópticas autorais.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/assets/feed-icons')
const OUT = join(ROOT, 'src/components/FeedIcon/paths.ts')
const INHERITABLE = [
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'fill-rule', 'clip-rule', 'stroke-miterlimit',
]
const camel = (key) => key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
const attrsOf = (raw) => Object.fromEntries([...raw.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))
const inherited = (attrs) => Object.fromEntries(INHERITABLE.filter((k) => k in attrs).map((k) => [k, attrs[k]]))

function parse(svg, file) {
  const root = attrsOf(svg.match(/<svg\b([^>]*)>/)?.[1] ?? '')
  if (root.viewBox !== '0 0 24 24') throw new Error(`${file}: requer viewBox="0 0 24 24"`)
  // Não aceitar conteúdo que o renderer nativo não consiga reproduzir.
  const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title[\s\S]*?<\/title>/g, '')
  for (const [, tag] of body.matchAll(/<\/?([a-zA-Z][\w:-]*)\b/g)) {
    if (!['svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'].includes(tag)) {
      throw new Error(`${file}: elemento não suportado ${tag}`)
    }
  }
  const shapes = []
  const stack = [inherited(root)]
  const token = /<(\/?)(g|path|circle|rect|line|polyline|polygon)\b([^>]*?)(\/?)>/g
  for (const [, closing, tag, raw, selfClose] of body.matchAll(token)) {
    if (closing) {
      if (tag === 'g') stack.pop()
      continue
    }
    const own = attrsOf(raw)
    if (own.transform || own.style || own.opacity) throw new Error(`${file}: incorporar transformações/estilos na geometria`)
    if (tag === 'g') {
      if (!selfClose) stack.push(inherited(own))
      continue
    }
    const merged = { ...Object.assign({}, ...stack), ...own }
    if (merged.stroke && merged.stroke !== 'none') {
      if (merged['stroke-width'] !== '1.75' || merged['stroke-linecap'] !== 'round' || merged['stroke-linejoin'] !== 'round') {
        throw new Error(`${file}: traço deve ser 1.75 com terminais e junções round`)
      }
    }
    shapes.push([tag, Object.fromEntries(Object.entries(merged).map(([k, v]) => [camel(k), v]))])
  }
  if (!shapes.length) throw new Error(`${file}: nenhuma forma reconhecida`)
  return { viewBox: root.viewBox, nativeViewBox: root.viewBox, shapes }
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort()
const entries = files.map((file) => `  '${file.slice(0, -4)}': ${JSON.stringify(parse(readFileSync(join(SRC, file), 'utf8'), file))},`)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `// GERADO POR scripts/build-feed-icons.mjs — não editar à mão.
// Fonte: src/assets/feed-icons/*.svg · npm run icons:feed

export type FeedIconShape = [string, Record<string, string>]
export interface FeedIconDef {
  /** Grelha autoral fixa; nunca reenquadrar a partir das medidas de tinta. */
  viewBox: string
  nativeViewBox: string
  shapes: FeedIconShape[]
}

export const feedIcons = {
${entries.join('\n')}
} satisfies Record<string, FeedIconDef>

export type FeedIconName = keyof typeof feedIcons
`)
console.log(`paths.ts: ${files.length} ícones · 24×24 · traço 1.75`)
