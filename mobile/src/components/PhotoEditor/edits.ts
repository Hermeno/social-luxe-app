/**
 * O que uma edição é, e o shader que a desenha.
 *
 * Há um só sítio onde a imagem é transformada — este shader. A pré-visualização
 * no ecrã e o ficheiro que sai para o servidor passam pelo mesmo código, com os
 * mesmos números; o que a pessoa vê é o que fica publicado.
 */
import { Skia } from '@shopify/react-native-skia'

// ── O que se pode mexer ───────────────────────────────────────────────────────
export interface Adjust {
  sharpen:    number   // 0 … 1     nitidez (máscara de contraste)
  brightness: number   // -0.3 … 0.3
  contrast:   number   // -0.5 … 0.5
  saturation: number   // -1 … 1    (-1 = preto e branco)
  warmth:     number   // -1 … 1    (frio … quente)
  fade:       number   // 0 … 1     pretos levantados, como película
  vignette:   number   // 0 … 1
}

export type Rotation = 0 | 90 | 180 | 270

/** Recorte em coordenadas 0…1 da imagem **já rodada e espelhada**. */
export interface CropRect { x: number; y: number; w: number; h: number }

export interface PhotoEdit {
  rotate: Rotation
  flipH:  boolean
  crop:   CropRect
  adjust: Adjust
  preset: string
}

export const NEUTRAL: Adjust = {
  sharpen: 0, brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, vignette: 0,
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 }

export const NO_EDIT: PhotoEdit = {
  rotate: 0, flipH: false, crop: FULL_CROP, adjust: NEUTRAL, preset: 'none',
}

export function newEdit(): PhotoEdit {
  return { rotate: 0, flipH: false, crop: { ...FULL_CROP }, adjust: { ...NEUTRAL }, preset: 'none' }
}

// ── Comparações ───────────────────────────────────────────────────────────────
const EPS = 0.0005

export function isNeutral(a: Adjust): boolean {
  return (
    a.sharpen < EPS && Math.abs(a.brightness) < EPS && Math.abs(a.contrast) < EPS &&
    Math.abs(a.saturation) < EPS && Math.abs(a.warmth) < EPS &&
    a.fade < EPS && a.vignette < EPS
  )
}

export function isFullCrop(c: CropRect): boolean {
  return c.x < EPS && c.y < EPS && c.w > 1 - EPS && c.h > 1 - EPS
}

/** Nada mexido → o ficheiro original segue intacto, sem recompressão. */
export function isUntouched(e: PhotoEdit): boolean {
  return e.rotate === 0 && !e.flipH && isFullCrop(e.crop) && isNeutral(e.adjust)
}

// ── Limites de cada regulador ─────────────────────────────────────────────────
export type AdjustKey = keyof Adjust

export const ADJUST_RANGE: Record<AdjustKey, { min: number; max: number }> = {
  sharpen:    { min: 0,    max: 1 },
  brightness: { min: -0.3, max: 0.3 },
  contrast:   { min: -0.5, max: 0.5 },
  saturation: { min: -1,   max: 1 },
  warmth:     { min: -1,   max: 1 },
  fade:       { min: 0,    max: 1 },
  vignette:   { min: 0,    max: 1 },
}

/** Ordem em que os reguladores aparecem — nitidez primeiro, foi o pedido. */
export const ADJUST_ORDER: AdjustKey[] = [
  'sharpen', 'brightness', 'contrast', 'saturation', 'warmth', 'fade', 'vignette',
]

// ── Filtros: um ponto de partida, não uma prisão ──────────────────────────────
// Escolher um filtro escreve estes valores nos reguladores. A pessoa continua a
// poder mexer em tudo a seguir — deixa de haver "filtro" e passa a haver "teu".
export interface Preset { id: string; adjust: Adjust }

const mk = (a: Partial<Adjust>): Adjust => ({ ...NEUTRAL, ...a })

export const PRESETS: Preset[] = [
  { id: 'none',     adjust: mk({}) },
  { id: 'crisp',    adjust: mk({ sharpen: 0.55, contrast: 0.08 }) },
  { id: 'vivid',    adjust: mk({ sharpen: 0.3, saturation: 0.32, contrast: 0.14 }) },
  { id: 'warm',     adjust: mk({ warmth: 0.42, brightness: 0.04, saturation: 0.1 }) },
  { id: 'cool',     adjust: mk({ warmth: -0.4, contrast: 0.08 }) },
  { id: 'film',     adjust: mk({ fade: 0.38, saturation: -0.16, contrast: 0.1, vignette: 0.28 }) },
  { id: 'mono',     adjust: mk({ saturation: -1, contrast: 0.16, sharpen: 0.3 }) },
  { id: 'soft',     adjust: mk({ brightness: 0.07, contrast: -0.12, saturation: -0.06, fade: 0.18 }) },
]

// ── Formatos de recorte ───────────────────────────────────────────────────────
export interface AspectOption { id: string; ratio: number | null }

export const ASPECTS: AspectOption[] = [
  { id: 'free',     ratio: null },
  { id: 'original', ratio: 0 },      // 0 = usar o rácio da própria imagem
  { id: 'square',   ratio: 1 },
  { id: 'portrait', ratio: 4 / 5 },
  { id: 'classic',  ratio: 3 / 4 },
  { id: 'wide',     ratio: 16 / 9 },
]

