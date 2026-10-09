import { DocumentDropZone } from "@/features/documents"
import { HomeCertificates } from "@/features/home/overview/components/home-certificates"

/**
 * The signing desk: one sheet to drop a PDF on, and beside it the
 * certificates that will sign it. From `@3xl` the sheet stretches to the
 * full height below the navbar; below it the certificates follow the sheet.
 */
export function HomeContent() {
  return (
    <div className="@container flex flex-1 flex-col">
      <div className="grid flex-1 content-start gap-8 @3xl:gap-10 @3xl:grid-cols-[minmax(0,1fr)_17rem] @3xl:content-stretch @5xl:grid-cols-[minmax(0,1fr)_19rem] @5xl:gap-12">
        <DocumentDropZone />
        <HomeCertificates />
      </div>
    </div>
  )
}
