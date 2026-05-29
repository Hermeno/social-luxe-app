import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'
import { env } from '../config/env'

// Store files in memory — we upload straight to Cloudinary
const storage = multer.memoryStorage()

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
