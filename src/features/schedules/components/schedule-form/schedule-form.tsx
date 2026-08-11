import { useState } from 'react'
import { type Control, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type StepperStep, Stepper } from '@/components/ui/stepper'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MultiSelect } from '@/components/multi-select'
import { POLICY_TYPE_OPTIONS, SCHEDULE_TYPES } from '../../data/data'
import {
  type Schedule,
  type ScheduleType,
  scheduleSchema,
} from '../../data/schema'
import { generateId } from '../../utils'
import { MonthlyFields } from './monthly-fields'
import { RegularShiftFields } from './regular-shift-fields'
import { ScheduleSummary } from './schedule-summary'
import { WeeklyFields } from './weekly-fields'
import { WeeklyOneFields } from './weekly-one-fields'

function getSteps(parentType: string): StepperStep[] {
  const steps: StepperStep[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'type', label: 'Type' },
  ]
  if (parentType === 'regular') {
    steps.push({ id: 'policy', label: 'Policy' })
  }
  steps.push({ id: 'summary', label: 'Summary' })
  return steps
}

const now = new Date()

function getTypeDefaults(type: ScheduleType) {
  switch (type) {
    case 'weekly':
      return {
        parent_type: 'daily' as const,
        type: 'weekly' as const,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        week: { start_date: '', end_date: '' },
        days: [],
      }
    case 'weekly_one':
      return {
        parent_type: 'daily' as const,
        type: 'weekly_one' as const,
        days: [],
      }
    case 'monthly':
      return {
        parent_type: 'daily' as const,
        type: 'monthly' as const,
        year: now.getFullYear(),
        months: [],
      }
  }
}

function getRegularDefaults() {
  return {
    parent_type: 'regular' as const,
    shift_number: 1,
    split_number: 1,
    single_shift: {
      days: [],
      time: { from_time: '09:00', to_time: '17:00' },
      has_break: false,
    },
    shifts: undefined,
    leave_hours: 8,
    official_holiday_hours: 8,
  }
}

const PARENT_TYPES = [
  {
    value: 'daily',
    label: 'Daily',
  },
  {
    value: 'regular',
    label: 'Regular',
  },
]

type ScheduleFormProps = {
  defaultValues?: Schedule
  onSubmit: (values: Schedule) => void
  disabled?: boolean
  submitLabel?: string
}

function getStepFields(
  stepId: string,
  parentType: string,
  type?: string,
  shiftNumber?: number,
  splitNumber?: number
): any {
  if (stepId === 'basics') {
    return parentType === 'regular'
      ? ['name', 'description', 'parent_type', 'shift_number', 'split_number']
      : ['name', 'description', 'parent_type']
  }
  if (stepId === 'type') {
    if (parentType === 'regular') {
      if (shiftNumber === 1 && splitNumber === 1) return ['single_shift']
      const fields = ['shifts']
      if ((shiftNumber ?? 0) > 1) {
        fields.push('shift_cycle', 'shift_rotation', 'repeated_shift')
      }
      return fields
    }
    if (type === 'weekly') return ['type', 'year', 'month', 'week', 'days']
    if (type === 'weekly_one') return ['type', 'days']
    if (type === 'monthly') return ['type', 'year', 'months']
    return ['type']
  }
  if (stepId === 'policy') {
    return ['policy_type']
  }
  return []
}

