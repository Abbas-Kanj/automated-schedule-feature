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
  // `shift` is a snapshot taken when the row's menu was clicked
  // (`currentRow` in `shifts-provider.tsx`) — it never re-renders once the
  // store updates, so the Select below kept showing the old policy right
  // after picking a new one even though the table (which reads straight
  // from the store) updated correctly. Re-read the live row from the store
  // by id and prefer that; fall back to the snapshot only for the brief
  // window between delete and this drawer unmounting.
  const liveShift =
    useShiftsStore((s) => s.shifts.find((row) => row.id === shift?.id)) ??
    shift

  if (!liveShift) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{liveShift.name}</SheetTitle>
          <SheetDescription>Change this shift's policy.</SheetDescription>
        </SheetHeader>
        <div className='overflow-y-auto px-4 pb-4'>
          <PolicySelectField
            value={liveShift.policy_type}
            onChange={(value) =>
              updateShift(liveShift.id, { ...liveShift, policy_type: value })
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
