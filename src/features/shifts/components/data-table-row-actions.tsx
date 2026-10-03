import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { useNavigate } from '@tanstack/react-router'
import { type Row } from '@tanstack/react-table'
import { Copy, Pencil, Shield, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Shift } from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'
import { useShifts } from './shifts-provider'

type DataTableRowActionsProps = {
  row: Row<Shift>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const shift = row.original
  const { setOpen, setCurrentRow } = useShifts()
  const cloneShift = useShiftsStore((s) => s.cloneShift)
  const navigate = useNavigate()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-40'>
        <DropdownMenuItem
          onClick={() =>
            navigate({
              to: '/shifts/$shiftId/edit',
              params: { shiftId: shift.id },
            })
          }
        >
          Edit
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            cloneShift(shift.id)
            toast.success(`Shift "${shift.name}" has been cloned.`)
          }}
        >
          Clone
          <DropdownMenuShortcut>
            <Copy size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(shift)
            setOpen('policy')
          }}
        >
          Modify policies
          <DropdownMenuShortcut>
            <Shield size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {/* Not wired up yet — kept visible so the action is discoverable. */}
        <DropdownMenuItem disabled>
          Assign users
          <DropdownMenuShortcut>
            <UserPlus size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(shift)
            setOpen('delete')
          }}
        >
          Delete
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
