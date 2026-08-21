import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PolicyPicker } from '@/features/shift-policies/components/policy-picker'
import { type Shift } from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'

type ShiftPolicyDrawerProps = {
  shift: Shift | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Quick "change this shift's policies" action from the table row menu —
// the same picker the shift form's "Shift policy" tab uses, just inside a
// drawer, writing straight to the store on change instead of needing a
// form submit.
export function ShiftPolicyDrawer({
  shift,
  open,
  onOpenChange,
}: ShiftPolicyDrawerProps) {
  const updateShift = useShiftsStore((s) => s.updateShift)
  // `shift` is a snapshot taken when the row's menu was clicked
  // (`currentRow` in `shifts-provider.tsx`) — it never re-renders once the
  // store updates, so the picker below kept showing the old selection right
  // after changing it even though the table (which reads straight from the
  // store) updated correctly. Re-read the live row from the store by id and
  // prefer that; fall back to the snapshot only for the brief window
  // between delete and this drawer unmounting.
  const liveShift =
    useShiftsStore((s) => s.shifts.find((row) => row.id === shift?.id)) ?? shift

  if (!liveShift) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{liveShift.name}</SheetTitle>
          <SheetDescription>
            Attach or detach this shift's policies.
          </SheetDescription>
        </SheetHeader>
        <div className='overflow-y-auto px-4 pb-4'>
          <PolicyPicker
            value={liveShift.policy_ids}
            onChange={(policy_ids) =>
              updateShift(liveShift.id, { ...liveShift, policy_ids })
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
