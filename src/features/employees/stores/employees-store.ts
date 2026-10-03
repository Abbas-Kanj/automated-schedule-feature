import { z } from 'zod'
import { create } from 'zustand'
import employeeData from '../data/data.json'
import { type Employee, EmployeeSchema } from '../data/schema'

// Read-only, seeded from bundled sample records; no localStorage persistence.
// Uses `parse`, so a bad bundled seed surfaces.
const seededEmployees: Employee[] = z.array(EmployeeSchema).parse(employeeData)

interface EmployeesState {
  employees: Employee[]
}

export const useEmployeesStore = create<EmployeesState>()(() => ({
  employees: seededEmployees,
}))
