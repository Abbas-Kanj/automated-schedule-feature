import { z } from 'zod'
import { create } from 'zustand'
import employeeData from '../data/data.json'
import { type Employee, EmployeeSchema } from '../data/schema'

// Read-only employee directory, seeded from the bundled sample records.
// Team Management reads its member options from here (see `features/teams`).
// Kept as a store — rather than importing the JSON at each call site — so
// it's the single place that swaps to a real API later, matching how
// `shifts` / `shift-policies` centralize their records. No persistence: the
// records are seed-only today, and caching them to localStorage would just
// shadow an updated seed (a footgun CLAUDE.md already calls out for the
// other stores).
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
