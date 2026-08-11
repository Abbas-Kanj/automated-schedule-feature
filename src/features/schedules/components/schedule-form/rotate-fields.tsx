import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SelectDropdown } from '@/components/select-dropdown'
import {
  CYCLE_LENGTH_QUICK_PICKS,
  CYCLE_LENGTH_UNIT_OPTIONS,
  CYCLE_TYPE_OPTIONS,
  ROTATE_TYPE_OPTIONS,
} from '../../data/data'
import { type RotateBlock } from '../../data/schema'
import { calculateHours, generateId } from '../../utils'
import { PatternBuilder } from './pattern-builder'

function makeBlock(index: number): RotateBlock {
  return {
    id: generateId(),
    label: `Shift ${String.fromCharCode(65 + index)}`,
    time: { from_time: '09:00', to_time: '17:00' },
  }
}

type RotateFieldsProps = {
  disabled?: boolean
}

export function RotateFields({ disabled }: RotateFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues } = useFormContext<any>()
  const shiftBlock = Number(useWatch({ control, name: 'shift_block' })) || 0
  const cycleLength = useWatch({ control, name: 'cycle_length' }) as
    | { unit: string; days: number }
    | undefined

  const { fields: blockFields, replace } = useFieldArray({
    control,
    name: 'blocks',
  })

  useEffect(() => {
    if (!shiftBlock) return
    const current = (getValues('blocks') as RotateBlock[] | undefined) ?? []
    if (current.length === shiftBlock) return
    const next = Array.from(
      { length: shiftBlock },
      (_, i) => current[i] ?? makeBlock(i)
    )
    replace(next)
  }, [shiftBlock])

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={control}
          name='cycle_type'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cycle type</FormLabel>
              <SelectDropdown
                isControlled
                defaultValue={field.value}
                onValueChange={field.onChange}
                placeholder='Select a cycle type'
                items={CYCLE_TYPE_OPTIONS}
                disabled={disabled}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name='rotate_type'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rotate type</FormLabel>
              <SelectDropdown
                isControlled
                defaultValue={field.value}
                onValueChange={field.onChange}
                placeholder='Select a rotate type'
                items={ROTATE_TYPE_OPTIONS}
                disabled={disabled}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-sm font-medium'>Cycle length</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 px-4'>
          <FormField
            control={control}
            name='cycle_length.unit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <SelectDropdown
                  isControlled
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  placeholder='Select a unit'
                  items={CYCLE_LENGTH_UNIT_OPTIONS}
                  disabled={disabled}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name='cycle_length.days'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cycle length (days)</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    disabled={disabled}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                {!disabled && (
                  <div className='flex flex-wrap gap-1.5 pt-1'>
                    {CYCLE_LENGTH_QUICK_PICKS.map((days) => (
                      <Button
                        key={days}
                        type='button'
                        variant='outline'
                        size='sm'
                        className={cn(
                          'h-7',
                          cycleLength?.days === days && 'border-primary'
                        )}
                        onClick={() => field.onChange(days)}
                      >
                        {days}
                      </Button>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <FormField
        control={control}
        name='shift_block'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Shift block</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='shift_length_hours'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Shift length (hours per day)</FormLabel>
            <FormControl>
              <Input
                type='number'
                min={1}
                max={24}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {!shiftBlock ? (
        <p className='text-sm text-muted-foreground'>
          Set the shift block count to configure shifts.
        </p>
      ) : (
        <div className='space-y-3'>
          {blockFields.map((field, index) => (
            <BlockCard key={field.id} index={index} disabled={disabled} />
          ))}
        </div>
      )}

      <PatternBuilder disabled={disabled} />
    </div>
  )
}

function BlockCard({ index, disabled }: { index: number; disabled?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control } = useFormContext<any>()
  const time = useWatch({ control, name: `blocks.${index}.time` }) as
    | { from_time: string; to_time: string }
    | undefined
  const hours = time ? calculateHours([time]) : 0

  return (
    <Card className='gap-3 py-4'>
      <CardContent className='space-y-3 px-4'>
        <FormField
          control={control}
          name={`blocks.${index}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input disabled={disabled} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Time</FormLabel>
          <div className='flex items-start gap-2'>
            <FormField
              control={control}
              name={`blocks.${index}.time.from_time`}
              render={({ field }) => (
                <FormItem className='flex-1'>
                  <FormControl>
                    <Input
                      type='time'
                      disabled={disabled}
                      max={time?.to_time || undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <span className='pt-2 text-sm text-muted-foreground'>to</span>
            <FormField
              control={control}
              name={`blocks.${index}.time.to_time`}
              render={({ field }) => (
                <FormItem className='flex-1'>
                  <FormControl>
                    <Input
                      type='time'
                      disabled={disabled}
                      min={time?.from_time || undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className='text-end text-sm text-muted-foreground'>{hours}h</p>
        </FormItem>
      </CardContent>
    </Card>
  )
}
