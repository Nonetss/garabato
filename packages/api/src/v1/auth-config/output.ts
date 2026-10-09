import { z } from "zod"

export const authConfigOutput = {
  get: z.object({
    ssoEnabled: z
      .boolean()
      .describe("Whether SSO (OIDC) sign-in is configured on the server"),
    signUpEnabled: z
      .boolean()
      .describe(
        "Whether visitors can create their own account (false when the server sets DISABLE_SIGN_UP)"
      ),
  }),
}
