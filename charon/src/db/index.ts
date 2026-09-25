import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'

import * as schema from './schema.ts'

const sqlite = new Database(process.env.CHARON_DB_PATH ?? 'charon.db')
sqlite.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
export const db = drizzle(sqlite, { schema })
