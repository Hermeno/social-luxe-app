import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { verifyToken } from './utils/jwt'
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

// ── Body parsing ─────────────────────────────────────────────────────────────
// Must come before the rate limiters: the per-phone auth limiter reads req.body
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// ── Rate limiting ────────────────────────────────────────────────────────────
// Key authenticated traffic by user, not IP — mobile carriers put thousands of
// users behind one CGNAT IP, so pure-IP buckets punish innocent users.
function userOrIpKey(req: express.Request): string {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) {
    try { return `user:${verifyToken(auth.slice(7)).userId}` } catch { /* fall back to IP */ }
  }
  return ipKeyGenerator(req.ip ?? '')
}

// Generous per-IP/user ceiling for auth — the strict guard is per phone below
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
})

// Brute-force guard: strict limit per target phone number, independent of IP
const phoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => typeof req.body?.phone !== 'string',
  keyGenerator: (req) => `phone:${req.body.phone}`,
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 120,
  message: { success: false, message: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
})

app.use('/api/v1/auth', authLimiter, phoneLimiter)
app.use('/api/v1', apiLimiter)

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1', routes)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

app.use(errorMiddleware)

export default app
