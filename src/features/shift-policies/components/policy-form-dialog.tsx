import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { emptyShiftPolicyFormValues } from '../data/defaults'
import {
  type ShiftPolicy,
  type ShiftPolicyFormValues,
  shiftPolicyFormSchema,
} from '../data/schema'
import { usePoliciesStore } from '../stores/policies-store'
import { PolicyRulesField } from './policy-rules-field'

type PolicyFormDialogProps = {
  currentRow?: ShiftPolicy
  open: boolean
  onOpenChange: (open: boolean) => void
  // Lets the opener react to the saved policy — `PolicyPicker` uses it to
  // attach a just-created policy to whatever it is editing.
  onSaved?: (policy: ShiftPolicy) => void
}

// Creates or edits a shift policy. Opened both from the policies screen and
// from the shift form's "Shift policy" tab — which means this dialog can
// render *inside* another form. Radix portals the content out of that
// form's DOM subtree, but React still bubbles the inner submit event
// through the React tree, so `onSubmit` stops propagation explicitly or
// saving a policy would also submit the shift.
export function PolicyFormDialog({
  currentRow,
  open,
  onOpenChange,
  onSaved,
}: PolicyFormDialogProps) {
  const isEdit = !!currentRow
  const addPolicy = usePoliciesStore((s) => s.addPolicy)
  const updatePolicy = usePoliciesStore((s) => s.updatePolicy)

  const form = useForm<ShiftPolicyFormValues>({
    resolver: zodResolver(
      shiftPolicyFormSchema
    ) as Resolver<ShiftPolicyFormValues>,
    defaultValues: isEdit ? currentRow : emptyShiftPolicyFormValues,
  })

  const onSubmit = (values: ShiftPolicyFormValues) => {
    const saved: ShiftPolicy = {
      ...values,
      id: currentRow?.id ?? generateId(),
    }

    if (isEdit) {
      updatePolicy(saved.id, saved)
      toast.success(`Policy "${saved.name}" has been updated.`)
    } else {
      addPolicy(saved)
      toast.success(`Policy "${saved.name}" has been created.`)
    }
    onSaved?.(saved)
    onOpenChange(false)
    // Edit keeps what was just saved (this dialog stays mounted while it
    // animates closed); create goes back to a blank form for the next one.
    form.reset(isEdit ? saved : emptyShiftPolicyFormValues)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        if (!state) form.reset(isEdit ? currentRow : emptyShiftPolicyFormValues)
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? 'Edit policy' : 'Add new policy'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this policy and the rules it applies.'
              : 'Name the policy, then add the rules it applies.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id='shift-policy-form'
            onSubmit={(event) => {
              // Keeps a policy save from bubbling into a host form (the
              // shift form's policy tab opens this dialog).
              event.stopPropagation()
              void form.handleSubmit(onSubmit)(event)
            }}
            className='max-h-[60vh] space-y-4 overflow-y-auto px-0.5'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Policy name' {...field} />
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
                      placeholder='Optional notes about this policy'
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PolicyRulesField />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type='submit' form='shift-policy-form'>
            {isEdit ? 'Save changes' : 'Add policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
