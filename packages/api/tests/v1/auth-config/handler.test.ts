import { afterEach, describe, expect, test } from "bun:test"
import { env } from "@nonete/env/server"

import { authConfigHandler } from "#v1/auth-config/handler"

// The preload leaves DISABLE_SIGN_UP unset, so it defaults to false. `env`
// is read-only in its type; `Object.assign` flips it for one test.
const initialDisableSignUp = env.DISABLE_SIGN_UP

afterEach(() => {
  Object.assign(env, { DISABLE_SIGN_UP: initialDisableSignUp })
})

describe("authConfigHandler.get", () => {
  test("reports sign-up as open by default", async () => {
    const config = await authConfigHandler.get()

    expect(config.signUpEnabled).toBe(true)
  })

  test("reports sign-up as closed when DISABLE_SIGN_UP is set", async () => {
    Object.assign(env, { DISABLE_SIGN_UP: true })

    const config = await authConfigHandler.get()

    expect(config.signUpEnabled).toBe(false)
  })

  test("reports SSO as off without the OIDC variables", async () => {
    const config = await authConfigHandler.get()

    expect(config.ssoEnabled).toBe(false)
  })
})
