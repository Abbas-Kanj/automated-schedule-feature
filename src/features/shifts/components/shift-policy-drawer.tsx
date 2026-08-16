import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PolicySelectField } from './shift-form/policy-select-field'
import { type Shift } from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'

type ShiftPolicyDrawerProps = {
  shift: Shift | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Quick "change this shift's policy" action from the table row menu —
// reuses the same dropdown + inline detail sections as the shift form's
// own "Shift policy" tab (`policy-select-field.tsx`), just inside a drawer
// instead of a form tab, writing straight to the store on change instead
// of needing a form submit.
export function ShiftPolicyDrawer({
  shift,
  open,
  onOpenChange,
}: ShiftPolicyDrawerProps) {
  const updateShift = useShiftsStore((s) => s.updateShift)

  if (!shift) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{shift.name}</SheetTitle>
          <SheetDescription>Change this shift's policy.</SheetDescription>
        </SheetHeader>
        <div className='overflow-y-auto px-4 pb-4'>
          <PolicySelectField
            value={shift.policy_type}
            onChange={(value) =>
              updateShift(shift.id, { ...shift, policy_type: value })
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
