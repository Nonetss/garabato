import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto"
import { auth } from "#auth/index"

// The `twoFactor` plugin stores each user's TOTP secret in
// `two_factor.secret`, encrypted with the auth secret. The browser token
// checks codes outside the plugin's endpoints (they need a session cookie),
// so it reads the secret through these.

/** The plain TOTP secret behind a `two_factor.secret` value. */
export async function decryptTwoFactorSecret(encrypted: string) {
  const { secretConfig } = await auth.$context
  return symmetricDecrypt({ key: secretConfig, data: encrypted })
}

/** Encrypts a secret the way the plugin does; tests build rows with it. */
export async function encryptTwoFactorSecret(secret: string) {
  const { secretConfig } = await auth.$context
  return symmetricEncrypt({ key: secretConfig, data: secret })
}
