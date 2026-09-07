#!/usr/bin/env node
// Confere margens e paridade SVG → formas nativas; as medidas nunca reenquadram o desenho.
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/assets/feed-icons')
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const source = readFileSync(join(ROOT, 'src/components/FeedIcon/paths.ts'), 'utf8')
const start = source.indexOf('export const feedIcons = ') + 'export const feedIcons = '.length
const end = source.indexOf('\n} satisfies', start)
const icons = new Function(`return ${source.slice(start, end + 2)}`)()
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
const jobs = readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort().map((file) => {
  const name = file.slice(0, -4)
  const def = icons[name]
  const shapes = def.shapes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`).join('')
  return { name, svg: readFileSync(join(SRC, file), 'utf8'), runtime: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${def.viewBox}" fill="none">${shapes}</svg>` }
})
const page = `<!doctype html><html><body><script>
const jobs = ${JSON.stringify(jobs)};
const scale = 16, size = 24 * scale;
async function raster(svg) {
  const image = new Image();
  await new Promise((ok, fail) => {
    image.onload = ok; image.onerror = fail;
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/width="24"/, 'width="384"').replace(/height="24"/, 'height="384"').replace(/currentColor/g, '#000000'));
  });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}
(async () => {
  const result = {}, failures = [];
  for (const job of jobs) {
    const pixels = await raster(job.svg), runtime = await raster(job.runtime);
    let x0 = size, y0 = size, x1 = -1, y1 = -1, area = 0, sumX = 0, sumY = 0, mismatch = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4 + 3, alpha = pixels[i] / 255;
      if (pixels[i] !== runtime[i]) mismatch++;
      area += alpha; sumX += (x + .5) * alpha; sumY += (y + .5) * alpha;
      if (pixels[i] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    const round = (v) => +v.toFixed(4);
    result[job.name] = { viewBox: [0, 0, 24, 24], ink: [x0 / scale, y0 / scale, (x1 - x0 + 1) / scale, (y1 - y0 + 1) / scale], centroid: [round(sumX / area / scale), round(sumY / area / scale)], area: round(area / scale / scale), runtimePixelDifferences: mismatch };
    if (mismatch) failures.push(job.name + ': SVG e runtime divergem em ' + mismatch + ' pixels');
    if (x0 < 32 || y0 < 32 || x1 >= 352 || y1 >= 352) failures.push(job.name + ': tinta fora da margem de 2 unidades');
  }
  for (const [outline, solid] of [['heart','heart-solid'],['chat-outline','chat-solid'],['chat-teardrop-light','chat-teardrop-fill'],['play-list-4','play-list-4-solid']]) {
    if (JSON.stringify(result[outline].ink) !== JSON.stringify(result[solid].ink)) failures.push(outline + ': silhueta externa muda no estado preenchido');
  }
  document.body.innerHTML = '<pre id="result"></pre>';
  document.querySelector('pre').textContent = 'JSON_START' + JSON.stringify({ result, failures }) + 'JSON_END';
})().catch((error) => { document.body.innerHTML = '<pre id="result">JSON_START' + JSON.stringify({ failures: [String(error)] }) + 'JSON_END</pre>'; });
</script></body></html>`
const temp = mkdtempSync(join(tmpdir(), 'luxee-svg-check-'))
writeFileSync(join(temp, 'measure.html'), page)
const measured = await new Promise((resolve, reject) => {
  const browser = spawn(CHROME, ['--headless', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(temp, 'profile')}`, '--virtual-time-budget=10000', '--dump-dom', `file://${join(temp, 'measure.html')}`], { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let stdout = '', stderr = '', settled = false
  const timer = setTimeout(() => finish(new Error(`Chrome não devolveu as medidas: ${stderr.slice(-500)}`)), 45000)
  function finish(error, value) {
    if (settled) return
    settled = true; clearTimeout(timer)
    try { process.kill(-browser.pid, 'SIGKILL') } catch { browser.kill('SIGKILL') }
    browser.stdout.destroy(); browser.stderr.destroy(); browser.unref()
    if (error) reject(error); else resolve(value)
  }
  browser.stdout.on('data', (chunk) => {
    stdout += chunk
    const match = stdout.match(/<pre id="result">JSON_START([\s\S]*?)JSON_END<\/pre>/)
    if (match) {
      try { finish(null, JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))) } catch (error) { finish(error) }
    }
  })
  browser.stderr.on('data', (chunk) => { stderr += chunk })
  browser.on('error', (error) => finish(error))
  browser.on('close', (code) => { if (!settled) finish(new Error(`Chrome terminou (${code}): ${stderr.slice(-500)}`)) })
})
if (measured.failures.length) throw new Error(measured.failures.join('\n'))
writeFileSync(join(SRC, '_bounds.json'), JSON.stringify(measured.result, null, 2) + '\n')
console.log(`${jobs.length} SVGs: margem 2px, estados alinhados e paridade de pixels com runtime confirmados.`)
