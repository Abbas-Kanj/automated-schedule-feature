import { useState } from 'react'
import { format } from 'date-fns'
import {
  type Control,
  type Resolver,
  type UseFormReturn,
  useForm,
  useWatch,
} from 'react-hook-form'
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
  DEFAULT_OCCURRENCE_EXCEPTIONS,
  type RegularType,
  type Schedule,
  type ScheduleType,
  scheduleSchema,
} from '../../data/schema'
import {
  crewSelectionFromDayCoverage,
  pruneRosterToCrews,
} from '../../rotation-crews'
import { AssignToCrewFields } from './assign-to-crew-fields'
import { EmployeeMultiSelect } from './employee-multi-select'
import { FixedAssignToFields } from './fixed-assign-to-fields'
import { MonthlyFields } from './monthly-fields'
import { OccurrenceFields } from './occurrence-fields'
import { PatternBuilder } from './pattern-builder'
import { ScheduleBasicsFields } from './schedule-basics-fields'
import { ScheduleStartEndFields } from './schedule-start-end-fields'
import { ScheduleSummary } from './schedule-summary'
import { ShiftPickerField } from './shift-picker-field'
import { WeeklyFields } from './weekly-fields'
import { WeeklyOneFields } from './weekly-one-fields'

// `parent_type: 'daily'` isn't offered when creating/editing a schedule — the
// 'daily' branches below exist only so pre-existing daily schedules still
// render correctly on view/edit.
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

  // Rotate only picks who is on the rotation here; placing those crews on
  // days happens on the rotating Work schedule's "Assign crews".
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
  // Fixed assigns crews per shift directly, once the dates are known.
  if (regularType === 'fixed') {
    return [
      { id: 'basics', label: 'Basics' },
      { id: 'shifts', label: 'Shifts' },
      { id: 'occurrence', label: 'Occurrence' },
      { id: 'end-settings', label: 'Start & End' },
      { id: 'assign-to', label: 'Assign to' },
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

// `end_occurrences` gets a default too, so the "End after" input isn't empty
// the moment it's switched to.
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
      crew_kind: 'team' as const,
      crew_ids: [] as string[],
      cycle_length: { unit: 'weekly' as const, days: 7 },
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
      day_coverage: [] as {
        day: number
        shift_id: string
        employee_ids: string[]
        team_ids: string[]
      }[],
      crew_placements: [] as {
        crew: string
        day_offset: number
        shift_step: number
      }[],
    }
  }

  const shared = {
    parent_type: 'regular' as const,
    type,
    start_date: startDate,
    end_settings: DEFAULT_END_SETTINGS,
    shift_ids: [] as string[],
    temporary_schedule: false,
  }

  if (type === 'fixed') {
    return {
      ...shared,
      shift_occurrences: [] as Record<string, unknown>[],
      occurrence_exceptions: DEFAULT_OCCURRENCE_EXCEPTIONS,
      crew_kind: 'team' as const,
      shift_assignments: [] as Record<string, unknown>[],
    }
  }

  return shared
}

// A schedule saved before the "Assign to" step stored its pick still has a
// roster; recover the pick from it so editing opens on the right crews.
function withCrewSelection(schedule: Schedule): Schedule {
  if (schedule.parent_type !== 'regular' || schedule.type !== 'rotate') {
    return schedule
  }
  if (schedule.crew_ids?.length) return schedule
  const derived = crewSelectionFromDayCoverage(schedule.day_coverage)
  return derived.crew_ids.length
    ? { ...schedule, ...derived }
    : { ...schedule, crew_kind: schedule.crew_kind ?? 'team', crew_ids: [] }
}

type ScheduleFormProps = {
  defaultValues?: Schedule
  onSubmit: (values: Schedule) => void
  disabled?: boolean
  submitLabel?: string
  // Creating only: going back clears every later step, so what's ahead is
  // always rebuilt from what's behind. Editing keeps saved data.
  resetLaterStepsOnBack?: boolean
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
  if (stepId === 'occurrence') {
    return ['shift_occurrences', 'occurrence_exceptions']
  }
  // At least one crew is required too, but checked in `handleNext` rather
  // than the schema, so schedules saved without a pick still load.
  if (stepId === 'assign-to') {
    return type === 'fixed'
      ? ['crew_kind', 'shift_assignments']
      : ['crew_kind', 'crew_ids']
  }
  if (stepId === 'type') {
    if (type === 'weekly') return ['type', 'year', 'month', 'week', 'days']
    if (type === 'weekly_one') return ['type', 'days']
    if (type === 'monthly') return ['type', 'year', 'months']
    return ['type']
  }
  return []
}

