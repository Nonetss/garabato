import { type SyntheticEvent, useState } from "react"
import { Text } from "@/components/shared/brand/typography"
import { FormField } from "@/components/shared/form/field-label"
import {
  SegmentedPicker,
  type SegmentedPickerOption,
} from "@/components/shared/form/segmented-picker"
import { AppLink } from "@/components/ui/app-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StampPlacement } from "@/features/documents/detail/components/pdf-viewer"
import {
  type DocumentDetail,
  type SignAppearance,
  useDocumentSign,
} from "@/features/documents/shared"
import { useHydratedQuery } from "@/hooks/use-hydrated-query"
import { orpc } from "@/lib/orpc"

type Visibility = "visible" | "invisible"
type PagesMode = "one" | "all"

const visibilityOptions: readonly SegmentedPickerOption<Visibility>[] = [
  { value: "visible", label: "Visible" },
  { value: "invisible", label: "Invisible" },
]

const pagesOptions: readonly SegmentedPickerOption<PagesMode>[] = [
  { value: "one", label: "Esta página" },
  { value: "all", label: "Todas" },
]

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Ha ocurrido un error inesperado"
}

function optionalText(value: string) {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  return trimmed
}

function appearanceOf(
  visibility: Visibility,
  pages: PagesMode,
  stamp: StampPlacement | null
): SignAppearance | null {
  if (visibility === "invisible") return { visible: false }
  if (!stamp) return null
  return { visible: true, page: stamp.page, pages, rect: stamp.rect }
}

function placementHint(stamp: StampPlacement | null) {
  if (!stamp) {
    return "Arrastra sobre la página para dibujar dónde va la firma."
  }
  return `Firma en la página ${stamp.page + 1}. Arrastra otra vez para moverla.`
}

interface SignPanelProps {
  document: DocumentDetail
  stamp: StampPlacement | null
  onVisibilityChange: (visible: boolean) => void
  onPagesChange: (pages: PagesMode) => void
  onSigned: () => void
  onCancel: () => void
}

export function SignPanel({
  document,
  stamp,
  onVisibilityChange,
  onPagesChange,
  onSigned,
  onCancel,
}: SignPanelProps) {
  const sign = useDocumentSign(document.id)
  const { data: certificates = [], isPending: certificatesPending } =
    useHydratedQuery(orpc.v1.certificate.list.queryOptions())
  const usable = certificates.filter(
    (certificate) => certificate.status !== "expired"
  )

  const [certificateId, setCertificateId] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<Visibility>("visible")
  const [pages, setPages] = useState<PagesMode>("one")
  const [password, setPassword] = useState("")
  const [reason, setReason] = useState("")
  const [location, setLocation] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)

  const selected = usable.find(
    (certificate) => certificate.id === certificateId
  )
  const needsPassword = selected !== undefined && !selected.passwordRemembered
  const appearance = appearanceOf(visibility, pages, stamp)
  const current = document.versions.at(-1)
  const canSubmit =
    selected !== undefined &&
    appearance !== null &&
    current !== undefined &&
    (!needsPassword || password !== "")

  const handleVisibility = (value: Visibility) => {
    setVisibility(value)
    onVisibilityChange(value === "visible")
  }

  const handlePages = (value: PagesMode) => {
    setPages(value)
    onPagesChange(value)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected || !appearance || !current) return
    setSubmitError(null)
    // Sent exactly as typed: spaces can be part of a password.
    const typedPassword = needsPassword ? password : undefined
    try {
      await sign.mutateAsync({
        documentId: document.id,
        baseVersionId: current.id,
        certificateId: selected.id,
        password: typedPassword,
        reason: optionalText(reason),
        location: optionalText(location),
        appearance,
      })
    } catch (error) {
      setSubmitError(errorMessage(error))
      return
    }
    setPassword("")
    onSigned()
  }

  if (!certificatesPending && usable.length === 0) {
    return (
      <div className="space-y-3">
        <Text as="p" variant="body">
          Necesitas un certificado vigente para firmar.
        </Text>
        <Button render={<AppLink href="/certificates" />} variant="outline">
          Ir a Certificados
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Certificado" htmlFor="sign-certificate">
        <Select
          items={usable.map((certificate) => ({
            value: certificate.id,
            label: certificate.alias,
          }))}
          value={certificateId}
          onValueChange={(value) => {
            setCertificateId(value)
            setSubmitError(null)
          }}
        >
          <SelectTrigger id="sign-certificate" className="w-full">
            <SelectValue placeholder="Elige un certificado" />
          </SelectTrigger>
          <SelectContent>
            {usable.map((certificate) => (
              <SelectItem key={certificate.id} value={certificate.id}>
                {certificate.alias}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <SegmentedPicker
        label="Firma"
        options={visibilityOptions}
        value={visibility}
        onChange={handleVisibility}
        columns={2}
      />

      {visibility === "visible" ? (
        <>
          <SegmentedPicker
            label="Páginas"
            options={pagesOptions}
            value={pages}
            onChange={handlePages}
            columns={2}
          />
          <Text as="p" variant="meta" tone="muted">
            {placementHint(stamp)}
          </Text>
        </>
      ) : null}

      {needsPassword ? (
        <FormField label="Contraseña del certificado" htmlFor="sign-password">
          <Input
            id="sign-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
      ) : null}

      <FormField label="Motivo (opcional)" htmlFor="sign-reason">
        <Input
          id="sign-reason"
          maxLength={200}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <FormField label="Lugar (opcional)" htmlFor="sign-location">
        <Input
          id="sign-location"
          maxLength={200}
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </FormField>

      {submitError ? (
        <Text as="p" variant="compact" tone="destructive" role="alert">
          {submitError}
        </Text>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={sign.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={!canSubmit || sign.isPending}>
          Firmar
        </Button>
      </div>
    </form>
  )
}
