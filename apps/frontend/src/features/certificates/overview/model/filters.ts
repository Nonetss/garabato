import type { Certificate } from "@/features/certificates/overview/model/types"
import { foldText } from "@/lib/fold-text"

// The fields a person recognises a certificate by: its name, the holder,
// the NIF/NIE and who issued it.
function searchableText(certificate: Certificate) {
  return [
    certificate.alias,
    certificate.commonName,
    certificate.givenName,
    certificate.surname,
    certificate.taxId,
    certificate.issuerCommonName,
  ]
    .filter((field) => field !== null)
    .join(" ")
}

/** The certificates whose name, holder, NIF/NIE or issuer contain `query`,
 *  ignoring case and accents. A blank query keeps them all. */
export function filterCertificates(
  certificates: Certificate[],
  query: string
): Certificate[] {
  const folded = foldText(query.trim())
  if (folded === "") return certificates
  return certificates.filter((certificate) =>
    foldText(searchableText(certificate)).includes(folded)
  )
}
