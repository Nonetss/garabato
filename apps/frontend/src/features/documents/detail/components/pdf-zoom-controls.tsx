import { Text } from "@/components/shared/brand/typography"
import { Hint } from "@/components/shared/feedback/hint"
import { IconButton } from "@/components/shared/form/icon-button"
import { Button } from "@/components/ui/button"
import {
  FIT_ZOOM,
  zoomIn,
  zoomOut,
  zoomPercent,
} from "@/features/documents/detail/model/zoom"
import { getIcon } from "@/lib/icon-registry"

const ZoomOutIcon = getIcon("controls", "zoomOut")
const ZoomInIcon = getIcon("controls", "zoomIn")

interface PdfZoomControlsProps {
  zoom: number
  onZoom: (zoom: number) => void
}

/**
 * Zoom out / in controls in the viewer's bottom bar, around the current
 * percentage, which fits the pages back to the pane's width.
 */
export function PdfZoomControls({ zoom, onZoom }: PdfZoomControlsProps) {
  const percent = zoomPercent(zoom)
  return (
    <fieldset aria-label="Zoom" className="flex items-center gap-0.5">
      <IconButton
        className="rounded-full"
        label="Alejar"
        icon={ZoomOutIcon}
        disabled={zoomOut(zoom) === zoom}
        onClick={() => onZoom(zoomOut(zoom))}
      />
      <Hint label="Ajustar al ancho">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-w-14 rounded-full px-1"
          aria-label={`Zoom al ${percent}, ajustar al ancho`}
          onClick={() => onZoom(FIT_ZOOM)}
        >
          <Text
            as="span"
            variant="compact"
            tone="muted"
            className="tabular-nums"
            aria-live="polite"
          >
            {percent}
          </Text>
        </Button>
      </Hint>
      <IconButton
        className="rounded-full"
        label="Acercar"
        icon={ZoomInIcon}
        disabled={zoomIn(zoom) === zoom}
        onClick={() => onZoom(zoomIn(zoom))}
      />
    </fieldset>
  )
}
