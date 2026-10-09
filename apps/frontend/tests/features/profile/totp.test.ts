import { describe, expect, test } from "bun:test"
import { totpSecretOf } from "@/features/profile/overview/model/totp"

describe("totpSecretOf", () => {
  test("reads the secret of an otpauth URI", () => {
    const uri =
      "otpauth://totp/Garabato:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Garabato&digits=6&period=30"

    expect(totpSecretOf(uri)).toBe("JBSWY3DPEHPK3PXP")
  })

  test("returns null when the URI has no secret", () => {
    expect(totpSecretOf("otpauth://totp/Garabato:ada?issuer=Garabato")).toBe(
      null
    )
  })

  test("returns null for a malformed URI", () => {
    expect(totpSecretOf("not a uri")).toBe(null)
  })
})
