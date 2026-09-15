import { useRef, useState } from 'react'
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
  DEFAULT_OCCURRENCE,
  type Occurrence,
  type RegularType,
  type RotateCrewPlacement,
  type RotateDayCoverage,
  type Schedule,
  type ScheduleType,
  scheduleSchema,
} from '../../data/schema'
import { occurrencePattern } from '../../occurrence-pattern'
import {
  crewSelectionFromDayCoverage,
  pruneRosterToCrews,
} from '../../rotation-crews'
import { AssignToCrewFields } from './assign-to-crew-fields'
import { EmployeeMultiSelect } from './employee-multi-select'
import { MonthlyFields } from './monthly-fields'
import { OccurrenceFields } from './occurrence-fields'
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

  // rotate gets its own pattern step (cycle/pattern config) — the template
  // one crew's journey follows — then "Assign to", which staffs it, PLUS the
  // same shared "Start & End" step as fixed/flexible (start date + end
  // frequency; see `schedule-start-end-fields.tsx`). The same "Assign to"
  // component also backs the "Assign crews" dialog on Schedule Rotation, for
  // editing the roster after the schedule exists.
  if (regularType === 'rotate') {
    return [
      { id: 'basics', label: 'Basics' },
      { id: 'shifts', label: 'Shifts' },
      { id: 'pattern', label: 'Pattern' },
      { id: 'assign-to', label: 'Assign to' },
      { id: 'work', label: 'Work rotation' },
      { id: 'end-settings', label: 'Start & End' },
      { id: 'summary', label: 'Summary' },
    ]
  }
  // fixed's "Occurrence" plays the part rotate's Pattern does, and "Work
  // fixed" reads it as one. "Start & End" is the last step before Summary for
  // both types. The occurrence pattern is anchored on the start date (which
  // defaults to today), so changing it there re-lines the weekdays under an
  // already-assigned roster — the coverage panel reflects that if revisited.
  if (regularType === 'fixed') {
    return [
      { id: 'basics', label: 'Basics' },
      { id: 'shifts', label: 'Shifts' },
      { id: 'occurrence', label: 'Occurrence' },
      { id: 'assign-to', label: 'Assign to' },
      { id: 'work', label: 'Work fixed' },
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
      crew_kind: 'team' as const,
      crew_ids: [] as string[],
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
      occurrence: DEFAULT_OCCURRENCE,
      crew_kind: 'team' as const,
      crew_ids: [] as string[],
      day_coverage: [] as RotateDayCoverage[],
      crew_placements: [] as RotateCrewPlacement[],
    }
  }

  return shared
}

// A schedule saved before the "Assign to" step stored its pick still has a
// roster; recover the pick from it so editing opens on the right crews.
function withCrewSelection(schedule: Schedule): Schedule {
  if (schedule.parent_type !== 'regular' || schedule.type === 'flexible') {
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
    return ['occurrence']
  }
  // At least one crew is required too, but checked in `handleNext` rather
  // than the schema, so schedules saved without a pick still load.
  if (stepId === 'assign-to') {
    return ['crew_kind', 'crew_ids']
  }
  // Only well-formedness is checked — an unstaffed shift is a warning in the
  // coverage panel, never a reason to block "Next".
  if (stepId === 'work') {
    return ['day_coverage', 'crew_placements']
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
  // Set by the "Assign to" step while it is mounted, so leaving the step
  // accepts the crew assignment it is showing — see
  // `schedule-assign-to-fields.tsx#commitPendingSuggestion`.
  const assignToCommitRef = useRef<(() => void) | null>(null)

  const type = form.watch('type')
  const parentType = form.watch('parent_type')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const looseControl = form.control as unknown as Control<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const looseForm = form as unknown as UseFormReturn<any>
  const regularType = useWatch({ control: looseControl, name: 'type' }) as
    | RegularType
    | undefined
  const occurrence = useWatch({
    control: looseControl,
    name: 'occurrence',
  }) as Occurrence | undefined
  const startDate = useWatch({ control: looseControl, name: 'start_date' }) as
    | string
    | undefined
  const shiftIds = useWatch({ control: looseControl, name: 'shift_ids' }) as
    | string[]
    | undefined

  // What "Assign to" staffs for a fixed schedule; rotate reads its own
  // `pattern` field instead.
  const fixedPattern =
    regularType === 'fixed'
      ? occurrencePattern(occurrence, startDate, shiftIds?.[0])
      : undefined

  const steps = getSteps(parentType, regularType)
  const currentStepId = steps[step]?.id
  const isLastStep = step === steps.length - 1

  // Leaving "Assign to" drops anybody no longer picked from the roster, so the
  // work step never shows crews that are not on the schedule.
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

  const goToStep = (index: number) => {
    if (currentStepId === 'work') assignToCommitRef.current?.()
    if (currentStepId === 'assign-to') pruneRosterToSelection()
    setStep(Math.min(Math.max(index, 0), steps.length - 1))
  }

  const handleNext = async () => {
    // Before validating, not after: the commit writes `day_coverage`, and
    // `trigger` has to see the values the user is actually advancing with.
    if (currentStepId === 'work') assignToCommitRef.current?.()

    if (currentStepId === 'assign-to') {
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

            {(disabled || currentStepId === 'occurrence') &&
              parentType === 'regular' &&
              regularType === 'fixed' && (
                <OccurrenceFields disabled={disabled} />
              )}

            {(disabled || currentStepId === 'assign-to') &&
              parentType === 'regular' &&
              (regularType === 'rotate' || regularType === 'fixed') && (
                <AssignToCrewFields disabled={disabled} />
              )}

            {(disabled || currentStepId === 'work') &&
              parentType === 'regular' &&
              (regularType === 'rotate' || regularType === 'fixed') && (
                <div className='space-y-1.5'>
                  {disabled && (
                    <FormLabel>
                      {regularType === 'rotate' ? 'Work rotation' : 'Work fixed'}
                    </FormLabel>
                  )}
                  <ScheduleAssignToFields
                    disabled={disabled}
                    commitRef={assignToCommitRef}
                    pattern={fixedPattern}
                    manualOnly={regularType === 'fixed'}
                    poolFromForm
                  />
                </div>
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
