import type { Certificate } from "@nonete/db/schema"
import { errors } from "#errors"
import { Pkcs12Error, type Pkcs12FailureKind } from "#shared/pkcs12"
import { VaultError, type VaultScope, vault } from "#shared/vault"

/**
 * Opening what a stored certificate keeps sealed (its PKCS#12 file and its
 * remembered password), shared by the certificate and document features.
 */

const PKCS12_MESSAGES = {
  "wrong-password": "La contraseña del certificado no es correcta",
  "invalid-file":
    "El archivo no es un certificado PKCS#12 (.p12 o .pfx) válido",
  "no-key": "El archivo no contiene la clave privada del certificado",
  "several-keys":
    "El archivo contiene más de una clave privada; exporta solo el certificado que quieras usar",
  "no-matching-certificate":
    "La clave privada del archivo no corresponde a ningún certificado incluido",
  "unsupported-key":
    "El tipo de clave del certificado no está soportado (solo RSA y EC)",
  "not-for-signing": "Este certificado no permite firmar documentos",
} satisfies Record<Pkcs12FailureKind, string>

export function certificateScope(id: string): VaultScope {
  return { kind: "certificate", id }
}

/** Rethrows a `Pkcs12Error` as a Spanish `BAD_REQUEST`; anything else as is. */
export function rejectPkcs12(error: unknown): never {
  if (error instanceof Pkcs12Error) {
    throw errors.BAD_REQUEST({ message: PKCS12_MESSAGES[error.kind] })
  }
  throw error
}

function undecryptable(): never {
  throw errors.INTERNAL_SERVER_ERROR({
    message: "Stored certificate could not be decrypted",
  })
}

/**
 * Unwraps the row's data key and opens its PKCS#12 file. A row that is not
 * deleted always holds both; failing to open them is a server fault.
 */
export async function openCertificateFile(row: Certificate) {
  if (!row.encryptedDataKey || !row.encryptedP12) {
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Active certificate has no sealed file",
    })
  }
  try {
    const scope = certificateScope(row.id)
    const dataKey = await vault.unwrapDataKey(scope, row.encryptedDataKey)
    const p12 = await vault.open(dataKey, scope, "p12", row.encryptedP12)
    return { dataKey, p12 }
  } catch (error) {
    if (error instanceof VaultError) undecryptable()
    throw error
  }
}

/** The remembered password, or `null` when the user did not keep it. */
export async function openRememberedPassword(
  row: Certificate,
  dataKey: Uint8Array<ArrayBuffer>
): Promise<string | null> {
  if (!row.encryptedPassword) return null
  try {
    const password = await vault.open(
      dataKey,
      certificateScope(row.id),
      "password",
      row.encryptedPassword
    )
    return new TextDecoder().decode(password)
  } catch (error) {
    if (error instanceof VaultError) undecryptable()
    throw error
  }
}
