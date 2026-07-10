import multer, { FileFilterCallback } from 'multer'
import os from 'os'
import { Request } from 'express'
import { env } from '../config/env'

// Stream uploads to the OS temp dir instead of buffering whole files in RAM —
// a few concurrent 150 MB videos in memoryStorage would OOM the server.
// The temp file is removed by uploadToCloudinary() once the upload finishes.
const storage = multer.diskStorage({ destination: os.tmpdir() })

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime',
    'audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/ogg',
  ]
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxFileSize },
})
