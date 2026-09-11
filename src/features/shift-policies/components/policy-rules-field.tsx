import { useEffect, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { generateId } from '@/lib/id'
import { useTimeFormat } from '@/lib/time-format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ATTENDANCE_TYPE_OPTIONS,
  getPolicyTypeLabel,
  POLICY_TYPE_OPTIONS,
} from '../data/data'
import {
  getRuleResultMinutes,
  isWindowRule,
  type PolicyType,
  type ShiftPolicyFormValues,
} from '../data/schema'
import {
  buildDefaultRule,
  describeRule,
  formatMinutes,
  retypeRule,
} from '../utils'
import { HolidayWorkRuleFields } from './holiday-work-fields'
import { MissedPunchRuleFields } from './missed-punch-fields'
import { Time24Input } from './time-24-input'

// The rules a policy applies, as a collapsible list. Each rule carries its
// own `policy_type`, so one policy can mix a tardy window with an overtime
// one — or with a missed-punch occurrence count, which swaps the rule's
// inputs entirely. Reads and writes through `useFormContext`, so it plugs
// into `PolicyFormDialog`'s form without prop-drilling `control`.
export function PolicyRulesField() {
  const form = useFormContext<ShiftPolicyFormValues>()
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'rules',
  })

  // Which rule (if any) is expanded for editing — the rest render as
  // one-line summaries, mirroring the shift form's break rows. A newly
  // added rule opens straight into editing; existing ones only on the
  // pencil.
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Open with something to fill in rather than an empty panel plus an
  // "Add at least one rule" error. Guarded on the current length so an
  // existing policy's rules are left alone, and so clearing every rule by
  // hand stays cleared.
  useEffect(() => {
    if (form.getValues('rules').length === 0) {
      append(buildDefaultRule(generateId()))
      setEditingIndex(0)
    }
  }, [append, form])

  const addRule = () => {
    append(buildDefaultRule(generateId()))
    setEditingIndex(fields.length)
  }

  const removeRule = (index: number) => {
    remove(index)
    setEditingIndex((current) => {
      if (current === null) return null
      if (current === index) return null
      return current > index ? current - 1 : current
    })
  }

  // Switching a rule between the two shapes replaces the whole entry, so it
  // goes through `useFieldArray.update` rather than a per-field setValue —
  // the fields being registered change with it.
  const changeRuleType = (index: number, next: PolicyType) => {
    const current = form.getValues(`rules.${index}`)
    if (!current || current.policy_type === next) return
    update(index, retypeRule(current, next))
  }

  const rulesError = form.formState.errors.rules?.message

  return (
    <Collapsible defaultOpen>
      <div className='rounded-md border'>
        <CollapsibleTrigger className='group flex w-full items-center justify-between gap-2 p-3 text-start'>
          <span className='text-sm font-semibold'>Rules</span>
          <ChevronDown className='size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180' />
        </CollapsibleTrigger>
        <CollapsibleContent className='space-y-3 border-t p-3'>
          {fields.map((field, index) =>
            editingIndex === index ? (
              <PolicyRuleRow
                key={field.id}
                index={index}
                onTypeChange={(next) => changeRuleType(index, next)}
                onRemove={() => removeRule(index)}
                onDone={() => setEditingIndex(null)}
              />
            ) : (
              <PolicyRuleSummary
                key={field.id}
                index={index}
                onEdit={() => setEditingIndex(index)}
                onRemove={() => removeRule(index)}
              />
            )
          )}

          {rulesError && (
            <p className='text-sm text-destructive'>{rulesError}</p>
          )}

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-full'
            onClick={addRule}
          >
            <Plus className='size-4' /> Add rule
          </Button>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

type PolicyRuleSummaryProps = {
  index: number
  onEdit: () => void
  onRemove: () => void
}

// A saved rule, collapsed: name and type on top, then the shape-specific
// detail on one muted line, with edit/trash actions at the end — the same
// shape as a collapsed break row.
function PolicyRuleSummary({
  index,
  onEdit,
  onRemove,
}: PolicyRuleSummaryProps) {
  const form = useFormContext<ShiftPolicyFormValues>()
  const formatTime = useTimeFormat()
  const rule = useWatch({ control: form.control, name: `rules.${index}` })
  if (!rule) return null

  // Whatever the resolver flagged for this rule, first message wins — the
  // row is collapsed, so there's no per-field `FormMessage` to carry it.
  const fieldErrors = form.formState.errors.rules?.[index]
  const error = fieldErrors
    ? Object.values(fieldErrors)
        .map((entry) => (entry as { message?: string })?.message)
        .find(Boolean)
    : undefined

  const detail = describeRule(rule, formatTime)

  return (
    <div className='flex items-center gap-2 rounded-md border p-2'>
      <div className='min-w-0 flex-1'>
        <p className='flex flex-wrap items-center gap-2'>
          <span className='truncate text-sm font-medium'>
            {rule.name?.trim() || 'Rule'}
          </span>
          <Badge variant='outline' className='whitespace-nowrap'>
            {getPolicyTypeLabel(rule.policy_type)}
          </Badge>
        </p>
        <p className='text-xs text-muted-foreground'>{detail}</p>
        {error && <p className='text-xs text-destructive'>{error}</p>}
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7'
        onClick={onEdit}
        aria-label='Edit rule'
      >
        <Pencil className='size-4' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-7'
        onClick={onRemove}
        aria-label='Remove rule'
      >
        <Trash2 className='size-4' />
      </Button>
    </div>
  )
}

type PolicyRuleRowProps = {
  index: number
  onTypeChange: (next: PolicyType) => void
  onRemove: () => void
  onDone: () => void
}

// One rule, expanded for editing: its type and name, then whichever set of
// inputs that type calls for. Watches only its own slice of the array so
// typing in one rule doesn't re-render the others.
function PolicyRuleRow({
  index,
  onTypeChange,
  onRemove,
  onDone,
}: PolicyRuleRowProps) {
  const form = useFormContext<ShiftPolicyFormValues>()
  const rule = useWatch({ control: form.control, name: `rules.${index}` })

  // Collapse only once this rule actually validates, so a half-filled row
  // can't be folded away into a summary that hides its errors.
  const save = async () => {
    const valid = await form.trigger(`rules.${index}`)
    if (valid) onDone()
  }

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex items-start gap-2'>
        <FormField
          control={form.control}
          name={`rules.${index}.name`}
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel className='text-xs'>Rule name</FormLabel>
              <FormControl>
                <Input className='h-8' placeholder='Rule name' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='mt-6 size-8 shrink-0'
          onClick={onRemove}
          aria-label='Remove rule'
        >
          <Trash2 className='size-4' />
        </Button>
      </div>

      {/* The type belongs to the rule, not the policy — changing it swaps
          the inputs below (see `retypeRule`). */}
      <FormField
        control={form.control}
        name={`rules.${index}.policy_type`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-xs'>Policy type</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                // Radix's hidden form-participation <select> bounces an
                // empty value back through onValueChange when it syncs a
                // programmatic write — and this field is written
                // programmatically by the rule builders, which is exactly
                // the case that gets wiped. A real pick is never empty. See
                // the `radix-select-bubble-select-wipes-programmatic-value`
                // skill.
                if (!value) return
                onTypeChange(value as PolicyType)
              }}
            >
              <FormControl>
                <SelectTrigger className='h-8 w-full'>
                  <SelectValue placeholder='Select a policy type' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {POLICY_TYPE_OPTIONS.map((option) => (
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

      {rule?.policy_type === 'missed_punch_error' ? (
        <MissedPunchRuleFields index={index} />
      ) : rule?.policy_type === 'working_on_day_off' ||
        rule?.policy_type === 'working_on_public_holiday' ? (
        <HolidayWorkRuleFields index={index} />
      ) : (
        <WindowRuleFields index={index} />
      )}

      <Button type='button' size='sm' className='w-full' onClick={save}>
        Save
      </Button>
    </div>
  )
}

// The window/factor half of a rule — every type except missed punch error.
function WindowRuleFields({ index }: { index: number }) {
  const form = useFormContext<ShiftPolicyFormValues>()
  const rule = useWatch({ control: form.control, name: `rules.${index}` })
  // Narrow to the window shape before reading its fields — the other two rule
  // shapes have no from/to/factor. This component is only rendered for window
  // types, but the watched value is still the full union.
  const resultMinutes =
    rule && isWindowRule(rule)
      ? getRuleResultMinutes({
          from_time: rule.from_time,
          to_time: rule.to_time,
          factor: Number(rule.factor) || 0,
        })
      : 0

  return (
    <>
      {/* 24-hour text fields rather than `type='time'` — see
          `Time24Input` for why the native control can't be kept. */}
      <div className='flex items-start gap-2'>
        <FormField
          control={form.control}
          name={`rules.${index}.from_time`}
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel className='text-xs'>From</FormLabel>
              <FormControl>
                <Time24Input
                  className='h-8'
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`rules.${index}.to_time`}
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel className='text-xs'>To</FormLabel>
              <FormControl>
                <Time24Input
                  className='h-8'
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className='flex items-start gap-2'>
        <FormField
          control={form.control}
          name={`rules.${index}.factor`}
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel className='text-xs'>Multiply by Factor</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
                  step={0.5}
                  className='h-8'
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? undefined : e.target.valueAsNumber
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* The factor applied to the window above — read-only, it's
            derived, not entered. */}
        <div className='flex-1 space-y-2'>
          <Label className='text-xs'>Result</Label>
          <Input
            disabled
            readOnly
            className='h-8'
            value={resultMinutes > 0 ? formatMinutes(resultMinutes) : '—'}
          />
        </div>
      </div>

      <FormField
        control={form.control}
        name={`rules.${index}.attendance_type`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-xs'>Attendance type</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value) => {
                // Same Radix bubble-select guard as the type select above.
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
                {ATTENDANCE_TYPE_OPTIONS.map((option) => (
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
    </>
  )
}
