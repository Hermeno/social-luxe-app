import dotenv from 'dotenv'
dotenv.config()

const nodeEnv = process.env.NODE_ENV ?? 'development'
const jwtSecret = process.env.JWT_SECRET ?? ''

// A missing/placeholder secret in production would make every token forgeable.
// Refuse to boot rather than run wide open. ('dev-secret' fallback is dev-only.)
if (nodeEnv === 'production' && (jwtSecret.length === 0 || jwtSecret === 'secret' || jwtSecret === 'dev-secret')) {
  throw new Error('[env] JWT_SECRET must be set to a strong value in production — refusing to start')
}

export const env = {
  databaseUrl:          process.env.DATABASE_URL ?? '',
  jwtSecret:            jwtSecret || 'dev-secret',
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN ?? '365d',
  port:                 Number(process.env.PORT ?? 3000),
  nodeEnv:              process.env.NODE_ENV ?? 'development',
  maxFileSize:          Number(process.env.MAX_FILE_SIZE ?? 157286400),
  cloudinaryCloudName:  process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey:     process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret:  process.env.CLOUDINARY_API_SECRET ?? '',
  // Cloudflare R2 — used for post media (images and videos)
  r2AccountId:          process.env.R2_ACCOUNT_ID ?? '',
  r2AccessKeyId:        process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey:    process.env.R2_SECRET_ACCESS_KEY ?? '',
  r2BucketName:         process.env.R2_BUCKET_NAME ?? '',
  r2PublicUrl:          (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, ''),
}
