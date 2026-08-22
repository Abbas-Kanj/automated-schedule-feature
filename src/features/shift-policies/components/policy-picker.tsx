import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPolicyTypeLabel } from '../data/data'
import { getPolicyRuleTypes, type ShiftPolicy } from '../data/schema'
import { usePoliciesStore } from '../stores/policies-store'
import { PolicyFormDialog } from './policy-form-dialog'

type PolicyPickerProps = {
  // Ids of the policies currently attached to whatever owns this picker.
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

// Search + attach + create UI for shift policies, shared by the shift
// form's "Shift policy" tab (writing to the form) and the shifts table's
// "Modify policy" drawer (writing straight to the store). Owns the create
// and edit dialogs so both hosts get them for free.
export function PolicyPicker({ value, onChange, disabled }: PolicyPickerProps) {
  const policies = usePoliciesStore((s) => s.policies)
  const [query, setQuery] = useState('')
  // The full catalogue stays hidden until the user goes looking for a
  // policy — collapsed, this shows only what's attached. Opened by focusing
  // the search box, closed by its own "Done" button rather than on blur,
  // since blur fires before the click on a result's checkbox.
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftPolicy | null>(null)

  const attached = useMemo(
    () => policies.filter((policy) => value.includes(policy.id)),
    [policies, value]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return policies
    return policies.filter(
      (policy) =>
        policy.name.toLowerCase().includes(needle) ||
        getPolicyRuleTypes(policy.rules).some((type) =>
          getPolicyTypeLabel(type).toLowerCase().includes(needle)
        )
    )
  }, [policies, query])

  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked
        ? [...new Set([...value, id])]
        : value.filter((selected) => selected !== id)
    )
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='relative flex-1'>
          <Search className='pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder='Search policies...'
            className='ps-8'
            disabled={disabled}
          />
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

      {searchOpen ? (
        <div className='space-y-2'>
          {filtered.map((policy) => {
            const checkboxId = `policy-${policy.id}`
            return (
              <div
                key={policy.id}
                className='flex items-start gap-3 rounded-md border p-3'
              >
                <Checkbox
                  id={checkboxId}
                  checked={value.includes(policy.id)}
                  onCheckedChange={(state) => toggle(policy.id, state === true)}
                  disabled={disabled}
                  className='mt-0.5'
                />
                <Label
                  htmlFor={checkboxId}
                  className='min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 font-normal'
                >
                  <span className='flex flex-wrap items-center gap-2'>
                    <span className='truncate text-sm font-medium'>
                      {policy.name}
                    </span>
                    {getPolicyRuleTypes(policy.rules).map((type) => (
                      <Badge
                        key={type}
                        variant='outline'
                        className='whitespace-nowrap'
                      >
                        {getPolicyTypeLabel(type)}
                      </Badge>
                    ))}
                    {policy.rules.length > 0 && (
                      <span className='text-xs text-muted-foreground'>
                        {policy.rules.length} rule
                        {policy.rules.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                  {policy.description && (
                    <span className='block truncate text-xs text-muted-foreground'>
                      {policy.description}
                    </span>
                  )}
                </Label>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8 shrink-0'
                  onClick={() => setEditing(policy)}
                  disabled={disabled}
                  aria-label={`Edit ${policy.name}`}
                >
                  <Pencil className='size-4' />
                </Button>
              </div>
            )
          })}

          {!filtered.length && (
            <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
              {policies.length
                ? 'No policies match your search.'
                : 'No policies yet — add one to get started.'}
            </p>
          )}

          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='w-full'
            onClick={closeSearch}
          >
            Done
          </Button>
        </div>
      ) : (
        // Collapsed: just what's attached, so the tab opens on this shift's
        // own policies instead of the whole catalogue.
        <div className='space-y-2'>
          {attached.map((policy) => (
            <div
              key={policy.id}
              className='flex items-center gap-2 rounded-md border p-2'
            >
              <div className='min-w-0 flex-1'>
                <p className='flex flex-wrap items-center gap-2'>
                  <span className='truncate text-sm font-medium'>
                    {policy.name}
                  </span>
                  {getPolicyRuleTypes(policy.rules).map((type) => (
                    <Badge
                      key={type}
                      variant='outline'
                      className='whitespace-nowrap'
                    >
                      {getPolicyTypeLabel(type)}
                    </Badge>
                  ))}
                  {policy.rules.length > 0 && (
                    <span className='text-xs text-muted-foreground'>
                      {policy.rules.length} rule
                      {policy.rules.length === 1 ? '' : 's'}
                    </span>
                  )}
                </p>
                {policy.description && (
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
          ))}

          {!attached.length && (
            <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
              No policies attached — search to attach one.
            </p>
          )}
        </div>
      )}

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
