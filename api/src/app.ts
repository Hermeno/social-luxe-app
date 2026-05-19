import express from 'express'
import cors from 'cors'
import path from 'path'
import routes from './routes'
import { errorMiddleware } from './middlewares/error.middleware'
import { env } from './config/env'

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(process.cwd(), env.uploadDir)))

app.use('/api/v1', routes)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }))

app.use(errorMiddleware)

export default app
