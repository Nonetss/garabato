import { env } from "@nonete/env/server"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

export async function runMigrations() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
  })
  try {
    const migrationDb = drizzle({ client: pool })
    await migrate(migrationDb, {
      migrationsFolder: "../../packages/db/src/migrations",
    })
  } finally {
    await pool.end()
  }
}