export function ScheduleForm({
  defaultValues,
  onSubmit,
  disabled = false,
  submitLabel = 'Save schedule',
}: ScheduleFormProps) {
  const form = useForm<Schedule>({
    resolver: zodResolver(scheduleSchema),
    mode: 'onChange',
    defaultValues:
      defaultValues ??
      ({
        id: generateId(),
        name: '',
        description: '',
      } as Schedule),
  })

  const [step, setStep] = useState(0)

  const type = form.watch('type')
  const parentType = form.watch('parent_type')
  const looseControl = form.control as unknown as Control<any>
  const shiftNumber = useWatch({ control: looseControl, name: 'shift_number' })
  const splitNumber = useWatch({ control: looseControl, name: 'split_number' })

  const steps = getSteps(parentType)
  const currentStepId = steps[step]?.id
  const isLastStep = step === steps.length - 1

  const handleNext = async () => {
    const valid = await form.trigger(
      getStepFields(currentStepId, parentType, type, shiftNumber, splitNumber)
    )
    if (valid) setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))

  const handleParentTypeChange = (value: string) => {
    if (value === parentType) return
    const current = form.getValues()

    form.reset({
      id: current.id,
      name: current.name,
      description: current.description,
      ...(value === 'daily' ? getTypeDefaults('weekly') : getRegularDefaults()),
    } as Schedule)
  }

  const handleTypeChange = (value: string) => {
    if (value === type) return
    const current = form.getValues()
    form.reset({
      id: current.id,
      name: current.name,
      description: current.description,
      ...getTypeDefaults(value as ScheduleType),
    } as Schedule)
  }

  return (
    <Form {...form}>
      <form
        id={'schedule-form'}
        onSubmit={(e) => {
          if (!disabled && !isLastStep) {
            e.preventDefault()
            return
          }
          return form.handleSubmit(onSubmit)(e)
        }}
        className='space-y-6'
      >
        {!disabled && <Stepper steps={steps} currentStep={step} />}

        {(disabled || currentStepId === 'basics') && (
          <>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g. Front Desk Coverage'
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Optional description'
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='parent_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={PARENT_TYPES}
                      value={
                        PARENT_TYPES.find((t) => t.value === field.value) ??
                        null
                      }
                      onChange={(opt: { value: string } | null) =>
                        handleParentTypeChange(opt?.value ?? '')
                      }
                      isDisabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {parentType === 'regular' && (
              <>
                <FormField
                  control={form.control}
                  name='shift_number'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Enter how many shifts'
                          type='number'
                          disabled={disabled}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                          min={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='split_number'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Split number</FormLabel>
                      <FormControl>
                        <Input
                          min={1}
                          placeholder='Enter how many splits'
                          type='number'
                          disabled={disabled}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </>
        )}

        {(disabled || currentStepId === 'type') && (
          <>
            {parentType === 'daily' && (
              <>
                <FormItem>
                  <FormLabel>Schedule type</FormLabel>
                  <Tabs value={type} onValueChange={handleTypeChange}>
                    <TabsList className='grid w-full grid-cols-3'>
                      {SCHEDULE_TYPES.map((t) => (
                        <TabsTrigger
                          key={t.value}
                          value={t.value}
                          disabled={disabled}
                        >
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </FormItem>

                {type === 'weekly' && <WeeklyFields disabled={disabled} />}
                {type === 'weekly_one' && (
                  <WeeklyOneFields disabled={disabled} />
                )}
                {type === 'monthly' && <MonthlyFields disabled={disabled} />}
              </>
            )}

            {parentType === 'regular' && (
              <RegularShiftFields disabled={disabled} />
            )}
          </>
        )}

        {((disabled && parentType === 'regular') ||
          currentStepId === 'policy') && (
          <>
            <FormField
              control={form.control}
              name='policy_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy type</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={POLICY_TYPE_OPTIONS}
                      value={
                        POLICY_TYPE_OPTIONS.find(
                          (o) => o.value === field.value
                        ) ?? null
                      }
                      onChange={(opt: { value: string } | null) =>
                        field.onChange(opt?.value ?? '')
                      }
                      isDisabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='leave_hours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leave equivalent hours per day</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={12}
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
              control={form.control}
              name='official_holiday_hours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Official holiday equivalent hours per day
                  </FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={12}
                      disabled={disabled}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {!disabled && currentStepId === 'summary' && (
          <ScheduleSummary control={looseControl} />
        )}

        {!disabled && (
          <div className='flex items-center justify-between pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={handleBack}
              disabled={step === 0}
            >
              Back
            </Button>
            {isLastStep ? (
              <Button key='submit' type='submit'>
                {submitLabel}
              </Button>
            ) : (
              <Button key='next' type='button' onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        )}
      </form>
    </Form>
  )
}
