import fs from 'fs'
import { cloudinary } from '../config/cloudinary'
import { UploadApiResponse } from 'cloudinary'
import { MediaType } from '@prisma/client'

// ── Upload ─────────────────────────────────────────────────────────────────────

// Multer (diskStorage) hands us a temp file path; Cloudinary reads it from disk
// so the file is never held in memory. The temp file is always removed here.
type UploadedFile = { path: string; mimetype: string }

export async function uploadToCloudinary(
  file: UploadedFile,
  folder: string = 'luxe',
): Promise<string> {
  const isVideo = file.mimetype.startsWith('video')
  const isAudio = file.mimetype.startsWith('audio')

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
    : {
        folder,
        resource_type: 'image' as const,
        quality: 'auto:best',
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
      return result.secure_url
    }

    const result = await cloudinary.uploader.upload(file.path, options)
    return result.secure_url
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

// ── Attach thumbnailUrl to post objects ────────────────────────────────────────

type WithCount = {
  mediaUrl: string | null
  mediaType: MediaType
  [key: string]: unknown
}

export function withThumbnail<T extends WithCount>(post: T): T & { thumbnailUrl: string } {
  return { ...post, thumbnailUrl: generateThumbnailUrl(post.mediaUrl, post.mediaType) }
}

export function withThumbnails<T extends WithCount>(posts: T[]): (T & { thumbnailUrl: string })[] {
  return posts.map(withThumbnail)
}
