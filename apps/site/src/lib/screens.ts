import type { ImageMetadata } from "astro"
import type { TourStopId } from "@/i18n/ui"
// The screenshots are the ones the README uses (repo root `doc/screenshots/`),
// so both stay in sync. Astro resizes them to WebP at build time. A screen
// with a `-dark` capture shows it while the site is in the dark theme.
import certificates from "../../../../doc/screenshots/certificates.webp"
import documents from "../../../../doc/screenshots/documents.webp"
import documentsDark from "../../../../doc/screenshots/documents-dark.webp"
import home from "../../../../doc/screenshots/home.webp"
import sign from "../../../../doc/screenshots/sign.webp"
import signatures from "../../../../doc/screenshots/signatures.webp"
import viewer from "../../../../doc/screenshots/viewer.webp"
import viewerDark from "../../../../doc/screenshots/viewer-dark.webp"

export interface Screen {
  id: "dashboard" | TourStopId
  route: string
  image: ImageMetadata
  /** The same screen in the dark theme, when it has been captured. */
  dark?: ImageMetadata
}

export const dashboard: Screen = { id: "dashboard", route: "/", image: home }

export const tourScreens: (Screen & { id: TourStopId })[] = [
  { id: "sign", route: "/documents/:id", image: sign },
  {
    id: "versions",
    route: "/documents/:id",
    image: viewer,
    dark: viewerDark,
  },
  {
    id: "library",
    route: "/documents",
    image: documents,
    dark: documentsDark,
  },
  { id: "certificates", route: "/certificates", image: certificates },
  { id: "signatures", route: "/signatures", image: signatures },
]

// The widest step serves the full-screen viewer on large and dense displays.
export const screenWidths = [720, 1200, 1800, 2400]
