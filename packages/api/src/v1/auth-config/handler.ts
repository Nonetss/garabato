import { isOidcConfigured } from "@nonete/auth/oauth"
import { env } from "@nonete/env/server"

export const authConfigHandler = {
  get: async () => {
    return {
      ssoEnabled: isOidcConfigured(),
      signUpEnabled: !env.DISABLE_SIGN_UP,
    }
  },
}
