import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomBytes } from 'crypto'
import { r2 } from '../config/r2'
import { env } from '../config/env'

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4':       'mp4',
  'video/quicktime': 'mp4',
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
}

export async function uploadToR2(
  buffer: Buffer,
  mimetype: string,
  folder: string,
): Promise<string> {
  const ext = MIME_TO_EXT[mimetype] ?? mimetype.split('/')[1] ?? 'bin'
  const key = `${folder}/${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`

  await r2.send(new PutObjectCommand({
    Bucket:       env.r2BucketName,
    Key:          key,
    Body:         buffer,
    ContentType:  mimetype,
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  return `${env.r2PublicUrl}/${key}`
}

export async function deleteFromR2(url: string): Promise<void> {
  if (!url || !env.r2PublicUrl || !url.startsWith(env.r2PublicUrl)) return
  try {
    const key = url.slice(env.r2PublicUrl.length + 1) // strip base URL + leading slash
    await r2.send(new DeleteObjectCommand({ Bucket: env.r2BucketName, Key: key }))
  } catch {}
}

export function isR2Url(url: string | null | undefined): boolean {
  return !!url && !!env.r2PublicUrl && url.startsWith(env.r2PublicUrl)
}
