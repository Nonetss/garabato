// Stand-in for Garabato's install endpoints, for tests/install/run.sh. It
// renders the repository's install script with the backend's own renderer.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  expiredInstallScript,
  renderInstallScript,
} from "../../../../packages/api/src/shared/token-module"

const CODE = "7KQ4XMPA"
const KEY = "gbt_test_secret_key"
const modulePath = process.env.MODULE_PATH
if (!modulePath) throw new Error("MODULE_PATH is required")
const moduleBytes = readFileSync(modulePath)
const moduleSha256 = new Bun.CryptoHasher("sha256")
  .update(moduleBytes)
  .digest("hex")
const installDir = join(import.meta.dir, "../../install")

let redeems = 0
let redeemed = false

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url)
    const origin = `http://127.0.0.1:${server.port}`
    switch (url.pathname) {
      case "/api/v1/certificateToken/installScript": {
        const windows = url.searchParams.get("os") === "windows"
        const os = windows ? "windows" : "linux"
        const headers = { "content-type": "text/plain; charset=utf-8" }
        if (url.searchParams.get("code") !== CODE || redeemed) {
          return new Response(expiredInstallScript(os), { headers })
        }
        const files = windows
          ? ["install.ps1", "uninstall.ps1"]
          : ["install.sh", "uninstall.sh"]
        const script = renderInstallScript(
          readFileSync(join(installDir, files[0] ?? ""), "utf8"),
          readFileSync(join(installDir, files[1] ?? ""), "utf8"),
          origin,
          CODE
        )
        return new Response(script, { headers })
      }
      case "/api/v1/certificateToken/module":
        return new Response(moduleBytes)
      case "/api/v1/certificateToken/redeem": {
        redeems++
        const body = await request.json()
        if (body.code !== CODE || redeemed) {
          return Response.json({ code: "NOT_FOUND" }, { status: 404 })
        }
        redeemed = true
        return Response.json({ url: origin, key: KEY, moduleSha256 })
      }
      case "/api/v1/certificateToken/certificates":
        return Response.json([])
      case "/stats":
        return Response.json({ redeems })
      case "/reset":
        redeemed = false
        return Response.json({ ok: true })
      default:
        return new Response("not found", { status: 404 })
    }
  },
})

console.log(server.port)
