import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import routes from './routes'
import { errorMiddleware } from './middlewares/error.middleware'
import { env } from './config/env'
// Import cloudinary config at startup so it's always initialized
import './config/cloudinary'

const app = express()

// Trust the first proxy (Render, Heroku, Railway, etc.) so that
// express-rate-limit can read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1)

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = env.nodeEnv === 'production'
  ? (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:19006', /^http:\/\/192\.168\./]

app.use(cors({
  origin: env.nodeEnv === 'production' ? allowedOrigins : true,
  credentials: true,
}))

// ── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  message: { success: false, message: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/v1/auth', authLimiter)
app.use('/api/v1', apiLimiter)

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1', routes)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

app.use(errorMiddleware)

export default app
