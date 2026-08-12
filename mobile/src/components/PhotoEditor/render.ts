/**
 * Desenhar uma edição — em pequeno para o ecrã, em grande para o ficheiro.
 *
 * O caminho é sempre o mesmo e sempre por esta ordem:
 *   descodificar → rodar/espelhar → recortar → cor e nitidez → gravar
 *
 * A pré-visualização usa uma cópia reduzida da imagem (rápida de refazer a cada
 * toque no regulador); a publicação repete os mesmos passos sobre o original.
 */
import {
  Skia, FilterMode, MipmapMode, TileMode, ImageFormat, type SkImage,
} from '@shopify/react-native-skia'
import * as FileSystem from 'expo-file-system/legacy'
import {
  type Adjust, type CropRect, type PhotoEdit, type Rotation,
  effect, isFullCrop, isNeutral, isUntouched, packUniforms,
} from './edits'

/** Lado maior da cópia que alimenta o ecrã. Um telemóvel não mostra mais. */
export const PREVIEW_SIDE = 1200

/** Lado maior do ficheiro publicado. Acima disto só cresce o upload. */
export const EXPORT_SIDE = 2048

const EDIT_DIR = `${FileSystem.cacheDirectory}luxe_edits/`

function surfaceOf(w: number, h: number) {
  const surface = Skia.Surface.MakeOffscreen(Math.max(1, w), Math.max(1, h))
  if (!surface) throw new Error('offscreen surface unavailable')
  return surface
}

/**
 * Fecha uma superfície e devolve uma imagem que se pode usar em qualquer lado.
 *
 * `makeImageSnapshot` devolve uma imagem agarrada à textura GPU do contexto
 * onde a superfície nasceu — aqui, o fio do JavaScript. A tela do React desenha
 * noutro fio, com outro contexto, e uma textura estrangeira não pinta nada:
 * a foto simplesmente não aparece. `makeNonTextureImage` traz os pixéis de
 * volta para a memória, que é o que a torna desenhável em qualquer sítio.
 */
function snapshot(surface: ReturnType<typeof surfaceOf>): SkImage {
  surface.flush()
  const shot = surface.makeImageSnapshot()
  try {
    return shot.makeNonTextureImage()
  } catch {
    return shot
  }
}

export async function decode(uri: string): Promise<SkImage> {
  let data = await Skia.Data.fromURI(uri).catch(() => null)

  // Nem todos os caminhos que a galeria devolve são caminhos que o Skia sabe
  // abrir sozinho. Ler os bytes pelo sistema de ficheiros funciona sempre que
  // o ficheiro existe, e é o que salva os casos estranhos.
  if (!data) {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
    data = Skia.Data.fromBase64(b64)
  }

  const img = Skia.Image.MakeImageFromEncoded(data)
  if (!img) throw new Error('image could not be decoded')
  return img
}

/** Reduz sem nunca aumentar — ampliar uma foto só a torna mais mole. */
export function limit(img: SkImage, maxSide: number): SkImage {
  const iw = img.width()
  const ih = img.height()
  const longest = Math.max(iw, ih)
  if (longest <= maxSide) return img

  const k = maxSide / longest
  const w = Math.max(1, Math.round(iw * k))
  const h = Math.max(1, Math.round(ih * k))
  const surface = surfaceOf(w, h)
  surface.getCanvas().drawImageRectOptions(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect(0, 0, w, h),
    FilterMode.Linear,
    MipmapMode.Linear,
  )
  return snapshot(surface)
}

/**
 * Roda e espelha de uma vez. Fica gravado numa imagem própria para que o
 * recorte a seguir trabalhe sempre numa foto já direita — assim as coordenadas
 * do retângulo que a pessoa arrasta no ecrã são as mesmas que saem no ficheiro.
 */
