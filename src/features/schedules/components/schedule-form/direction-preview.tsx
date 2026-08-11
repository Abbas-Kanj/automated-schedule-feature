import { useFormContext, useWatch } from 'react-hook-form'
import { type RotateBlock, type RotatePatternEntry } from '../../data/schema'

export function DirectionPreview() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const pattern =
    (useWatch({ control, name: 'pattern' }) as
      | RotatePatternEntry[]
      | undefined) ?? []
  const blocks =
    (useWatch({ control, name: 'blocks' }) as RotateBlock[] | undefined) ?? []

  const sorted = [...pattern].sort((a, b) => a.position - b.position)
  const runs: { label: string; count: number }[] = []
  for (const entry of sorted) {
    const label = entry.is_off
      ? 'Day off'
      : (blocks.find((b) => b.id === entry.block_id)?.label ?? 'Unassigned')
    const last = runs[runs.length - 1]
    if (last && last.label === label) {
      last.count += 1
    } else {
      runs.push({ label, count: 1 })
    }
  }

  if (runs.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Direction preview will appear once the pattern is set.
      </p>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2 border-t pt-3 text-sm'>
      <span className='text-muted-foreground'>Direction:</span>
      {runs.map((run, i) => (
        <span key={i} className='flex items-center gap-2'>
          <span className='rounded-md bg-muted px-2 py-1'>
            {run.count} × {run.label}
          </span>
          {i < runs.length - 1 && (
            <span className='text-muted-foreground'>→</span>
          )}
        </span>
      ))}
    </div>
  )
}
