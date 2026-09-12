import { type ComponentProps, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ToggleButton } from '@/components/toggle-button'
import { MultiSelect } from './index'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type MultiSelectProps = ComponentProps<typeof MultiSelect>

type FilterableMultiSelectProps = MultiSelectProps & {
  // Told which letter is active (null = All) so this can become a server-side
  // query once there is an API behind the options — the reason the strip
  // exists at all is a directory too long to scroll.
  onLetterChange?: (letter: string | null) => void
  className?: string
}

function firstLetter(option: { label?: unknown }): string {
  return String(option?.label ?? '')
    .trim()
    .charAt(0)
    .toUpperCase()
}

// An A–Z strip over a `MultiSelect`, for picking people out of a directory
// that is too long to scroll: tap a letter, the list narrows to names that
// start with it.
//
// The strip narrows `options` only. react-select takes `value` separately, so
// a name already chosen stays chosen — and stays visible as a chip — while a
// letter it does not match is active. That separation is the whole reason
// this can be a wrapper rather than a fork of `MultiSelect`.
export function FilterableMultiSelect({
  options,
  onLetterChange,
  className,
  isDisabled,
  ...props
}: FilterableMultiSelectProps) {
  const [letter, setLetter] = useState<string | null>(null)

  const available = useMemo(() => {
    const set = new Set<string>()
    for (const option of options ?? []) set.add(firstLetter(option))
    return set
  }, [options])

  const filtered = useMemo(
    () =>
      letter === null
        ? options
        : (options ?? []).filter((option) => firstLetter(option) === letter),
    [options, letter]
  )

  function pick(next: string | null) {
    setLetter(next)
    onLetterChange?.(next)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <MultiSelect options={filtered} isDisabled={isDisabled} {...props} />

      <div
        className='flex flex-wrap gap-1'
        role='group'
        aria-label='Filter by first letter'
      >
        <ToggleButton
          size='sm'
          selected={letter === null}
          disabled={isDisabled}
          onClick={() => pick(null)}
          className='h-6 px-2 text-xs'
        >
          All
        </ToggleButton>
        {LETTERS.map((candidate) => (
          <ToggleButton
            key={candidate}
            size='sm'
            selected={letter === candidate}
            // A letter nobody's name starts with is dead weight to click, so
            // the strip doubles as a readout of what the directory holds.
            disabled={isDisabled || !available.has(candidate)}
            onClick={() => pick(candidate)}
            className='h-6 w-6 p-0 font-mono text-xs'
          >
            {candidate}
          </ToggleButton>
        ))}
      </div>
    </div>
  )
}
