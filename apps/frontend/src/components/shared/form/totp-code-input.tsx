import { REGEXP_ONLY_DIGITS } from "input-otp"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { TOTP_CODE_LENGTH, totpCodeDigits } from "@/lib/one-time-code"
import { cn } from "@/lib/utils"

interface TotpCodeInputProps {
  /** Id of the underlying input, for a `FormField`'s `htmlFor`. */
  id: string
  value: string
  onChange: (value: string) => void
  /** Called once all six digits are in, e.g. to submit the form. */
  onComplete?: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  "aria-describedby"?: string
  /** Classes for the row of slots, e.g. `justify-center`. */
  className?: string
}

/**
 * The six-digit code of an authenticator app, as two groups of three slots.
 * Accepts digits only; a pasted "123 456" or "12-34-56" keeps its digits.
 */
export function TotpCodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
  "aria-describedby": describedBy,
  className,
}: TotpCodeInputProps) {
  const slotInvalid = invalid ? true : undefined
  const half = TOTP_CODE_LENGTH / 2

  return (
    <InputOTP
      id={id}
      maxLength={TOTP_CODE_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      pasteTransformer={totpCodeDigits}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      disabled={disabled}
      aria-invalid={slotInvalid}
      aria-describedby={describedBy}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      containerClassName={cn("gap-2", className)}
    >
      <InputOTPGroup>
        {Array.from({ length: half }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            aria-invalid={slotInvalid}
            className="size-10 font-mono text-base"
          />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {Array.from({ length: half }, (_, index) => (
          <InputOTPSlot
            key={half + index}
            index={half + index}
            aria-invalid={slotInvalid}
            className="size-10 font-mono text-base"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
