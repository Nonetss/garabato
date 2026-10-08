import { describe, expect, test } from "bun:test"
import {
  adminSidebarLinks,
  getCurrentSearchHref,
  getSearchableSurfaces,
  getSidebarSection,
  getSiteNavItemByHref,
  getSiteNavItems,
  isNavItemCurrent,
  isNavSubItemCurrent,
} from "@/lib/site-nav"

function requireNavItem(href: string) {
  const item = getSiteNavItemByHref(href)
  if (!item) throw new Error(`missing nav item ${href}`)
  return item
}

describe("current navigation item", () => {
  test("a leaf section stays current on nested pages", () => {
    expect(isNavItemCurrent(requireNavItem("/crons"), "/crons/abc")).toBe(true)
  })

  test("a parent yields to its more specific child", () => {
    const config = requireNavItem("/config")
    expect(isNavItemCurrent(config, "/config/appearance")).toBe(false)
    expect(
      isNavSubItemCurrent("/config/appearance", "/config/appearance", config)
    ).toBe(true)
    expect(isNavItemCurrent(config, "/config")).toBe(true)
  })
})

describe("getSiteNavItems", () => {
  test("filters admin-only sections by role", () => {
    const userHrefs = getSiteNavItems(false).map((item) => item.href)
    const adminHrefs = getSiteNavItems(true).map((item) => item.href)
    expect(userHrefs).not.toContain("/admin")
    expect(adminHrefs).toContain("/admin")
  })
})

describe("getSidebarSection", () => {
  test("returns the section hub with sub-items for a nested route", () => {
    expect(getSidebarSection("/config/profile")).toBe("/config")
  })

  test("is undefined outside a section with sub-items", () => {
    expect(getSidebarSection("/crons")).toBeUndefined()
  })
})

describe("surface search", () => {
  test("lists no dynamic routes, hidden or admin-only surfaces for users", () => {
    const hrefs = getSearchableSurfaces(false).flatMap((group) =>
      group.items.map((item) => item.href)
    )
    expect(hrefs).toContain("/crons")
    expect(hrefs.some((href) => href.includes("["))).toBe(false)
    expect(hrefs).not.toContain("/login")
    expect(hrefs.some((href) => href.startsWith("/admin"))).toBe(false)
  })

  test("groups a section's children under it with their trail", () => {
    const groups = getSearchableSurfaces(true)
    const config = groups.find((group) => group.label === "Configuración")
    const appearance = config?.items.find(
      (item) => item.href === "/config/appearance"
    )
    expect(appearance?.trail).toEqual(["Configuración"])
    expect(groups[0]?.label).toBe("General")
  })

  test("marks the most specific href as current", () => {
    const groups = getSearchableSurfaces(true)
    expect(getCurrentSearchHref("/config/appearance", groups)).toBe(
      "/config/appearance"
    )
  })
})

describe("adminSidebarLinks", () => {
  test("starts with the section overview followed by its children", () => {
    expect(adminSidebarLinks[0]?.href).toBe("/admin")
    expect(adminSidebarLinks.length).toBeGreaterThan(1)
  })
})
