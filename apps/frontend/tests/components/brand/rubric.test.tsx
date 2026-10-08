import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Rubric } from "@/components/shared/brand/rubric"

afterEach(cleanup)

function paths(container: HTMLElement) {
  return Array.from(container.querySelectorAll("path"))
}

describe("Rubric", () => {
  test("is decorative and static by default", () => {
    const { container } = render(<Rubric />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
    expect(svg?.getAttribute("role")).toBeNull()
    expect(svg?.dataset.motion).toBe("static")
    for (const path of paths(container)) {
      expect(path.getAttribute("class")).not.toContain("rubric-")
    }
  })

  test("is announced as an image when labelled", () => {
    render(<Rubric label="Garabato" />)
    expect(screen.getByRole("img", { name: "Garabato" })).toBeDefined()
  })

  test("write draws the stroke, then rules the baseline after it", () => {
    const { container } = render(<Rubric motion="write" />)
    const [signature, baseline] = paths(container)
    expect(signature?.getAttribute("class")).toContain("rubric-write")
    expect(baseline?.getAttribute("class")).toContain("rubric-write")
    expect(baseline?.getAttribute("class")).toContain("--rubric-delay")
  })

  test("loop rewrites only the stroke and keeps the baseline still", () => {
    const { container } = render(<Rubric motion="loop" />)
    const [signature, baseline] = paths(container)
    expect(signature?.getAttribute("class")).toContain("rubric-loop")
    expect(baseline?.getAttribute("class")).not.toContain("rubric-")
  })
})
