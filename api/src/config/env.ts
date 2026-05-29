import dotenv from 'dotenv'
dotenv.config()

export const env = {
  databaseUrl:          process.env.DATABASE_URL ?? '',
  jwtSecret:            process.env.JWT_SECRET ?? 'secret',
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN ?? '7d',
  port:                 Number(process.env.PORT ?? 3000),
  nodeEnv:              process.env.NODE_ENV ?? 'development',
  maxFileSize:          Number(process.env.MAX_FILE_SIZE ?? 52428800),
  cloudinaryCloudName:  process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey:     process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret:  process.env.CLOUDINARY_API_SECRET ?? '',
}
