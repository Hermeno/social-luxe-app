import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2 } from '../config/r2'
import { env } from '../config/env'

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
