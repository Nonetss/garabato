/**
 * Builds the two malformed PKCS#12 fixtures OpenSSL refuses to produce:
 * one holding two private keys and one whose key matches no certificate.
 * Run by generate.sh with the work directory holding its PEM files.
 */
import forge from "node-forge"

const [workDir, outDir] = process.argv.slice(2)
if (!workDir || !outDir) throw new Error("usage: build-invalid <work> <out>")

const { asn1, pki, pkcs12 } = forge
const PASSWORD = "1234"
const DATA_OID = "1.2.840.113549.1.7.1"

async function pem(name: string) {
  return Bun.file(`${workDir}/${name}`).text()
}

function children(node: forge.asn1.Asn1) {
  if (typeof node.value === "string") throw new Error("Expected a structure")
  return node.value
}

function child(node: forge.asn1.Asn1, index: number) {
  const found = children(node)[index]
  if (!found) throw new Error(`Missing ASN.1 child ${index}`)
  return found
}

// PFX ::= SEQ { version, authSafe ContentInfo { data, [0] { OCTET STRING } } }
function safeContents(pfx: forge.asn1.Asn1) {
  const octets = child(child(child(pfx, 1), 1), 0)
  if (typeof octets.value !== "string") throw new Error("Expected octets")
  return children(asn1.fromDer(octets.value))
}

function pfxOf(safes: forge.asn1.Asn1[]) {
  const { Class, Type } = asn1
  const authSafe = asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, safes)
  return asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
    asn1.create(
      Class.UNIVERSAL,
      Type.INTEGER,
      false,
      asn1.integerToDer(3).getBytes()
    ),
    asn1.create(Class.UNIVERSAL, Type.SEQUENCE, true, [
      asn1.create(
        Class.UNIVERSAL,
        Type.OID,
        false,
        asn1.oidToDer(DATA_OID).getBytes()
      ),
      asn1.create(Class.CONTEXT_SPECIFIC, 0, true, [
        asn1.create(
          Class.UNIVERSAL,
          Type.OCTETSTRING,
          false,
          asn1.toDer(authSafe).getBytes()
        ),
      ]),
    ]),
  ])
}

async function write(name: string, pfx: forge.asn1.Asn1) {
  const bytes = asn1.toDer(pfx).getBytes()
  await Bun.write(`${outDir}/${name}`, forge.util.binary.raw.decode(bytes))
}

const rsaKey = pki.privateKeyFromPem(await pem("rsa.key"))
const rsaCert = pki.certificateFromPem(await pem("rsa.crt"))
const otherKey = pki.privateKeyFromPem(await pem("other.key"))
const otherCert = pki.certificateFromPem(await pem("other.crt"))

// No MAC, so the two halves can be spliced without recomputing one.
const withRsaKey = pkcs12.toPkcs12Asn1(rsaKey, [rsaCert], PASSWORD, {
  useMac: false,
})
const withOtherKey = pkcs12.toPkcs12Asn1(otherKey, [otherCert], PASSWORD, {
  useMac: false,
})
await write(
  "two-keys.p12",
  pfxOf([...safeContents(withRsaKey), ...safeContents(withOtherKey)])
)

await write(
  "mismatched.p12",
  pkcs12.toPkcs12Asn1(otherKey, [rsaCert], PASSWORD)
)
