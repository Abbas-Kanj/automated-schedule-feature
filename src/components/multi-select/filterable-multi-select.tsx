import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ToggleButton } from '@/components/toggle-button'
import { MultiSelect, type MultiSelectProps, type SelectOption } from './index'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type FilterableMultiSelectProps<T extends SelectOption> =
  MultiSelectProps<T> & {
    // Reports the active letter (null = All) for a future server-side query.
    onLetterChange?: (letter: string | null) => void
    className?: string
  }

function firstLetter(option: SelectOption): string {
  return option.label.trim().charAt(0).toUpperCase()
}

// An A-Z strip over `MultiSelect` that narrows `options` only — react-select
// takes `value` separately, so an already-picked chip survives a letter that
// excludes it.
export function FilterableMultiSelect<T extends SelectOption>({
  options,
  onLetterChange,
  className,
  isDisabled,
  ...props
}: FilterableMultiSelectProps<T>) {
  const [letter, setLetter] = useState<string | null>(null)

  const available = useMemo(() => {
    const set = new Set<string>()
    for (const option of options) set.add(firstLetter(option))
    return set
  }, [options])

  const filtered = useMemo(
    () =>
      letter === null
        ? options
        : options.filter((option) => firstLetter(option) === letter),
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
