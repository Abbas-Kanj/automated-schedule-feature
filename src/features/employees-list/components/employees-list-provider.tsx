import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Employee } from '../../employees/data/schema'

type EmployeesListDialogType = 'delete'

type EmployeesListContextType = {
  open: EmployeesListDialogType | null
  setOpen: (str: EmployeesListDialogType | null) => void
  currentRow: Employee | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Employee | null>>
}

const EmployeesListContext =
  React.createContext<EmployeesListContextType | null>(null)

export function EmployeesListProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<EmployeesListDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Employee | null>(null)

  return (
    <EmployeesListContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </EmployeesListContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEmployeesList = () => {
  const employeesListContext = React.useContext(EmployeesListContext)

  if (!employeesListContext) {
    throw new Error(
      'useEmployeesList has to be used within <EmployeesListContext>'
    )
  }

  return EmployeesListContext
}
