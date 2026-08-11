import { useState } from 'react'
import { format } from 'date-fns'
import { type Control, type Resolver, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  type VerticalTabsStep,
  VerticalTabs,
} from '@/components/ui/vertical-tabs'
import { MultiSelect } from '@/components/multi-select'
import { SCHEDULE_TYPES } from '../../data/data'
import {
  type DailySchedule,
  type RegularType,
  type Schedule,
  type ScheduleType,
  scheduleSchema,
} from '../../data/schema'
import { generateId } from '../../utils'
import { EmployeeMultiSelect } from './employee-multi-select'
import { MonthlyFields } from './monthly-fields'
import { RecurrenceFields } from './recurrence-fields'
import { RegularBasicsFields } from './regular-basics-fields'
import { RotateFields } from './rotate-fields'
import { ScheduleSummary } from './schedule-summary'
import { ShiftDefinitionFields } from './shift-definition-fields'
import { WeeklyFields } from './weekly-fields'
import { WeeklyOneFields } from './weekly-one-fields'

function getSteps(
  parentType: string,
  regularType?: string,
  nbOfShifts?: number
): VerticalTabsStep[] {
  const steps: VerticalTabsStep[] = [{ id: 'basics', label: 'Basics' }]

  if (parentType === 'regular') {
    if (regularType === 'rotate') {
      steps.push({ id: 'rotate-config', label: 'Rotate config' })
    } else {
      steps.push({ id: 'shift-definition', label: 'Shift definition' })
      if (regularType === 'fixed' && nbOfShifts === 1) {
        steps.push({ id: 'recurrence', label: 'Recurrence' })
      }
    }
  } else {
    steps.push({ id: 'type', label: 'Type' })
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
        employees: [],
      }
    case 'weekly_one':
      return {
        parent_type: 'daily' as const,
        type: 'weekly_one' as const,
        days: [],
        employees: [],
      }
    case 'monthly':
      return {
        parent_type: 'daily' as const,
        type: 'monthly' as const,
        year: now.getFullYear(),
        months: [],
        employees: [],
      }
  }
}

function getRegularTypeDefaults(type: RegularType) {
  const base = {
    parent_type: 'regular' as const,
    type,
    is_active: true,
    start_date: format(now, 'yyyy-MM-dd'),
  }

  if (type === 'rotate') {
    return {
      ...base,
      cycle_type: 'rotating_shift' as const,
      cycle_length: { unit: 'weekly' as const, days: 7 },
      rotate_type: 'right_shift' as const,
      shift_block: 1,
      shift_length_hours: 8,
      blocks: [
        {
          id: generateId(),
          label: 'Shift A',
          time: { from_time: '09:00', to_time: '17:00' },
        },
      ],
      pattern: Array.from({ length: 7 }, (_, i) => ({
        position: i + 1,
        is_off: false,
        block_id: undefined,
      })),
    }
  }

  return {
    ...base,
    nb_of_shifts: 1,
    shifts: [{ id: generateId(), name: '', short_code: '', days: [] }],
    temporary_schedule: false,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStepFields(stepId: string, parentType: string, type?: string): any {
  if (stepId === 'basics') {
    return parentType === 'regular'
      ? [
          'name',
          'description',
          'parent_type',
          'type',
          'badge_color',
          'icon',
          'is_active',
          'policy_type',
          'start_date',
        ]
      : ['name', 'description', 'parent_type', 'employees']
  }
  if (stepId === 'shift-definition') {
    return [
      'nb_of_shifts',
      'shifts',
      'temporary_schedule',
      'temporary_schedule_label',
    ]
  }
  if (stepId === 'rotate-config') {
    return [
      'cycle_type',
      'cycle_length',
      'rotate_type',
      'shift_block',
      'shift_length_hours',
      'blocks',
      'pattern',
    ]
  }
  if (stepId === 'recurrence') {
    return ['recurrence']
  }
  if (stepId === 'type') {
    if (type === 'weekly') return ['type', 'year', 'month', 'week', 'days']
    if (type === 'weekly_one') return ['type', 'days']
    if (type === 'monthly') return ['type', 'year', 'months']
    return ['type']
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
    resolver: zodResolver(scheduleSchema) as Resolver<Schedule>,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const looseControl = form.control as unknown as Control<any>
  const regularType = useWatch({ control: looseControl, name: 'type' }) as
    | RegularType
    | undefined
  const nbOfShifts = useWatch({ control: looseControl, name: 'nb_of_shifts' })

  const steps =
    parentType === 'regular'
      ? getSteps(parentType, regularType, nbOfShifts)
      : getSteps(parentType)
  const currentStepId = steps[step]?.id
  const isLastStep = step === steps.length - 1

  const handleNext = async () => {
    const valid = await form.trigger(
      getStepFields(currentStepId, parentType, type)
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
      ...(value === 'daily'
        ? getTypeDefaults('weekly')
        : getRegularTypeDefaults('fixed')),
    } as Schedule)
    setStep(0)
  }

  const handleTypeChange = (value: string) => {
    if (value === type) return
    const current = form.getValues()
    form.reset({
      id: current.id,
      name: current.name,
      description: current.description,
      ...getTypeDefaults(value as ScheduleType),
      employees: (current as DailySchedule).employees ?? [],
    } as Schedule)
  }

  const handleRegularTypeChange = (value: RegularType) => {
    if (value === regularType) return
    const current = form.getValues()
    form.reset({
      id: current.id,
      name: current.name,
      description: current.description,
      ...getRegularTypeDefaults(value),
    } as Schedule)
    setStep(0)
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
        <div className={cn(!disabled && 'flex flex-col gap-8 sm:flex-row')}>
          {!disabled && (
            <VerticalTabs
              steps={steps}
              currentStep={step}
              onStepChange={setStep}
            />
          )}
          <div className='min-w-0 flex-1 space-y-6'>
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

                {parentType === 'daily' && (
                  <EmployeeMultiSelect
                    control={looseControl}
                    disabled={disabled}
                  />
                )}

                {parentType === 'regular' && (
                  <RegularBasicsFields
                    disabled={disabled}
                    onTypeChange={handleRegularTypeChange}
                  />
                )}
              </>
            )}

            {(disabled || currentStepId === 'type') &&
              parentType === 'daily' && (
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

            {(disabled || currentStepId === 'shift-definition') &&
              parentType === 'regular' &&
              regularType !== 'rotate' && (
                <ShiftDefinitionFields disabled={disabled} />
              )}

            {(disabled || currentStepId === 'rotate-config') &&
              parentType === 'regular' &&
              regularType === 'rotate' && <RotateFields disabled={disabled} />}

            {(disabled || currentStepId === 'recurrence') &&
              parentType === 'regular' &&
              regularType === 'fixed' &&
              nbOfShifts === 1 && <RecurrenceFields disabled={disabled} />}

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
          </div>
        </div>
      </form>
    </Form>
  )
}
