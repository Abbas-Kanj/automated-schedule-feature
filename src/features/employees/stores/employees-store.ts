import { z } from 'zod'
import { create } from 'zustand'
import employeeData from '../data/data.json'
import { type Employee, EmployeeSchema } from '../data/schema'

// Read-only, seeded from bundled sample records. No localStorage
// persistence — that would just shadow an updated seed.
const parsed = z.array(EmployeeSchema).safeParse(employeeData)
const seededEmployees: Employee[] = parsed.success
  ? parsed.data
  : (employeeData as unknown as Employee[])

interface EmployeesState {
  employees: Employee[]
}

export const useEmployeesStore = create<EmployeesState>()(() => ({
  employees: seededEmployees,
}))
