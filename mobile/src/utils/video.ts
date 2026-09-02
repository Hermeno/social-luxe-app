import type { VideoPlayer, VideoSource } from 'expo-video'

import { resolveMediaUrl } from './media'

/**
 * A feed cell is never wider than a phone screen. Sending a 2K/4K source to it
 * only spends radio time and battery; the extra pixels are discarded by the
 * renderer. `q_auto:eco` is Cloudinary's profile intended for high-traffic
 * social feeds and keeps the original asset untouched in storage.
 */
export const VIDEO_DELIVERY_TRANSFORM = 'c_limit,w_1080/q_auto:eco/vc_h264'

const VIDEO_TRANSFORM_PATH = `/video/upload/${VIDEO_DELIVERY_TRANSFORM}/`
const CLOUDINARY_VIDEO_PATH = '/video/upload/'

/** Keep inactive/feed-adjacent players from fetching tens of seconds ahead. */
export const CONSERVATIVE_VIDEO_BUFFER = {
  preferredForwardBufferDuration: 6,
  minBufferForPlayback: 1,
  maxBufferBytes: 8 * 1024 * 1024,
  prioritizeTimeOverSizeThreshold: false,
} as const

function replaceExtension(url: string, extension: string): string {
  const suffixAt = url.search(/[?#]/)
  const base = suffixAt >= 0 ? url.slice(0, suffixAt) : url
  const suffix = suffixAt >= 0 ? url.slice(suffixAt) : ''
  const slashAt = base.lastIndexOf('/')
  const dotAt = base.lastIndexOf('.')
  const next = dotAt > slashAt ? `${base.slice(0, dotAt)}.${extension}` : `${base}.${extension}`
  return `${next}${suffix}`
}

/**
 * Build the lightweight progressive MP4 used by native players.
 *
 * Non-Cloudinary URLs still benefit from expo-video's cache and bounded
 * buffering; they simply cannot receive a server-side transformation here.
 */
export function optimizeVideoUrl(url: string | null | undefined): string {
  const resolved = resolveMediaUrl(url)
  if (!resolved.includes('cloudinary.com') || !resolved.includes(CLOUDINARY_VIDEO_PATH)) {
    return resolved
  }
  if (resolved.includes(VIDEO_TRANSFORM_PATH)) return replaceExtension(resolved, 'mp4')

  return replaceExtension(
    resolved.replace(CLOUDINARY_VIDEO_PATH, VIDEO_TRANSFORM_PATH),
    'mp4',
  )
}

/** A stable source that enables expo-video's persistent native byte cache. */
export function videoSource(url: string | null | undefined): VideoSource {
  const uri = optimizeVideoUrl(url)
  if (!uri) return null

  const remote = /^https?:\/\//i.test(uri)
  return remote
    ? { uri, useCaching: true, contentType: 'progressive' }
    : { uri }
}

/** Apply the same small network buffer to every remote video surface. */
export function configureVideoPlayer(player: VideoPlayer): void {
  player.staysActiveInBackground = false
  player.bufferOptions = CONSERVATIVE_VIDEO_BUFFER
}

/**
 * Return a real JPEG frame for grids/cards without ever handing an MP4 to an
 * Image component. For storage providers without thumbnail transforms, use the
 * API thumbnail when present and otherwise render the caller's empty state.
 */
export function videoPosterUrl(
  mediaUrl: string | null | undefined,
  thumbnailUrl?: string | null,
  width = 480,
): string {
  const resolved = resolveMediaUrl(mediaUrl)
  if (resolved.includes('cloudinary.com') && resolved.includes(CLOUDINARY_VIDEO_PATH)) {
    // Be idempotent if the API/client already supplied the playback derivative.
    const originalPath = resolved.replace(VIDEO_TRANSFORM_PATH, CLOUDINARY_VIDEO_PATH)
    const posterTransform = `so_0,c_limit,w_${Math.max(64, Math.round(width))}/q_auto:eco/f_jpg`
    return replaceExtension(
      originalPath.replace(CLOUDINARY_VIDEO_PATH, `/video/upload/${posterTransform}/`),
      'jpg',
    )
  }
  return resolveMediaUrl(thumbnailUrl)
}
