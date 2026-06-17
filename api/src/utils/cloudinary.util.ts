import { cloudinary } from '../config/cloudinary'
import { UploadApiResponse } from 'cloudinary'
import { MediaType } from '@prisma/client'

// ── Upload ─────────────────────────────────────────────────────────────────────

export function uploadToCloudinary(
  buffer: Buffer,
  mimetype: string,
  folder: string = 'luxe',
): Promise<string> {
  const isVideo      = mimetype.startsWith('video')
  const resourceType = isVideo ? 'video' : 'image'

  const options = isVideo
    ? {
        folder,
        resource_type: 'video' as const,
        quality:     'auto:good',   // Cloudinary picks optimal bitrate
        video_codec: 'h264',        // web-compatible, smaller files
        audio_codec: 'aac',
      }
    : {
        folder,
        resource_type: 'image' as const,
        quality: 'auto:best',
      }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (err: Error | undefined, result: UploadApiResponse | undefined) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'))
        resolve(result.secure_url)
      },
    )
    stream.end(buffer)
  })
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
  if (mediaType === MediaType.TEXT || !mediaUrl || !mediaUrl.includes('cloudinary.com')) return mediaUrl ?? ''

  try {
    if (mediaType === MediaType.VIDEO) {
      // Video → first frame as blurred JPEG
      return mediaUrl.replace(
        '/video/upload/',
        `/video/upload/so_0,${THUMB_TRANSFORM},f_jpg/`,
      )
    }
    // Image → blurred tiny version
    return mediaUrl.replace(
      '/image/upload/',
      `/image/upload/${THUMB_TRANSFORM}/`,
    )
  } catch {
    return mediaUrl
  }
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
