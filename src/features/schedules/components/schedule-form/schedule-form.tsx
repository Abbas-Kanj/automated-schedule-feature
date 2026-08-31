import { useState } from 'react'
import { format } from 'date-fns'
import { type Control, type Resolver, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { generateId } from '@/lib/id'
import { showSubmittedData } from '@/lib/show-submitted-data'
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
import { EmployeeMultiSelect } from './employee-multi-select'
import { MonthlyFields } from './monthly-fields'
import { PatternBuilder } from './pattern-builder'
import { ScheduleAssignToFields } from './schedule-assign-to-fields'
import { ScheduleBasicsFields } from './schedule-basics-fields'
import { ScheduleStartEndFields } from './schedule-start-end-fields'
import { ScheduleSummary } from './schedule-summary'
import { ShiftPickerField } from './shift-picker-field'
import { WeeklyFields } from './weekly-fields'
import { WeeklyOneFields } from './weekly-one-fields'

// `parent_type: 'daily'` (weekly / weekly_one / monthly) is no longer
// offered when creating or editing a schedule — the form only builds
// `regular` schedules (fixed/rotate/flexible) now. The 'daily' branches
// below are kept only so pre-existing daily schedules (view/edit) still
// render correctly; there's no UI path left to create a new one.
function getSteps(
  parentType: string,
  regularType?: RegularType
): VerticalTabsStep[] {
  if (parentType === 'daily') {
    return [
      { id: 'basics', label: 'Basics' },
      { id: 'type', label: 'Type' },
      { id: 'summary', label: 'Summary' },
    ]
  }

  // rotate gets its own pattern step (cycle/pattern config), then the
  // "Assign to" step that names the crew on each position of the pattern it
  // just built — that pairing is the whole roster the Schedule Rotation
  // screen reads (see `schedule-assign-to-fields.tsx`). PLUS the same
  // shared "Start & End" step as fixed/flexible (start date + end
  // frequency) — see `schedule-start-end-fields.tsx`.
  if (regularType === 'rotate') {
    return [
      { id: 'basics', label: 'Basics' },
      { id: 'shifts', label: 'Shifts' },
      { id: 'pattern', label: 'Pattern' },
      { id: 'assign-to', label: 'Assign to' },
      { id: 'end-settings', label: 'Start & End' },
      { id: 'summary', label: 'Summary' },
    ]
  }
  return [
    { id: 'basics', label: 'Basics' },
    { id: 'shifts', label: 'Shifts' },
    { id: 'end-settings', label: 'Start & End' },
    { id: 'summary', label: 'Summary' },
  ]
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

// "Never ends" is the "Start & End" step's default — pre-selected rather
// than starting blank. `end_occurrences` gets a default too, so the "End
// after" input isn't empty the moment it's switched to (see
// `EndFrequencyFields`'s always-visible end-settings inputs; mirrors
// shifts' own `repeat` defaults, see `shifts/data/defaults.ts`).
const DEFAULT_END_SETTINGS = {
  end_type: 'never' as const,
  end_occurrences: 1,
}

function getRegularTypeDefaults(type: RegularType) {
  const startDate = format(now, 'yyyy-MM-dd')

  if (type === 'rotate') {
    return {
      parent_type: 'regular' as const,
      type,
      start_date: startDate,
      end_settings: DEFAULT_END_SETTINGS,
      shift_ids: [] as string[],
      temporary_schedule: false,
      cycle_type: 'pattern_shifts' as const,
      cycle_length: { unit: 'weekly' as const, days: 6 },
      pattern: Array.from({ length: 7 }, (_, i) => ({
        position: i + 1,
        is_off: true,
        shift_id: undefined,
      })),
      shift_repeat: [] as {
        shift_id: string
        frequency: string
        interval: number
      }[],
    }
  }

  return {
    parent_type: 'regular' as const,
    type,
    start_date: startDate,
    end_settings: DEFAULT_END_SETTINGS,
    shift_ids: [] as string[],
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
    if (parentType !== 'regular') return ['name', 'description', 'employees']
    // Same basics fields for fixed/flexible/rotate alike — just type + template.
    return ['name', 'description', 'type']
  }
  if (stepId === 'shifts') {
    // Shared by fixed/flexible/rotate — the discriminated union's shared
    // superRefine enforces rotate's own ">=2 shifts" rule on this same field.
    return ['shift_ids']
  }
  if (stepId === 'end-settings') {
    return ['start_date', 'end_settings']
  }
  if (stepId === 'pattern') {
    return ['cycle_type', 'cycle_length', 'pattern', 'shift_repeat']
  }
  // Crew picks are optional — an unassigned position stays valid, so this
  // step never blocks "Next". It still re-validates `pattern` so anything
  // wrong carried over from the previous step surfaces here too.
  if (stepId === 'assign-to') {
    return ['pattern']
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
  // True while the "add new shift" modal (opened from the Shifts step) is
  // open — locks all step navigation so the user can't jump away from
  // underneath it. See `ShiftPickerField`'s `onDialogOpenChange`.
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false)

  const type = form.watch('type')
  const parentType = form.watch('parent_type')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const looseControl = form.control as unknown as Control<any>
  const regularType = useWatch({ control: looseControl, name: 'type' }) as
    RegularType | undefined

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
    setIsShiftDialogOpen(false)
  }

  const handleFormSubmit = (values: Schedule) => {
    // No backend wired up yet — log what would be sent (console + toast) so
    // the payload shape is easy to inspect during development.
    // eslint-disable-next-line no-console
    console.log(
      'Schedule form submitted — JSON payload:',
      JSON.stringify(values, null, 2)
    )
    showSubmittedData(values, 'Schedule submitted — JSON payload:')
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
              navigationDisabled={isShiftDialogOpen}
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
                  <ScheduleBasicsFields
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
                            // Monthly is legacy-only: an existing monthly
                            // schedule still renders, but it can't be
                            // switched to. Same call as the other greyed-out
                            // monthly options (see `data/data.ts`).
                            disabled={disabled || t.value === 'monthly'}
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

            {(disabled || currentStepId === 'shifts') &&
              parentType === 'regular' && (
                <ShiftPickerField
                  disabled={disabled}
                  minSelection={regularType === 'rotate' ? 2 : 1}
                  onDialogOpenChange={setIsShiftDialogOpen}
                />
              )}

            {(disabled || currentStepId === 'pattern') &&
              parentType === 'regular' &&
              regularType === 'rotate' && (
                <PatternBuilder disabled={disabled} />
              )}

            {(disabled || currentStepId === 'assign-to') &&
              parentType === 'regular' &&
              regularType === 'rotate' && (
                <ScheduleAssignToFields disabled={disabled} />
              )}

            {(disabled || currentStepId === 'end-settings') &&
              parentType === 'regular' && (
                <ScheduleStartEndFields disabled={disabled} />
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
                  disabled={step === 0 || isShiftDialogOpen}
                >
                  Back
                </Button>
                {isLastStep ? (
                  <Button
                    key='submit'
                    type='submit'
                    disabled={isShiftDialogOpen}
                  >
                    {submitLabel}
                  </Button>
                ) : (
                  <Button
                    key='next'
                    type='button'
                    onClick={handleNext}
                    disabled={isShiftDialogOpen}
                  >
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
