#!/usr/bin/env node
// Gera src/components/Icon/paths.ts a partir dos .svg em src/assets/icons.
// Os .svg são a fonte de verdade — edita lá e corre `npm run icons`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/assets/icons')
const OUT = join(ROOT, 'src/components/Icon/paths.ts')

// Só estas tags são suportadas em runtime pelo <Icon>.
const TAGS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon']
// Atributos herdados do <svg> raiz — descartados, o componente é que os define.
const INHERITED = ['stroke-width', 'stroke-linecap', 'stroke-linejoin']

function parse(svg, file) {
  const out = []
  const re = new RegExp(`<(${TAGS.join('|')})\\s+([^>]*?)/?>`, 'g')
  let m
  while ((m = re.exec(svg))) {
    const [, tag, raw] = m
    const attrs = {}
    for (const a of raw.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
      const [, key, value] = a
      if (INHERITED.includes(key)) continue
      // kebab-case → camelCase, que é o que o react-native-svg espera
      attrs[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
    }
    out.push([tag, attrs])
  }
  if (!out.length) throw new Error(`${file}: nenhuma forma reconhecida`)
  return out
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort()
const entries = files.map((f) => {
  const name = f.replace(/\.svg$/, '')
  const shapes = parse(readFileSync(join(SRC, f), 'utf8'), f)
  return `  '${name}': ${JSON.stringify(shapes)},`
})

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  `// GERADO POR scripts/build-icons.mjs — não editar à mão.
// Fonte: src/assets/icons/*.svg · corre \`npm run icons\` depois de mexeres nos SVG.

export type IconShape = [string, Record<string, string>]

export const iconPaths = {
${entries.join('\n')}
} satisfies Record<string, IconShape[]>

export type IconName = keyof typeof iconPaths
`,
)

console.log(`paths.ts: ${files.length} ícones`)
