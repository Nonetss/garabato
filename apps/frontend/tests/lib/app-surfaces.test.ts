import { describe, expect, test } from "bun:test"
import {
  appSurfaceList,
  getAppSurface,
  getAppSurfaceByPath,
  getChildSurfaces,
  getNavigableSurfaces,
  isSurfacePathActive,
} from "@/lib/app-surfaces"

describe("surface registry", () => {
  test("every surface has a unique id and path", () => {
    const ids = appSurfaceList.map((surface) => surface.id)
    const paths = appSurfaceList.map((surface) => surface.path)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(paths).size).toBe(paths.length)
  })

  test("children are flattened with their parent id", () => {
    expect(getAppSurface("config-appearance").parentId).toBe("config")
    expect(getChildSurfaces("config").map((surface) => surface.id)).toContain(
      "config-appearance"
    )
  })

  test("looks a surface up by its exact path", () => {
    expect(getAppSurfaceByPath("/crons")?.id).toBe("crons")
    expect(getAppSurfaceByPath("/crons/123")).toBeUndefined()
  })
})

describe("getNavigableSurfaces", () => {
  test("hides admin-only surfaces from non-admins", () => {
    const surfaces = getNavigableSurfaces(false)
    expect(surfaces.some((surface) => surface.adminOnly)).toBe(false)
    expect(surfaces.every((surface) => surface.nav)).toBe(true)
  })

  test("includes admin-only surfaces for admins", () => {
    const ids = getNavigableSurfaces(true).map((surface) => surface.id)
    expect(ids).toContain("admin")
  })
})

describe("isSurfacePathActive", () => {
  test("matches the path itself and nested routes", () => {
    expect(isSurfacePathActive("/crons", "/crons")).toBe(true)
    expect(isSurfacePathActive("/crons", "/crons/abc")).toBe(true)
  })

  test("doesn't match a sibling that only shares a prefix", () => {
    expect(isSurfacePathActive("/config", "/configuration")).toBe(false)
  })

  test("the root only matches itself", () => {
    expect(isSurfacePathActive("/", "/")).toBe(true)
    expect(isSurfacePathActive("/", "/crons")).toBe(false)
  })
})
