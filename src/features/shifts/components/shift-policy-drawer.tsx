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

export function ShiftPolicyDrawer({
  shift,
  open,
  onOpenChange,
}: ShiftPolicyDrawerProps) {
  const updateShift = useShiftsStore((s) => s.updateShift)
  // `shift` is a snapshot, so the live row is re-read by id; the snapshot is
  // only a fallback between delete and unmount.
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
