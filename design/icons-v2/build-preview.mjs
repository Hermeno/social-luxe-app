#!/usr/bin/env node
// Injeta os SVG de svg/ em preview.template.html → preview.html
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const names = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'))

const icons = Object.fromEntries(
  names.map((n) => [
    n,
    readFileSync(join(HERE, 'svg', `${n}.svg`), 'utf8')
      .replace(/<svg[^>]*>/, '')
      .replace(/<\/svg>/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ]),
)

const tpl = readFileSync(join(HERE, 'preview.template.html'), 'utf8')
writeFileSync(
  join(HERE, 'preview.html'),
  tpl.replace('/*__ICON_DATA__*/', `const ICONS = ${JSON.stringify(icons)};`),
)
console.log(`preview.html: ${names.length} ícones`)
