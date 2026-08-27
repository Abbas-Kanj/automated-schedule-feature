import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getDefaultHolidayAttendance,
  getHolidayAttendanceOptions,
  HOLIDAY_WORK_MODE_OPTIONS,
} from '../data/data'
import {
  type HolidayWorkMode,
  type ShiftPolicyFormValues,
} from '../data/schema'

type HolidayWorkRuleFieldsProps = {
  index: number
}

// The inputs a "Working on day off" / "Working on public holiday" rule takes
// in place of a window: a flat hours count, how that time is treated (the
// three radios), and then the case-specific booking. Rendered by
// `PolicyRuleRow` for those two types only; the rule is already seeded in the
// right shape by `retypeRule`, so this just binds to it.
export function HolidayWorkRuleFields({ index }: HolidayWorkRuleFieldsProps) {
  const form = useFormContext<ShiftPolicyFormValues>()
  const rule = useWatch({ control: form.control, name: `rules.${index}` })
  if (
    !rule ||
    (rule.policy_type !== 'working_on_day_off' &&
      rule.policy_type !== 'working_on_public_holiday')
  ) {
    return null
  }

  const policyType = rule.policy_type
  const workMode: HolidayWorkMode = rule.work_mode ?? 'normal'
  const hoursLabel =
    policyType === 'working_on_public_holiday'
      ? 'Working hours of public holiday'
      : 'Working hours of day off'
  const attendanceOptions = getHolidayAttendanceOptions(policyType, workMode)

  // The day-off overtime case books an hourly rate rather than an attendance
  // type; every other case books an attendance type (normal work offers none
  // yet). Switching mode resets whichever of those two the new case doesn't
  // use, so a stale value can't linger and fail validation.
  const isDayOffOvertime =
    workMode === 'overtime' && policyType === 'working_on_day_off'

  const changeWorkMode = (nextMode: HolidayWorkMode) => {
    const nextIsDayOffOvertime =
      nextMode === 'overtime' && policyType === 'working_on_day_off'
    form.setValue(`rules.${index}.work_mode`, nextMode, {
      shouldDirty: true,
    })
    form.setValue(
      `rules.${index}.holiday_attendance_type`,
      getDefaultHolidayAttendance(policyType, nextMode),
      { shouldDirty: true }
    )
    form.setValue(
      `rules.${index}.rate_per_hour`,
      nextIsDayOffOvertime ? (rule.rate_per_hour ?? 1) : undefined,
      { shouldDirty: true }
    )
  }

  const result =
    (Number(rule.rate_per_hour) || 0) * (Number(rule.work_hours) || 0)

  return (
    <>
      <FormField
        control={form.control}
        name={`rules.${index}.work_hours`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-xs'>{hoursLabel}</FormLabel>
            <div className='flex items-center gap-2'>
              <FormControl>
                <Input
                  type='number'
                  min={0}
                  max={24}
                  step='any'
                  className='h-8 w-28'
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? undefined : e.target.valueAsNumber
                    )
                  }
                />
              </FormControl>
              <span className='text-sm text-muted-foreground'>hours</span>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Normal work / apply overtime / substitute day off — swaps the case
          fields below. Defaults to normal work. */}
      <FormField
        control={form.control}
        name={`rules.${index}.work_mode`}
        render={({ field }) => (
          <FormItem className='space-y-2'>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  if (!value) return
                  changeWorkMode(value as HolidayWorkMode)
                }}
                className='flex flex-wrap gap-4'
              >
                {HOLIDAY_WORK_MODE_OPTIONS.map((option) => (
                  <Label
                    key={option.value}
                    className='flex cursor-pointer items-center gap-1.5 font-normal'
                  >
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </Label>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {isDayOffOvertime ? (
        <div className='flex items-start gap-2'>
          <FormField
            control={form.control}
            name={`rules.${index}.rate_per_hour`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel className='text-xs'>Rate per hour</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step='any'
                    className='h-8'
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === ''
                          ? undefined
                          : e.target.valueAsNumber
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Rate per hour × working hours — read-only, it's derived. */}
          <div className='flex-1 space-y-2'>
            <Label className='text-xs'>Result</Label>
            <Input
              disabled
              readOnly
              className='h-8'
              value={result > 0 ? String(result) : '—'}
            />
          </div>
        </div>
      ) : (
        <FormField
          control={form.control}
          name={`rules.${index}.holiday_attendance_type`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-xs'>Attendance type</FormLabel>
              <Select
                value={field.value ?? ''}
                onValueChange={(value) => {
                  // Same Radix bubble-select guard as the other selects — this
                  // field is written programmatically by `changeWorkMode`.
                  if (!value) return
                  field.onChange(value)
                }}
              >
                <FormControl>
                  <SelectTrigger className='h-8 w-full'>
                    <SelectValue placeholder='Select an attendance type' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {attendanceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  )
}
