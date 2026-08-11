import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Schedule } from '../data/schema'

export type SchedulesDialogType = 'edit' | 'delete'

type SchedulesContextType = {
  open: SchedulesDialogType | null
  setOpen: (str: SchedulesDialogType | null) => void
  currentRow: Schedule | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Schedule | null>>
}

const SchedulesContext = React.createContext<SchedulesContextType | null>(null)

export function SchedulesProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<SchedulesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Schedule | null>(null)

  return (
    <SchedulesContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </SchedulesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSchedules = () => {
  const schedulesContext = React.useContext(SchedulesContext)

  if (!schedulesContext) {
    throw new Error('useSchedules has to be used within <SchedulesContext>')
  }

  return schedulesContext
}
