import { env } from "@nonete/env/server"
import {
  requestTimestamp,
  type Timestamper,
} from "#v1/document/pades/timestamp"

function configuredTimestamper(): Timestamper | null {
  const url = env.TSA_URL
  if (!url) return null
  return (data) => requestTimestamp(url, data)
}

const timestamper = configuredTimestamper()

/**
 * The TSA set in `TSA_URL`, or null when signatures stay B-B. Unit tests
 * replace this module with a fake TSA (`tests/setup.ts`).
 */
export function getTimestamper(): Timestamper | null {
  return timestamper
}
