import type { APIRoute } from "astro"
import logo from "@/assets/logo.svg?raw"

export const GET: APIRoute = () =>
  new Response(logo, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  })
