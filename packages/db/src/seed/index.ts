import { logger } from "@nonete/logger"

import { type AuthLike, seedAdmin } from "#seed/admin"
import { runMigrations } from "#seed/migrate"

export async function seed(auth: AuthLike) {
  logger.info("running database migrations")
  await runMigrations()

  const seedResult = await seedAdmin(auth)
  if (seedResult.created) {
    logger.info({ email: seedResult.email }, "admin user created")
  } else if (seedResult.reason === "already-exists") {
    logger.info({ email: seedResult.email }, "admin user already exists")
  } else {
    logger.info("admin seed skipped (ADMIN_EMAIL or ADMIN_PASSWORD not set)")
  }
}
