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
import { OccurrenceFields } from './occurrence-fields'
import { PatternBuilder } from './pattern-builder'
import { RegularBasicsFields } from './regular-basics-fields'
import { RotateFields } from './rotate-fields'
import { ScheduleSummary } from './schedule-summary'
import { ShiftDefinitionFields } from './shift-definition-fields'
import { WeeklyFields } from './weekly-fields'
import { WeeklyOneFields } from './weekly-one-fields'

// `parent_type: 'daily'` (weekly / weekly_one / monthly) is no longer
// offered when creating or editing a schedule — the form only builds
// `regular` schedules (fixed/rotate/flexible) now. The 'daily' branches
// below are kept only so pre-existing daily schedules (view/edit) still
// render correctly; there's no UI path left to create a new one.
function getSteps(parentType: string, regularType?: RegularType): VerticalTabsStep[] {
  if (parentType === 'daily') {
    return [
      { id: 'basics', label: 'Basics' },
      { id: 'type', label: 'Type' },
      { id: 'summary', label: 'Summary' },
    ]
  }

  const steps: VerticalTabsStep[] = [{ id: 'basics', label: 'Basics' }]
  steps.push({
    id: 'shift-definition',
    label: regularType === 'rotate' ? 'Shift blocks' : 'Shifts',
  })
  if (regularType === 'rotate') {
    steps.push({ id: 'pattern', label: 'Pattern' })
  }
  steps.push({ id: 'occurrence', label: 'Occurrence' })
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

const DEFAULT_RECURRENCE = {
  frequency: 'daily' as const,
  interval: 1,
  weekdays: [] as string[],
  end_type: 'never' as const,
  exceptions: { public_holiday: false, sick_leave: false },
}

function getRegularTypeDefaults(type: RegularType) {
  const base = {
    parent_type: 'regular' as const,
    type,
    is_active: true,
    start_date: format(now, 'yyyy-MM-dd'),
    recurrence: DEFAULT_RECURRENCE,
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
    shifts: [
      {
        id: generateId(),
        name: '',
        short_code: '',
        badge_color: 'blue' as const,
        icon: 'clock' as const,
        shift_length_hours: 8,
        days: [],
      },
    ],
    temporary_schedule: false,
  }
}

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
          'type',
          'is_active',
          'policy_type',
          'start_date',
          'nb_of_shifts',
          'shift_block',
        ]
      : ['name', 'description', 'employees']
  }
  if (stepId === 'shift-definition') {
    return type === 'rotate'
      ? ['blocks', 'rotate_type', 'cycle_length', 'shift_length_hours']
      : [
          'nb_of_shifts',
          'shifts',
          'temporary_schedule',
          'temporary_schedule_label',
        ]
  }
  if (stepId === 'pattern') {
    return ['cycle_type', 'pattern']
  }
  if (stepId === 'occurrence') {
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
        ...getRegularTypeDefaults('fixed'),
      } as Schedule),
  })

  const [step, setStep] = useState(0)
  // Furthest step the user has validated their way to — steps beyond this
  // are locked in the vertical tabs until the ones before them pass.
  const [maxStep, setMaxStep] = useState(0)

  const type = form.watch('type')
  const parentType = form.watch('parent_type')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const looseControl = form.control as unknown as Control<any>
  const regularType = useWatch({ control: looseControl, name: 'type' }) as
    | RegularType
    | undefined

  const steps = getSteps(parentType, regularType)
  const currentStepId = steps[step]?.id
  const isLastStep = step === steps.length - 1

  const goToStep = (index: number) => {
    setStep(Math.min(Math.max(index, 0), steps.length - 1))
  }

  const handleNext = async () => {
    const valid = await form.trigger(
      getStepFields(currentStepId, parentType, type)
    )
    if (valid) {
      const next = Math.min(step + 1, steps.length - 1)
      setStep(next)
      setMaxStep((m) => Math.max(m, next))
    }
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))

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
    setMaxStep(0)
  }

  const handleFormSubmit = (values: Schedule) => {
    // No backend wired up yet — log what would be sent so the payload
    // shape is easy to inspect during development.
    // eslint-disable-next-line no-console
    console.log(
      'Schedule form submitted — JSON payload:',
      JSON.stringify(values, null, 2)
    )
    onSubmit(values)
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
          return form.handleSubmit(handleFormSubmit)(e)
        }}
        className='space-y-6'
      >
        <div className={cn(!disabled && 'flex flex-col gap-8 sm:flex-row')}>
          {!disabled && (
            <VerticalTabs
              steps={steps}
              currentStep={step}
              onStepChange={goToStep}
              maxStepReached={maxStep}
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

            {(disabled || currentStepId === 'shift-definition') &&
              parentType === 'regular' &&
              regularType === 'rotate' && <RotateFields disabled={disabled} />}

            {(disabled || currentStepId === 'pattern') &&
              parentType === 'regular' &&
              regularType === 'rotate' && (
                <PatternBuilder disabled={disabled} />
              )}

            {(disabled || currentStepId === 'occurrence') &&
              parentType === 'regular' && (
                <OccurrenceFields disabled={disabled} />
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
          </div>
        </div>
      </form>
    </Form>
  )
}
