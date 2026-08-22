import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Eye, EyeOff, Pencil, Plus, Search, X } from 'lucide-react'
import { useTimeFormat } from '@/lib/time-format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPolicyTypeLabel } from '../data/data'
import { getPolicyRuleTypes, type ShiftPolicy } from '../data/schema'
import { usePoliciesStore } from '../stores/policies-store'
import { describeRule } from '../utils'
import { PolicyFormDialog } from './policy-form-dialog'

type PolicyPickerProps = {
  // Ids of the policies currently attached to whatever owns this picker.
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

// The type badges + rule count shown for a policy in both lists.
function PolicyMeta({ policy }: { policy: ShiftPolicy }) {
  return (
    <>
      {getPolicyRuleTypes(policy.rules).map((type) => (
        <Badge key={type} variant='outline' className='whitespace-nowrap'>
          {getPolicyTypeLabel(type)}
        </Badge>
      ))}
      {policy.rules.length > 0 && (
        <span className='text-xs text-muted-foreground'>
          {policy.rules.length} rule{policy.rules.length === 1 ? '' : 's'}
        </span>
      )}
    </>
  )
}

// Search + attach + create UI for shift policies, shared by the shift
// form's "Shift policy" tab (writing to the form) and the shifts table's
// "Modify policy" drawer (writing straight to the store). Owns the create,
// edit and details dialogs so both hosts get them for free.
export function PolicyPicker({ value, onChange, disabled }: PolicyPickerProps) {
  const policies = usePoliciesStore((s) => s.policies)
  const [query, setQuery] = useState('')
  // The catalogue lives in a dropdown under the search box rather than
  // inline, so the tab opens on this shift's own policies.
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftPolicy | null>(null)
  // Attached rows the eye has expanded, by id — the details open in place
  // rather than in a dialog, so several can be compared at once.
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const searchRef = useRef<HTMLDivElement>(null)
  const formatTime = useTimeFormat()

  const attached = useMemo(
    () => policies.filter((policy) => value.includes(policy.id)),
    [policies, value]
  )

  // What the dropdown offers: everything not already attached, narrowed by
  // the query against a policy's name or any of its rule types.
  const available = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return policies.filter((policy) => {
      if (value.includes(policy.id)) return false
      if (!needle) return true
      return (
        policy.name.toLowerCase().includes(needle) ||
        getPolicyRuleTypes(policy.rules).some((type) =>
          getPolicyTypeLabel(type).toLowerCase().includes(needle)
        )
      )
    })
  }, [policies, query, value])

  const toggleExpanded = (id: string) =>
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((expanded) => expanded !== id)
        : [...current, id]
    )

  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked
        ? [...new Set([...value, id])]
        : value.filter((selected) => selected !== id)
    )
  }

  // Click-away and Escape close the dropdown. A plain blur would fire
  // before the click on a result lands, so the listener is on the document
  // and scoped to the wrapper instead.
  useEffect(() => {
    if (!searchOpen) return
    const close = () => {
      setSearchOpen(false)
      setQuery('')
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [searchOpen])

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='relative flex-1' ref={searchRef}>
          <Search className='pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder='Search policies...'
            className='ps-8'
            disabled={disabled}
          />

          {searchOpen && (
            <div className='absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md'>
              {available.map((policy) => (
                <button
                  key={policy.id}
                  type='button'
                  onClick={() => toggle(policy.id, true)}
                  className='flex w-full items-start gap-2 border-b p-2 text-start last:border-b-0 hover:bg-accent hover:text-accent-foreground'
                >
                  <Plus className='mt-0.5 size-4 shrink-0 opacity-60' />
                  <span className='min-w-0 flex-1'>
                    <span className='flex flex-wrap items-center gap-2'>
                      <span className='truncate text-sm font-medium'>
                        {policy.name}
                      </span>
                      <PolicyMeta policy={policy} />
                    </span>
                    {policy.description && (
                      <span className='block truncate text-xs text-muted-foreground'>
                        {policy.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}

              {!available.length && (
                <p className='p-4 text-center text-sm text-muted-foreground'>
                  {!policies.length
                    ? 'No policies yet — add one to get started.'
                    : query.trim()
                      ? 'No policies match your search.'
                      : 'Every policy is already attached.'}
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          type='button'
          variant='outline'
          onClick={() => setCreateOpen(true)}
          disabled={disabled}
        >
          <Plus className='size-4' /> Add new policy
        </Button>
      </div>

      {/* What's attached to this shift — the default view, with the
          catalogue tucked into the dropdown above. */}
      <div className='space-y-2'>
        {attached.map((policy) => {
          const isExpanded = expandedIds.includes(policy.id)
          return (
            <div key={policy.id} className='rounded-md border'>
              <div className='flex items-center gap-2 p-2'>
                <Check className='size-4 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <p className='flex flex-wrap items-center gap-2'>
                    <span className='truncate text-sm font-medium'>
                      {policy.name}
                    </span>
                    <PolicyMeta policy={policy} />
                  </p>
                  {policy.description && !isExpanded && (
                    <p className='truncate text-xs text-muted-foreground'>
                      {policy.description}
                    </p>
                  )}
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0'
                  onClick={() => toggleExpanded(policy.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${policy.name}`}
                >
                  {isExpanded ? (
                    <EyeOff className='size-4' />
                  ) : (
                    <Eye className='size-4' />
                  )}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0'
                  onClick={() => setEditing(policy)}
                  disabled={disabled}
                  aria-label={`Edit ${policy.name}`}
                >
                  <Pencil className='size-4' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0'
                  onClick={() => toggle(policy.id, false)}
                  disabled={disabled}
                  aria-label={`Remove ${policy.name}`}
                >
                  <X className='size-4' />
                </Button>
              </div>

              {isExpanded && (
                <div className='space-y-2 border-t p-2'>
                  {policy.description && (
                    <p className='text-xs text-muted-foreground'>
                      {policy.description}
                    </p>
                  )}
                  {policy.rules.map((rule) => (
                    <div key={rule.id} className='rounded-md border p-2'>
                      <p className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm font-medium'>
                          {rule.name?.trim() || 'Rule'}
                        </span>
                        <Badge variant='outline' className='whitespace-nowrap'>
                          {getPolicyTypeLabel(rule.policy_type)}
                        </Badge>
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {describeRule(rule, formatTime)}
                      </p>
                    </div>
                  ))}
                  {!policy.rules.length && (
                    <p className='text-xs text-muted-foreground'>
                      This policy has no rules.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!attached.length && (
          <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
            No policies attached — search to attach one.
          </p>
        )}
      </div>

      <PolicyFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        // A policy created from here is attached straight away — that's the
        // reason to create one mid-flow.
        onSaved={(policy) => toggle(policy.id, true)}
      />
      {editing && (
        <PolicyFormDialog
          key={`policy-edit-${editing.id}`}
          currentRow={editing}
          open
          onOpenChange={(state) => {
            if (!state) setEditing(null)
          }}
        />
      )}
    </div>
  )
}
