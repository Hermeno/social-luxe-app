import fs from 'fs'
import { cloudinary } from '../config/cloudinary'
import { UploadApiResponse } from 'cloudinary'
import { MediaType } from '@prisma/client'

// ── Upload ─────────────────────────────────────────────────────────────────────

// Multer (diskStorage) hands us a temp file path; Cloudinary reads it from disk
// so the file is never held in memory. The temp file is always removed here.
type UploadedFile = { path: string; mimetype: string }

/**
 * Dimensões da media, tal como o Cloudinary as reporta no upload.
 *
 * Isto existe porque o cliente precisa de saber a proporção ANTES de a imagem
 * carregar. Sem isso a app desenha a foto à altura toda, descobre a proporção
 * no `onLoad` e encolhe — um salto que se lê como "piscou e desapareceu".
 */
export interface UploadResult {
  url: string
  width: number | null
  height: number | null
}

export async function uploadToCloudinary(
  file: UploadedFile,
  folder: string = 'luxe',
): Promise<string> {
  return (await uploadToCloudinaryWithMeta(file, folder)).url
}

export async function uploadToCloudinaryWithMeta(
  file: UploadedFile,
  folder: string = 'luxe',
): Promise<UploadResult> {
  const isVideo = file.mimetype.startsWith('video')
  const isAudio = file.mimetype.startsWith('audio')
  const isImage = file.mimetype.startsWith('image')

  const options = isVideo
    ? {
        folder,
        resource_type: 'video' as const,
        quality:     'auto:best',
        video_codec: 'h264',
        audio_codec: 'aac',
      }
    : isAudio
    ? {
        folder,
        resource_type: 'video' as const,  // Cloudinary uses 'video' for audio too
      }
    : isImage
    ? {
        folder,
        resource_type: 'image' as const,
        quality: 'auto:best',
      }
    : {
        // Documentos (pdf, doc, xls, zip…) → 'raw', para ficarem descarregáveis
        // tal como foram enviados, mantendo a extensão no URL.
        folder,
        resource_type: 'raw' as const,
        use_filename:   true,
        unique_filename: true,
      }

  try {
    if (isVideo) {
      // upload_large streams from disk in chunks — required for files > ~100 MB
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader.upload_large(
          file.path,
          { ...options, chunk_size: 20 * 1024 * 1024 },
          (err: Error | undefined, res: UploadApiResponse | undefined) => {
            if (err || !res) return reject(err ?? new Error('Upload failed'))
            resolve(res)
          },
        )
      })
      return { url: result.secure_url, width: result.width ?? null, height: result.height ?? null }
    }

    const result = await cloudinary.uploader.upload(file.path, options)
    return { url: result.secure_url, width: result.width ?? null, height: result.height ?? null }
  } finally {
    fs.unlink(file.path, () => {})
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteFromCloudinary(url: string): Promise<void> {
  if (!url || !url.includes('cloudinary.com')) return
  try {
    const isVideo = url.includes('/video/upload/')
    const match   = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
    if (!match) return
    const publicId = match[1]
    await cloudinary.uploader.destroy(publicId, {
      resource_type: isVideo ? 'video' : 'image',
    })
  } catch {}
}

// ── Thumbnail generation (Cloudinary URL transformation) ───────────────────────
//
// No extra upload needed — Cloudinary transforms the URL on the fly.
// The thumbnail is served from Cloudinary CDN, cached automatically.
//
//   Image: /image/upload/w_300,h_300,c_fill,e_blur:700,q_3/<version>/...
//   Video: /video/upload/so_0,w_300,h_300,c_fill,e_blur:700,q_3,f_jpg/<version>/...
//          ↑ extracts frame at 0s and serves as a blurred JPEG image
//
// Result: ~1–3 KB per thumbnail — loads in <50ms on any network.

const THUMB_TRANSFORM = 'w_400,h_400,c_fill,e_blur:700,q_3'

export function generateThumbnailUrl(mediaUrl: string | null, mediaType: MediaType): string {
  if (mediaType === MediaType.TEXT || !mediaUrl) return ''

  if (mediaUrl.includes('cloudinary.com')) {
    try {
      if (mediaType === MediaType.VIDEO) {
        return mediaUrl.replace('/video/upload/', `/video/upload/so_0,${THUMB_TRANSFORM},f_jpg/`)
      }
      return mediaUrl.replace('/image/upload/', `/image/upload/${THUMB_TRANSFORM}/`)
    } catch {
      return mediaUrl
    }
  }

  // R2 or other storage: images use the original URL as thumbnail; videos have no thumbnail
  // (client renders ActivityIndicator while the video player warms up)
  return mediaType === MediaType.VIDEO ? '' : mediaUrl
}

// ── Display transformation (imagens) ───────────────────────────────────────────
//
// Porquê: a app enviava o original (~4000px, 1 MB+) e o telemóvel encolhia-o
// para caber em ~1170px reais. Essa redução é feita pela GPU com filtragem
// bilinear, que ao encolher mais de 2× salta a maior parte dos píxeis de origem
// — daí o aspeto pastoso. Aqui o Cloudinary reduz com um filtro a sério e a
// imagem chega quase no tamanho em que vai ser pintada.
//
//   w_1080,c_limit  largura máxima (mesmo teto que o Instagram usa);
//                   `c_limit` nunca amplia originais mais pequenos
//   q_auto:good     qualidade perceptual, não um número fixo
//   f_auto          serve AVIF/WebP a quem os suporta, JPEG ao resto
//   e_sharpen:60    nitidez DEPOIS da redução (abaixo do 100 por omissão)
//
// Medido numa foto de referência: 1 036 KB → 48 KB, e mais nítida.
//
// Vídeo fica de fora de propósito — precisa de streaming adaptativo, que é
// outra conversa e não se resolve por transformação de URL.
const DISPLAY_TRANSFORM = 'w_1080,c_limit,q_auto:good,f_auto,e_sharpen:60'

/**
 * URL de exibição para uma imagem. Devolve o URL tal e qual se não for uma
 * imagem do Cloudinary — R2 e vídeos passam intactos.
 */
export function optimizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (!url.includes('cloudinary.com') || !url.includes('/image/upload/')) return url
  // Já transformado (ex.: veio de uma resposta anterior) — não empilhar.
  if (url.includes(DISPLAY_TRANSFORM)) return url
  return url.replace('/image/upload/', `/image/upload/${DISPLAY_TRANSFORM}/`)
}

// ── Attach thumbnailUrl to post objects ────────────────────────────────────────

type WithCount = {
  mediaUrl: string | null
  mediaType: MediaType
  [key: string]: unknown
}

export function withThumbnail<T extends WithCount>(post: T): T & { thumbnailUrl: string } {
  // O thumbnail sai do URL ORIGINAL — se saísse do otimizado ficavam duas
  // transformações empilhadas e o desfoque deixava de ser o que se pediu.
  const thumbnailUrl = generateThumbnailUrl(post.mediaUrl, post.mediaType)

  const isImage = post.mediaType !== MediaType.VIDEO && post.mediaType !== MediaType.TEXT
  const rawAlbum = (post as { mediaUrls?: unknown }).mediaUrls
  const album = Array.isArray(rawAlbum)
    ? (rawAlbum as (string | null)[]).map(optimizeImageUrl)
    : undefined

  return {
    ...post,
    ...(isImage ? { mediaUrl: optimizeImageUrl(post.mediaUrl) } : {}),
    ...(album ? { mediaUrls: album } : {}),
    thumbnailUrl,
  }
}

export function withThumbnails<T extends WithCount>(posts: T[]): (T & { thumbnailUrl: string })[] {
  return posts.map(withThumbnail)
}
