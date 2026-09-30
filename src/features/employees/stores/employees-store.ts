import { z } from 'zod'
import { create } from 'zustand'
import employeeData from '../data/data.json'
import { type Employee, EmployeeSchema } from '../data/schema'

// Read-only, seeded from bundled sample records. No localStorage
// persistence — that would just shadow an updated seed. `parse`, not
// `safeParse`: a bad bundled seed is a bug to surface, not to paper over.
const seededEmployees: Employee[] = z.array(EmployeeSchema).parse(employeeData)

interface EmployeesState {
  employees: Employee[]
}

export const useEmployeesStore = create<EmployeesState>()(() => ({
  employees: seededEmployees,
}))
