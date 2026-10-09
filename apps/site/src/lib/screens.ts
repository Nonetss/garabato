import type { ImageMetadata } from "astro"
import type { TourStopId } from "@/i18n/ui"
// The screenshots are the ones the README uses (repo root `doc/screenshots/`),
// so both stay in sync. Astro resizes them to WebP at build time.
import certificates from "../../../../doc/screenshots/certificates.webp"
import documents from "../../../../doc/screenshots/documents.webp"
import home from "../../../../doc/screenshots/home.webp"
import sign from "../../../../doc/screenshots/sign.webp"
import signatures from "../../../../doc/screenshots/signatures.webp"
import viewer from "../../../../doc/screenshots/viewer.webp"

export interface Screen {
  id: "dashboard" | TourStopId
  route: string
  image: ImageMetadata
}

export const dashboard: Screen = { id: "dashboard", route: "/", image: home }

export const tourScreens: (Screen & { id: TourStopId })[] = [
  { id: "sign", route: "/documents/:id", image: sign },
  { id: "versions", route: "/documents/:id", image: viewer },
  { id: "library", route: "/documents", image: documents },
  { id: "certificates", route: "/certificates", image: certificates },
  { id: "signatures", route: "/signatures", image: signatures },
]

// The widest step serves the full-screen viewer on large and dense displays.
export const screenWidths = [720, 1200, 1800, 2400]
