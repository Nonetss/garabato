import { isOidcConfigured } from "@nonete/auth/oauth"

export const authConfigHandler = {
  get: async () => {
    return { ssoEnabled: isOidcConfigured() }
  },
}
