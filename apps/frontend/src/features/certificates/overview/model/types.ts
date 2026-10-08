export type CertificateStatus = "valid" | "expiring" | "expired"

/** A stored signing certificate: public metadata only, never key material. */
export type Certificate = {
  id: string
  alias: string
  commonName: string
  givenName: string | null
  surname: string | null
  /** NIF/NIE read from the certificate subject. */
  taxId: string | null
  issuerCommonName: string
  serialNumber: string
  fingerprintSha256: string
  keyAlgorithm: "RSA" | "EC"
  notBefore: string
  notAfter: string
  status: CertificateStatus
  passwordRemembered: boolean
  createdAt: string
}

export type CertificateImportInput = {
  file: File
  password: string
  alias?: string
  rememberPassword: boolean
}