/** Rácio pedido por um formato, já resolvido contra o tamanho real da foto. */
export function ratioFor(id: string, imgW: number, imgH: number): number | null {
  const found = ASPECTS.find((a) => a.id === id)
  if (!found || found.ratio === null) return null
  return found.ratio === 0 ? imgW / imgH : found.ratio
}

/** Maior recorte com este rácio que cabe na foto, ao centro. */
export function centeredCrop(ratio: number, imgW: number, imgH: number): CropRect {
  const imgRatio = imgW / imgH
  let w = 1
  let h = 1
  if (ratio > imgRatio) h = imgRatio / ratio
  else w = ratio / imgRatio
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

// Rodar ou espelhar não deve deitar fora o recorte já feito — leva-se o
// retângulo com a foto, para o mesmo pedaço continuar escolhido.
export function rotateCrop(c: CropRect, dir: -1 | 1): CropRect {
  return dir === 1
    ? { x: 1 - c.y - c.h, y: c.x,           w: c.h, h: c.w }   // um quarto à direita
    : { x: c.y,           y: 1 - c.x - c.w, w: c.h, h: c.w }   // um quarto à esquerda
}

export function flipCrop(c: CropRect): CropRect {
  return { x: 1 - c.x - c.w, y: c.y, w: c.w, h: c.h }
}

// ── Shader ────────────────────────────────────────────────────────────────────
// A ordem das declarações é contrato: `packUniforms` escreve o array plano por
// esta ordem. Mexer numa exige mexer na outra.
const SKSL = `
uniform shader image;

uniform float2 uOrigin;
uniform float2 uSize;
uniform float  uStep;
uniform float  uSharpen;
uniform float  uBrightness;
uniform float  uContrast;
uniform float  uSaturation;
uniform float  uWarmth;
uniform float  uFade;
uniform float  uVignette;

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  float3 c = float3(float(src.r), float(src.g), float(src.b));

  // Nitidez — o pixel menos a média dos quatro vizinhos devolve a aresta;
  // somá-la de volta é o que faz o detalhe saltar sem inventar nada.
  if (uSharpen > 0.0) {
    half4 l = image.eval(xy + float2(-uStep, 0.0));
    half4 r = image.eval(xy + float2( uStep, 0.0));
    half4 u = image.eval(xy + float2(0.0, -uStep));
    half4 d = image.eval(xy + float2(0.0,  uStep));
    float3 ring = float3(
      float(l.r) + float(r.r) + float(u.r) + float(d.r),
      float(l.g) + float(r.g) + float(u.g) + float(d.g),
      float(l.b) + float(r.b) + float(u.b) + float(d.b)
    ) * 0.25;
    c = clamp(c + (c - ring) * uSharpen, 0.0, 1.0);
  }

  c = clamp(c + uBrightness, 0.0, 1.0);
  c = clamp((c - 0.5) * (1.0 + uContrast) + 0.5, 0.0, 1.0);

  float luma = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  c = clamp(mix(float3(luma, luma, luma), c, 1.0 + uSaturation), 0.0, 1.0);

  c = clamp(float3(c.r + uWarmth * 0.10, c.g, c.b - uWarmth * 0.10), 0.0, 1.0);
  c = clamp(mix(c, c * 0.80 + 0.15, uFade), 0.0, 1.0);

  if (uVignette > 0.0) {
    float2 p = (xy - uOrigin) / max(uSize, float2(1.0, 1.0)) - float2(0.5, 0.5);
    float dist = clamp(length(p) * 1.4142, 0.0, 1.0);
    c = c * (1.0 - uVignette * smoothstep(0.40, 1.0, dist));
  }

  return half4(half(c.r), half(c.g), half(c.b), src.a);
}
`

// Compilar uma vez e guardar. Se falhar, devolve null em vez de rebentar: o
// editor esconde a cor e a nitidez e continua a cortar, rodar e espelhar.
let cached: ReturnType<typeof Skia.RuntimeEffect.Make> | null = null
let tried = false

export function effect() {
  if (!tried) {
    tried = true
    try { cached = Skia.RuntimeEffect.Make(SKSL) } catch { cached = null }
  }
  return cached
}

export interface Frame { x: number; y: number; width: number; height: number }

/** Para a API declarativa (`<Shader uniforms={…}>`), onde os nomes bastam. */
export function uniformsFor(a: Adjust, frame: Frame, step: number) {
  return {
    uOrigin:     [frame.x, frame.y],
    uSize:       [frame.width, frame.height],
    uStep:       step,
    uSharpen:    a.sharpen,
    uBrightness: a.brightness,
    uContrast:   a.contrast,
    uSaturation: a.saturation,
    uWarmth:     a.warmth,
    uFade:       a.fade,
    uVignette:   a.vignette,
  }
}

/** Para a API imperativa, que só aceita a lista plana — a ordem é a do SkSL. */
export function packUniforms(a: Adjust, frame: Frame, step: number): number[] {
  return [
    frame.x, frame.y,
    frame.width, frame.height,
    step,
    a.sharpen, a.brightness, a.contrast, a.saturation, a.warmth, a.fade, a.vignette,
  ]
}
