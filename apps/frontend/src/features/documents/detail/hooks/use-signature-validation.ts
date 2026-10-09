import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

/**
 * Checks the signatures embedded in one version. Keyed by the version, so a
 * new signature (a new current version) is checked afresh, and an immutable
 * version is never checked twice.
 */
export const useSignatureValidation = (documentId: string, versionId: string) =>
  useHydratedQuery(
    orpc.v1.document.verifySignatures.queryOptions({
      input: { documentId, versionId },
      staleTime: Number.POSITIVE_INFINITY,
    })
  )

/**
 * How many signatures the version's PDF carries, whoever made them; 0 until
 * the check answers (or when it fails), so callers fall back to the
 * signatures made in Garabato.
 */
export function useEmbeddedSignatureCount(
  documentId: string,
  versionId: string
) {
  const { data } = useSignatureValidation(documentId, versionId)
  return data?.signatures.length ?? 0
}
