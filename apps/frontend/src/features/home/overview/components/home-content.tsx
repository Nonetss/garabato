import { DocumentDropZone } from "@/features/documents"
import { HomeCertificates } from "@/features/home/overview/components/home-certificates"

/**
 * The signing desk: one sheet to drop a PDF on, and beside it the
 * certificates that will sign it.
 */
export function HomeContent() {
  return (
    <div className="@container flex flex-1 flex-col">
      <div className="grid flex-1 gap-10 @3xl:grid-cols-[minmax(0,1fr)_17rem] @3xl:items-start @5xl:grid-cols-[minmax(0,1fr)_19rem] @5xl:gap-14">
        <DocumentDropZone className="@3xl:min-h-[min(36rem,calc(100svh-var(--navbar-height)-6rem))]" />
        <HomeCertificates />
      </div>
    </div>
  )
}
