import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SelectDropdown } from '@/components/select-dropdown'
import { type RotateBlock, type RotatePatternEntry } from '../../data/schema'
import { DirectionPreview } from './direction-preview'

type PatternBuilderProps = {
  disabled?: boolean
}

export function PatternBuilder({ disabled }: PatternBuilderProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues } = useFormContext<any>()
  const cycleLength = useWatch({ control, name: 'cycle_length' }) as
    | { unit: string; days: number }
    | undefined
  const blocks =
    (useWatch({ control, name: 'blocks' }) as RotateBlock[] | undefined) ?? []
  const days = cycleLength?.days ?? 0

  const { fields, replace } = useFieldArray({ control, name: 'pattern' })

  useEffect(() => {
    if (!days) return
    const current =
      (getValues('pattern') as RotatePatternEntry[] | undefined) ?? []
    if (current.length === days) return
    const next = Array.from(
      { length: days },
      (_, i) =>
        current[i] ?? { position: i + 1, is_off: false, block_id: undefined }
    )
    replace(next)
  }, [days])

  const blockOptions = blocks.map((b) => ({ value: b.id, label: b.label }))

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-sm font-medium'>Create pattern</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 px-4'>
        {!days ? (
          <p className='text-sm text-muted-foreground'>
            Set the cycle length to build the pattern.
          </p>
        ) : (
          fields.map((field, index) => (
            <PatternRow
              key={field.id}
              index={index}
              blockOptions={blockOptions}
              disabled={disabled}
            />
          ))
        )}
        <DirectionPreview />
      </CardContent>
    </Card>
  )
}

type PatternRowProps = {
  index: number
  blockOptions: { value: string; label: string }[]
  disabled?: boolean
}

function PatternRow({ index, blockOptions, disabled }: PatternRowProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const isOff = useWatch({ control, name: `pattern.${index}.is_off` })

  return (
    <div className='flex items-center gap-3'>
      <span className='w-14 shrink-0 text-sm text-muted-foreground'>
        Day {index + 1}
      </span>
      <FormField
        control={control}
        name={`pattern.${index}.block_id`}
        render={({ field }) => (
          <FormItem className='flex-1'>
            <SelectDropdown
              isControlled
              defaultValue={field.value}
              onValueChange={field.onChange}
              placeholder='Select shift'
              items={blockOptions}
              disabled={disabled || !!isOff}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`pattern.${index}.is_off`}
        render={({ field }) => (
          <FormItem className='flex items-center gap-2 space-y-0'>
            <FormControl>
              <Checkbox
                checked={!!field.value}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  field.onChange(!!checked)
                  if (checked) setValue(`pattern.${index}.block_id`, undefined)
                }}
              />
            </FormControl>
            <FormLabel className='cursor-pointer text-sm font-normal'>
              OFF by default
            </FormLabel>
          </FormItem>
        )}
      />
    </div>
  )
}
