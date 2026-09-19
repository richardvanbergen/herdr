import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'

import * as schema from './schema.ts'

const sqlite = new Database('charon.db')
export const db = drizzle(sqlite, { schema })