// Fields a step doesn't show but whose meaning depends on it: a rotate roster
// is placed on the pattern's cards and drawn from the "Assign to" pick.
const STEP_DEPENDENT_FIELDS: Record<string, string[]> = {
  pattern: ['day_coverage', 'crew_placements'],
  'assign-to': ['day_coverage', 'crew_placements'],
}

export function ScheduleForm({
  defaultValues,
  onSubmit,
  disabled = false,
  submitLabel = 'Save schedule',
  resetLaterStepsOnBack = false,
}: ScheduleFormProps) {
  const form = useForm<Schedule>({
    resolver: zodResolver(scheduleSchema) as Resolver<Schedule>,
    mode: 'onChange',
    defaultValues:
      (defaultValues && withCrewSelection(defaultValues)) ??
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const looseForm = form as unknown as UseFormReturn<any>
  const regularType = useWatch({ control: looseControl, name: 'type' }) as
    | RegularType
    | undefined
  const steps = getSteps(parentType, regularType)
  const currentStepId = steps[step]?.id
  const isLastStep = step === steps.length - 1

  // Leaving rotate's "Assign to" drops anybody no longer picked from a saved
  // roster, so "Assign crews" never shows crews that are not on the schedule.
  const pruneRosterToSelection = () => {
    const values = looseForm.getValues()
    const pruned = pruneRosterToCrews(
      values.day_coverage ?? [],
      values.crew_placements ?? [],
      values.crew_kind ?? 'team',
      values.crew_ids ?? []
    )
    looseForm.setValue('day_coverage', pruned.day_coverage)
    looseForm.setValue('crew_placements', pruned.crew_placements)
  }

  // Puts every field of the steps after `index` back to this type's defaults
  // and locks those steps again.
  const resetStepsAfter = (index: number) => {
    const defaults = (
      parentType === 'daily'
        ? getTypeDefaults(type as ScheduleType)
        : getRegularTypeDefaults(regularType ?? 'fixed')
    ) as Record<string, unknown>
    const fields = new Set<string>()
    steps.slice(index + 1).forEach(({ id }) => {
      const stepFields = getStepFields(id, parentType, type) as string[]
      stepFields.forEach((field) => fields.add(field))
      STEP_DEPENDENT_FIELDS[id]?.forEach((field) => fields.add(field))
    })
    // The discriminators pick the steps themselves; they are never "later".
    fields.delete('type')
    fields.delete('parent_type')
    fields.forEach((field) => {
      if (!(field in defaults)) return
      looseForm.setValue(field, structuredClone(defaults[field]))
    })
    looseForm.clearErrors([...fields])
    setMaxStep(index)
  }

  const goToStep = (index: number) => {
    const target = Math.min(Math.max(index, 0), steps.length - 1)
    if (currentStepId === 'assign-to' && regularType === 'rotate') {
      pruneRosterToSelection()
    }
    if (resetLaterStepsOnBack && target < step) resetStepsAfter(target)
    setStep(target)
  }

  const handleNext = async () => {
    if (currentStepId === 'assign-to' && regularType === 'fixed') {
      const assignments = (looseForm.getValues('shift_assignments') ?? []) as {
        employee_ids: string[]
        team_ids: string[]
      }[]
      if (
        !assignments.some((a) => a.employee_ids.length || a.team_ids.length)
      ) {
        looseForm.setError('shift_assignments', {
          type: 'manual',
          message: 'Assign at least one team or employee to a shift',
        })
        return
      }
    }

    if (currentStepId === 'assign-to' && regularType === 'rotate') {
      const crewIds = looseForm.getValues('crew_ids') as string[] | undefined
      if (!crewIds?.length) {
        looseForm.setError('crew_ids', {
          type: 'manual',
          message: 'Select at least one team or employee',
        })
        return
      }
      pruneRosterToSelection()
    }

    const valid = await form.trigger(
      getStepFields(currentStepId, parentType, type)
    )
    if (valid) {
      const next = Math.min(step + 1, steps.length - 1)
      setStep(next)
      setMaxStep((m) => Math.max(m, next))
    }
  }

  const handleBack = () => goToStep(step - 1)

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
                            // Monthly is legacy-only: renders if already
                            // saved, but can't be switched to.
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

            {(disabled || currentStepId === 'occurrence') &&
              parentType === 'regular' &&
              regularType === 'fixed' && (
                <OccurrenceFields disabled={disabled} />
              )}

            {(disabled || currentStepId === 'assign-to') &&
              parentType === 'regular' &&
              regularType === 'rotate' && (
                <AssignToCrewFields disabled={disabled} />
              )}

            {(disabled || currentStepId === 'assign-to') &&
              parentType === 'regular' &&
              regularType === 'fixed' && (
                <FixedAssignToFields disabled={disabled} />
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
