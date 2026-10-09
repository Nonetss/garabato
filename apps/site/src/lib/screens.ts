import type { ImageMetadata } from "astro"
import type { TourStopId } from "@/i18n/ui"
// The screenshots are the ones the README uses (repo root `doc/screenshots/`),
// so both stay in sync. Astro resizes them to WebP at build time. Every
// screen comes in both themes: `<name>.webp` and `<name>-dark.webp`.
import certificates from "../../../../doc/screenshots/certificates.webp"
import certificatesDark from "../../../../doc/screenshots/certificates-dark.webp"
import documents from "../../../../doc/screenshots/documents.webp"
import documentsDark from "../../../../doc/screenshots/documents-dark.webp"
import home from "../../../../doc/screenshots/home.webp"
import homeDark from "../../../../doc/screenshots/home-dark.webp"
import sign from "../../../../doc/screenshots/sign.webp"
import signDark from "../../../../doc/screenshots/sign-dark.webp"
import signatures from "../../../../doc/screenshots/signatures.webp"
import signaturesDark from "../../../../doc/screenshots/signatures-dark.webp"
import viewer from "../../../../doc/screenshots/viewer.webp"
import viewerDark from "../../../../doc/screenshots/viewer-dark.webp"

export interface Screen {
  id: "dashboard" | TourStopId
  route: string
  image: ImageMetadata
  /** The same screen in the dark theme. */
  dark: ImageMetadata
}

export const dashboard: Screen = {
  id: "dashboard",
  route: "/",
  image: home,
  dark: homeDark,
}

export const tourScreens: (Screen & { id: TourStopId })[] = [
  { id: "sign", route: "/documents/:id", image: sign, dark: signDark },
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
  {
    id: "certificates",
    route: "/certificates",
    image: certificates,
    dark: certificatesDark,
  },
  {
    id: "signatures",
    route: "/traces",
    image: signatures,
    dark: signaturesDark,
  },
]

// The widest step serves the full-screen viewer on large and dense displays.
export const screenWidths = [720, 1200, 1800, 2400]