export function orient(img: SkImage, rotate: Rotation, flipH: boolean): SkImage {
  if (rotate === 0 && !flipH) return img

  const iw = img.width()
  const ih = img.height()
  const quarter = rotate === 90 || rotate === 270
  const outW = quarter ? ih : iw
  const outH = quarter ? iw : ih

  const surface = surfaceOf(outW, outH)
  const canvas = surface.getCanvas()
  canvas.save()
  canvas.translate(outW / 2, outH / 2)
  // Espelhar depois de rodar: é o que a pessoa espera de um botão "espelhar",
  // que atua sobre o que está a ver e não sobre o ficheiro original.
  if (flipH) canvas.scale(-1, 1)
  canvas.rotate(rotate, 0, 0)
  canvas.drawImageRectOptions(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect(-iw / 2, -ih / 2, iw, ih),
    FilterMode.Linear,
    MipmapMode.None,
  )
  canvas.restore()
  return snapshot(surface)
}

export function crop(img: SkImage, c: CropRect): SkImage {
  if (isFullCrop(c)) return img

  const iw = img.width()
  const ih = img.height()
  const sw = Math.max(1, Math.round(c.w * iw))
  const sh = Math.max(1, Math.round(c.h * ih))
  const sx = Math.min(Math.max(0, Math.round(c.x * iw)), iw - sw)
  const sy = Math.min(Math.max(0, Math.round(c.y * ih)), ih - sh)

  const surface = surfaceOf(sw, sh)
  surface.getCanvas().drawImageRectOptions(
    img,
    Skia.XYWHRect(sx, sy, sw, sh),
    Skia.XYWHRect(0, 0, sw, sh),
    FilterMode.Linear,
    MipmapMode.None,
  )
  return snapshot(surface)
}

/**
 * `step` é o raio do anel que a nitidez lê, nas unidades da própria imagem.
 *
 * Na pré-visualização vale 1 ponto sobre uma foto que ocupa ~390 pontos de
 * largura — ou seja, 1/390 da largura. O ficheiro final tem de usar o mesmo
 * raio *relativo*, senão a foto publicada sai menos nítida do que a que a
 * pessoa aprovou. Quem chama calcula a proporção e passa-a aqui.
 */
export function recolor(img: SkImage, a: Adjust, step: number): SkImage {
  const fx = effect()
  if (!fx || isNeutral(a)) return img

  const w = img.width()
  const h = img.height()
  const shader = fx.makeShaderWithChildren(
    packUniforms(a, { x: 0, y: 0, width: w, height: h }, step),
    [img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None)],
  )

  const paint = Skia.Paint()
  paint.setShader(shader)

  const surface = surfaceOf(w, h)
  surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, w, h), paint)
  return snapshot(surface)
}

async function writeJpeg(img: SkImage, name: string): Promise<string> {
  const dir = await FileSystem.getInfoAsync(EDIT_DIR)
  if (!dir.exists) await FileSystem.makeDirectoryAsync(EDIT_DIR, { intermediates: true })

  const b64 = img.encodeToBase64(ImageFormat.JPEG, 92)
  const path = `${EDIT_DIR}${name}.jpg`
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 })
  return path
}

/**
 * Aplica a edição ao ficheiro original e devolve o caminho do resultado.
 * Sem nada mexido devolve o URI de entrada — não vale a pena recomprimir uma
 * foto para lhe ficar igual.
 *
 * `previewWidth` é a largura, em pontos, com que a foto foi mostrada no editor.
 * É o que amarra a nitidez do ficheiro à nitidez que a pessoa viu.
 */
export async function renderToFile(
  uri: string,
  edit: PhotoEdit,
  previewWidth: number,
): Promise<string> {
  if (isUntouched(edit)) return uri

  const source = limit(await decode(uri), EXPORT_SIDE)
  const oriented = orient(source, edit.rotate, edit.flipH)
  const cropped = crop(oriented, edit.crop)

  const step = previewWidth > 0 ? Math.max(1, cropped.width() / previewWidth) : 1
  const finished = recolor(cropped, edit.adjust, step)

  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return writeJpeg(finished, name)
}

/** Ficheiros de edições que já foram publicadas ou descartadas. */
export async function clearEditCache(): Promise<void> {
  await FileSystem.deleteAsync(EDIT_DIR, { idempotent: true }).catch(() => {})
}
