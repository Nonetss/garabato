/** PKCS#12 test files made by `certificates/generate.sh`; password "1234". */
export const P12_PASSWORD = "1234"

export type P12Fixture =
  | "rsa"
  | "rsa-legacy"
  | "ec"
  | "no-tax-id"
  | "encipherment"
  | "no-key"
  | "two-keys"
  | "mismatched"
  | "not-a-p12"

export async function p12Fixture(
  name: P12Fixture
): Promise<Uint8Array<ArrayBuffer>> {
  const file = Bun.file(`${import.meta.dir}/certificates/${name}.p12`)
  return new Uint8Array(await file.arrayBuffer())
}
