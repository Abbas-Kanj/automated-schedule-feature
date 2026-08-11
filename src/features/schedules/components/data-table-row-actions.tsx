import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { type Row } from '@tanstack/react-table'
import { router } from '@/main'
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { scheduleSchema } from '../data/schema'
import { useSchedulesStore } from '../stores/schedules-store'
import { useSchedules } from './schedules-provider'

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const schedule = scheduleSchema.parse(row.original)
  const { setOpen, setCurrentRow } = useSchedules()
  const store = useSchedulesStore()

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
      <DropdownMenuContent align='end' className='w-32'>
        <DropdownMenuItem asChild>
          <Link
            to='/schedules/$scheduleId'
            params={{ scheduleId: schedule.id }}
          >
            View
            <DropdownMenuShortcut>
              <Eye size={16} />
            </DropdownMenuShortcut>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to='/schedules/$scheduleId/edit'
            params={{ scheduleId: schedule.id }}
          >
            Edit
            <DropdownMenuShortcut>
              <Pencil size={16} />
            </DropdownMenuShortcut>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const clonedSchedule = store.cloneSchedule(schedule)
            router.navigate({ to: `/schedules/${clonedSchedule.id}/edit` })
            toast.success(`Schedule "${schedule.name}" has been cloned.`)
          }}
        >
          Clone
          <DropdownMenuShortcut>
            <Copy size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(schedule)
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
