import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { generateId } from '@/lib/id'
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
import { ATTENDANCE_TYPE_OPTIONS } from '../data/data'
import {
  getRuleResultMinutes,
  type ShiftPolicyFormValues,
} from '../data/schema'
import { buildDefaultRule, formatMinutes } from '../utils'

// The rules a policy applies, as a collapsible list — rendered by
// `PolicyFormDialog` only for policy types that carry rules. Reads and
// writes through `useFormContext`, so it plugs into that dialog's form
// without prop-drilling `control`.
export function PolicyRulesField() {
  const form = useFormContext<ShiftPolicyFormValues>()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rules',
  })

  // This section mounts the moment a rule-bearing type is picked — seed one
  // blank rule then, so it opens with something to fill in rather than an
  // empty panel plus an "Add at least one rule" error. Guarded on the
  // current length so an existing policy's rules are left alone, and so
  // clearing every rule by hand stays cleared.
  useEffect(() => {
    if (form.getValues('rules').length === 0) {
      append(buildDefaultRule(generateId()))
    }
  }, [append, form])

  const rulesError = form.formState.errors.rules?.message

  return (
    <Collapsible defaultOpen>
      <div className='rounded-md border'>
        <CollapsibleTrigger className='group flex w-full items-center justify-between gap-2 p-3 text-start'>
          <span className='text-sm font-semibold'>Rules</span>
          <ChevronDown className='size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180' />
        </CollapsibleTrigger>
        <CollapsibleContent className='space-y-3 border-t p-3'>
          {fields.map((field, index) => (
            <PolicyRuleRow
              key={field.id}
              index={index}
              onRemove={() => remove(index)}
            />
          ))}

          {rulesError && (
            <p className='text-sm text-destructive'>{rulesError}</p>
          )}

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-full'
            onClick={() => append(buildDefaultRule(generateId()))}
          >
            <Plus className='size-4' /> Add rule
          </Button>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

type PolicyRuleRowProps = {
  index: number
  onRemove: () => void
}

// One rule: its window, the factor applied to it, and how the result is
// booked. Watches only its own slice of the array so typing in one rule
// doesn't re-render the others.
function PolicyRuleRow({ index, onRemove }: PolicyRuleRowProps) {
  const form = useFormContext<ShiftPolicyFormValues>()
  const rule = useWatch({ control: form.control, name: `rules.${index}` })
  const resultMinutes = rule
    ? getRuleResultMinutes({
        from_time: rule.from_time,
        to_time: rule.to_time,
        factor: Number(rule.factor) || 0,
      })
    : 0

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex items-start gap-2'>
        <FormField
          control={form.control}
          name={`rules.${index}.name`}
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel className='text-xs'>Policy name</FormLabel>
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

      <div className='flex items-start gap-2'>
        <FormField
          control={form.control}
          name={`rules.${index}.from_time`}
          render={({ field }) => (
            <FormItem className='flex-1'>
              <FormLabel className='text-xs'>From</FormLabel>
              <FormControl>
                <Input type='time' className='h-8' {...field} />
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
                <Input type='time' className='h-8' {...field} />
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
                // Radix's hidden form-participation <select> bounces an
                // empty value back through onValueChange when it syncs a
                // programmatic write — and this field is written
                // programmatically by `buildDefaultRule`, which is exactly
                // the case that gets wiped. A real pick is never empty. See
                // the `radix-select-bubble-select-wipes-programmatic-value`
                // skill.
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
    </div>
  )
}
