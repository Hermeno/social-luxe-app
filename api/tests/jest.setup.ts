import path from 'path'
import dotenv from 'dotenv'

// Runs BEFORE any test file (and therefore before `src/app.ts` / `src/config/database.ts`)
// is imported, so this is the only place that can safely control which database the
// whole test run — including the real app code exercised through supertest — talks to.
//
// `.env.test` must point at a database that is NOT production. It is not loaded by
// anything except this file, and `override: true` makes sure it wins over `.env`.
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true })

// Hard-coded because a config typo must never be able to silently point tests back at
// prod. This is the actual Neon host backing Render — see api/.env.
const PRODUCTION_HOST = 'ep-summer-resonance-apkj1bw3'

const dbUrl = process.env.DATABASE_URL ?? ''

if (!dbUrl) {
  throw new Error(
    '\n\nREFUSING TO RUN TESTS: no DATABASE_URL is set.\n' +
    'Create api/.env.test with a DATABASE_URL pointing at a dedicated test database ' +
    '(e.g. a separate Neon branch) — tests will not run without one, because the old ' +
    'behaviour (falling back to api/.env) once wiped every user/post/like in production.\n',
  )
}

if (dbUrl.includes(PRODUCTION_HOST)) {
  throw new Error(
    '\n\nREFUSING TO RUN TESTS: DATABASE_URL resolves to the PRODUCTION database ' +
    `(${PRODUCTION_HOST}). tests/helpers.ts's cleanDb() deletes every row in User, ` +
    'Post, Like, etc. Point api/.env.test at a separate database before running tests ' +
    'again.\n',
  )
}
