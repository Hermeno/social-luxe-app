#!/usr/bin/env node
// Mede a tinta real de cada ícone em src/assets/feed-icons e escreve _bounds.json.
//
// Porque é preciso: estes ícones vêm de famílias diferentes e cada uma deixa uma
// margem diferente dentro da sua caixa. Sem isto, `size={24}` dá tamanhos aparentes
// diferentes — um balão que enche a caixa fica maior que um coração que não enche.
// O build usa estas medidas para reenquadrar cada desenho, de modo a que a tinta
// ocupe sempre a mesma fração da caixa.
//
// Corre com: npm run icons:feed:measure   (precisa do Chrome instalado)
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/assets/feed-icons')
const OUT = join(SRC, '_bounds.json')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const files = readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort()

// O browser resolve herança de <g>, unidades e stroke-width por nós — por isso
// medimos com SVG real em vez de reimplementar o modelo de pintura.
const page = `<body style="margin:0">
${files
  .map((f) => {
    const name = f.replace(/\.svg$/, '')
    const svg = readFileSync(join(SRC, f), 'utf8')
      .replace(/<title[\s\S]*?<\/title>/g, '')
      .replace(/width="[^"]*"/, 'width="240"')
      .replace(/height="[^"]*"/, 'height="240"')
    return `<div data-icon="${name}">${svg}</div>`
  })
  .join('\n')}
<pre id="out"></pre>
<script>
const SHAPES = 'path,circle,rect,line,polyline,polygon';
const res = {};
for (const host of document.querySelectorAll('[data-icon]')) {
  const svg = host.querySelector('svg');
  const vb = svg.getAttribute('viewBox').split(/[ ,]+/).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of svg.querySelectorAll(SHAPES)) {
    const b = el.getBBox();
    const cs = getComputedStyle(el);
    // O traço pinta metade para fora da geometria — conta para o tamanho aparente.
    const pad = (cs.stroke && cs.stroke !== 'none') ? parseFloat(cs.strokeWidth || 0) / 2 : 0;
    x0 = Math.min(x0, b.x - pad); y0 = Math.min(y0, b.y - pad);
    x1 = Math.max(x1, b.x + b.width + pad); y1 = Math.max(y1, b.y + b.height + pad);
  }
  res[host.dataset.icon] = {
    viewBox: vb,
    ink: [ +x0.toFixed(3), +y0.toFixed(3), +(x1 - x0).toFixed(3), +(y1 - y0).toFixed(3) ],
  };
}
document.getElementById('out').textContent = 'JSON_START' + JSON.stringify(res) + 'JSON_END';
</script></body>`

const tmp = join(tmpdir(), 'luxee-measure-feed-icons.html')
writeFileSync(tmp, page)

const dom = execFileSync(
  CHROME,
  ['--headless', '--disable-gpu', '--virtual-time-budget=4000', '--dump-dom', `file://${tmp}`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
)

const m = dom.match(/JSON_START([\s\S]*?)JSON_END/)
if (!m) throw new Error('não consegui ler as medidas do Chrome')

const bounds = JSON.parse(m[1].replace(/&quot;/g, '"'))
writeFileSync(OUT, JSON.stringify(bounds, null, 2) + '\n')

console.log(`_bounds.json: ${Object.keys(bounds).length} ícones medidos`)
for (const [n, b] of Object.entries(bounds)) {
  const S = b.viewBox[2]
  const occ = ((Math.max(b.ink[2], b.ink[3]) / S) * 100).toFixed(0)
  console.log(`  ${n.padEnd(22)} caixa ${String(S).padEnd(4)} tinta ${b.ink[2].toFixed(1)}×${b.ink[3].toFixed(1)}  ocupa ${occ}%`)
}
