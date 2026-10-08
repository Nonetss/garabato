import { es } from "react-day-picker/locale"
import { Calendar } from "@/components/ui/calendar"

/**
 * The month grid behind `DatePicker`, default-exported so react-day-picker
 * and its locale data stay out of the page chunk until a picker is opened
 * (the trigger warms this on hover/focus, so the fallback rarely shows).
 */
export default function CalendarPanel({
  selected,
  onSelect,
}: {
  selected?: Date
  onSelect: (next: Date | undefined) => void
}) {
  return (
    <Calendar
      mode="single"
      locale={es}
      selected={selected}
      onSelect={onSelect}
      defaultMonth={selected}
    />
  )
}
