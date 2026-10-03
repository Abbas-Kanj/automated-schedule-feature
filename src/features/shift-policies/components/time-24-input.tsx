import { useState } from 'react'
import { Input } from '@/components/ui/input'

type Time24InputProps = {
  value: string | undefined
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

// Digits only, colon inserted after the hour: "930" -> "9:30".
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

// Pads and clamps a finished edit — "9:5" -> "09:05", "99:99" -> "23:59".
// Anything that isn't two numbers is left alone for the schema to reject.
function normalize(raw: string): string {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(raw)
  if (!match) return raw
  const hours = Math.min(23, Number(match[1]))
  const minutes = Math.min(59, Number(match[2]))
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Stands in for `<input type="time">`: a masked text field that guarantees
// 24-hour "HH:mm".
export function Time24Input({
  value,
  onChange,
  onBlur,
  disabled,
  className,
  'aria-label': ariaLabel,
}: Time24InputProps) {
  // Own buffer so a half-typed "9:" isn't reformatted mid-edit.
  const [buffer, setBuffer] = useState(value ?? '')
  // Re-sync when the value changes from outside (reset, rule retype) —
  // during render rather than in an effect, so there's no stale frame.
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setBuffer(value ?? '')
  }

  return (
    <Input
      inputMode='numeric'
      placeholder='HH:mm'
      maxLength={5}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      value={buffer}
      onChange={(e) => {
        const next = mask(e.target.value)
        setBuffer(next)
        onChange(next)
      }}
      onBlur={() => {
        const next = normalize(buffer)
        setBuffer(next)
        onChange(next)
        onBlur?.()
      }}
    />
  )
}
