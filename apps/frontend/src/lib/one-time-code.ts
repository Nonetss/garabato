/** Digits in a code from an authenticator app (TOTP). */
export const TOTP_CODE_LENGTH = 6

/**
 * The digits of a typed or pasted TOTP code, at most six: authenticator apps
 * show it as "123 456" and copies may carry dashes or spaces.
 */
export function totpCodeDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH)
}
