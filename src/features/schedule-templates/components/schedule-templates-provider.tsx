import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type ScheduleTemplate } from '../data/schema'

export type ScheduleTemplatesDialogType = 'create' | 'edit' | 'delete'

type ScheduleTemplatesContextType = {
  open: ScheduleTemplatesDialogType | null
  setOpen: (str: ScheduleTemplatesDialogType | null) => void
  currentRow: ScheduleTemplate | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ScheduleTemplate | null>>
}

const ScheduleTemplatesContext =
  React.createContext<ScheduleTemplatesContextType | null>(null)

export function ScheduleTemplatesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<ScheduleTemplatesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<ScheduleTemplate | null>(null)

  return (
    <ScheduleTemplatesContext
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </ScheduleTemplatesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useScheduleTemplates = () => {
  const scheduleTemplatesContext = React.useContext(ScheduleTemplatesContext)

  if (!scheduleTemplatesContext) {
    throw new Error(
      'useScheduleTemplates has to be used within <ScheduleTemplatesContext>'
    )
  }

  return scheduleTemplatesContext
}
