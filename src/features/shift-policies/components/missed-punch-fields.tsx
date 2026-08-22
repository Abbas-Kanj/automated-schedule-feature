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
  ATTENDANCE_TYPE_OPTIONS,
  COMPARISON_OPERATOR_OPTIONS,
  getMissedPunchPeriodUnitLabel,
  MISSED_PUNCH_DEDUCTION_UNIT_OPTIONS,
  MISSED_PUNCH_PERIOD_UNIT_OPTIONS,
} from '../data/data'
import {
  type MissedPunchDeductionUnit,
  type MissedPunchPeriodUnit,
  type ShiftPolicyFormValues,
} from '../data/schema'

type MissedPunchRuleFieldsProps = {
  index: number
}

// The inputs a "Missed punch error" rule takes in place of the window and
// factor every other type uses — how many missed punches over what span,
// and what that costs. Rendered by `PolicyRuleRow` for that type only; the
// rule is already seeded in the right shape by `retypeRule`, so this just
// binds to it.
export function MissedPunchRuleFields({ index }: MissedPunchRuleFieldsProps) {
  const form = useFormContext<ShiftPolicyFormValues>()
  const rule = useWatch({ control: form.control, name: `rules.${index}` })
  if (!rule || rule.policy_type !== 'missed_punch_error') return null

  const periodUnit: MissedPunchPeriodUnit = rule.period_unit ?? 'days'
  const deductionUnit: MissedPunchDeductionUnit = rule.deduction_unit ?? 'hours'
  const periodLabel = getMissedPunchPeriodUnitLabel(periodUnit)

  return (
    <>
      <div className='space-y-2'>
        <Label className='text-xs'>Missed Punch</Label>
        <div className='flex items-start gap-2'>
          <FormField
            control={form.control}
            name={`rules.${index}.operator`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    // Radix's hidden form-participation <select> bounces an
                    // empty value back when it syncs the value this field is
                    // seeded with programmatically. See the
                    // `radix-select-bubble-select-wipes-programmatic-value`
                    // skill.
                    if (!value) return
                    field.onChange(value)
                  }}
                >
                  <FormControl>
                    <SelectTrigger className='h-8 w-full'>
                      <SelectValue placeholder='Select a comparison' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {COMPARISON_OPERATOR_OPTIONS.map((option) => (
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
          <FormField
            control={form.control}
            name={`rules.${index}.occurrences`}
            render={({ field }) => (
              <FormItem className='w-24'>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    step={1}
                    className='h-8'
                    aria-label='Occurrences'
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
          <span className='pt-1.5 text-sm text-muted-foreground'>
            occurrences
          </span>
        </div>
      </div>

      {/* The unit picked here renames the two inputs under it — the window
          is the same field either way, counted in days or in months. */}
      <div className='space-y-2'>
        <FormField
          control={form.control}
          name={`rules.${index}.period_unit`}
          render={({ field }) => (
            <FormItem className='space-y-2'>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => {
                    if (!value) return
                    field.onChange(value)
                  }}
                  className='flex gap-4'
                >
                  {MISSED_PUNCH_PERIOD_UNIT_OPTIONS.map((option) => (
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

        <div className='flex items-start gap-2'>
          <FormField
            control={form.control}
            name={`rules.${index}.from_period`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel className='text-xs'>From {periodLabel}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    step={1}
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
          <FormField
            control={form.control}
            name={`rules.${index}.to_period`}
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormLabel className='text-xs'>To {periodLabel}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    step={1}
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
        </div>
      </div>

      {/* A missed punch is always booked as a deduction — shown, not
          chosen, so the rule reads the same as a window rule. */}
      <div className='space-y-2'>
        <Label className='text-xs'>Attendance type</Label>
        <Select value={rule.attendance_type} disabled>
          <SelectTrigger className='h-8 w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-2'>
        <Label className='text-xs'>Deduct</Label>
        <FormField
          control={form.control}
          name={`rules.${index}.deduction_unit`}
          render={({ field }) => (
            <FormItem className='space-y-2'>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => {
                    if (!value) return
                    field.onChange(value)
                  }}
                  className='gap-2'
                >
                  {MISSED_PUNCH_DEDUCTION_UNIT_OPTIONS.map((option) => (
                    <div key={option.value} className='flex items-center gap-2'>
                      <Label className='flex cursor-pointer items-center gap-1.5 font-normal'>
                        <RadioGroupItem value={option.value} />
                        {option.label}
                      </Label>
                      {/* Only "Hours" takes a number — a half/full day is
                          however long the shift says it is. Kept outside the
                          Label so clicking into it doesn't read as a click
                          on the radio. */}
                      {option.value === 'hours' && (
                        <FormField
                          control={form.control}
                          name={`rules.${index}.deduction_hours`}
                          render={({ field: hoursField }) => (
                            <FormItem className='w-24'>
                              <FormControl>
                                <Input
                                  type='number'
                                  min={0}
                                  max={24}
                                  step='any'
                                  className='h-8'
                                  aria-label='Hours to deduct'
                                  disabled={deductionUnit !== 'hours'}
                                  value={hoursField.value ?? ''}
                                  onChange={(e) =>
                                    hoursField.onChange(
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
                      )}
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  )
}
