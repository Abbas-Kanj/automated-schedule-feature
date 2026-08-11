import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { type RegularShift } from '../../data/schema'
import { deriveShortCode, generateId } from '../../utils'
import { AssignDaysGrid } from './assign-days-grid'
import { BadgeColorField } from './badge-color-field'
import { IconPickerField } from './icon-picker-field'

function makeShift(): RegularShift {
  return {
    id: generateId(),
    name: '',
    short_code: '',
    badge_color: 'blue',
    icon: 'clock',
    shift_length_hours: 8,
    days: [],
  }
}

type ShiftDefinitionFieldsProps = {
  disabled?: boolean
}

export function ShiftDefinitionFields({
  disabled,
}: ShiftDefinitionFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues } = useFormContext<any>()
  const nbOfShifts = Number(useWatch({ control, name: 'nb_of_shifts' })) || 0
  const temporarySchedule = useWatch({ control, name: 'temporary_schedule' })

  const { fields: shiftFields, replace } = useFieldArray({
    control,
    name: 'shifts',
  })

  useEffect(() => {
    if (!nbOfShifts) return
    const current = (getValues('shifts') as RegularShift[] | undefined) ?? []
    if (current.length === nbOfShifts) return
    const next = Array.from(
      { length: nbOfShifts },
      (_, i) => current[i] ?? makeShift()
    )
    replace(next)
  }, [nbOfShifts])

  return (
    <div className='space-y-4'>
      {!nbOfShifts ? (
        <p className='text-sm text-muted-foreground'>
          Set the number of shifts in the previous step to continue.
        </p>
      ) : (
        shiftFields.map((field, index) => (
          <ShiftCard key={field.id} index={index} disabled={disabled} />
        ))
      )}

      <FormField
        control={control}
        name='temporary_schedule'
        render={({ field }) => (
          <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Temporary schedule</FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                disabled={disabled}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {temporarySchedule && (
        <FormField
          control={control}
          name='temporary_schedule_label'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temporary schedule label</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g. Ramadan'
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}

function ShiftCard({ index, disabled }: { index: number; disabled?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const name = useWatch({ control, name: `shifts.${index}.name` }) as
    | string
    | undefined

  useEffect(() => {
    setValue(`shifts.${index}.short_code`, deriveShortCode(name ?? ''))
  }, [name])

  return (
    <Card className='gap-3 py-4'>
      <CardHeader className='px-4'>
        <CardTitle className='text-sm font-medium'>Shift {index + 1}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 px-4'>
        <FormField
          control={control}
          name={`shifts.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift name</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g. Morning shift'
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`shifts.${index}.short_code`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short code</FormLabel>
              <FormControl>
                <Input
                  disabled
                  readOnly
                  placeholder='Auto filled from the first letters of the name'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='grid gap-3 sm:grid-cols-2'>
          <FormField
            control={control}
            name={`shifts.${index}.badge_color`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Badge color</FormLabel>
                <FormControl>
                  <BadgeColorField
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`shifts.${index}.icon`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <FormControl>
                  <IconPickerField
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name={`shifts.${index}.shift_length_hours`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift length (hours)</FormLabel>
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

        <FormItem>
          <FormLabel>Assign days</FormLabel>
          <AssignDaysGrid shiftIndex={index} disabled={disabled} />
        </FormItem>

        <FormField
          control={control}
          name={`shifts.${index}.overnight`}
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
              <FormLabel className='cursor-pointer'>
                Check next day
              </FormLabel>
              <FormControl>
                <Switch
                  checked={!!field.value}
                  disabled={disabled}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}
