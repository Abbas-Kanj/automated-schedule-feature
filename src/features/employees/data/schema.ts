import { z } from 'zod'

export const EmployeeSchema = z.object({
  id: z.string().optional(),
  firstname: z.string().min(1),
  middlename: z.string().min(1),
  lastname: z.string().min(1),
  dob: z.string().min(1),
  sex: z.object({
    value: z.string(),
    label: z.string(),
  }),
  address: z.string().trim().min(1).max(250),
  punch_code: z.string().trim().min(1).max(30),
  schedule: z.string().trim().min(1),
  email: z.email(),
  phonenumber: z.string().min(1),
  position: z.object({
    value: z.string(),
    label: z.string(),
  }),
  organization_unit: z.object({
    value: z.string(),
    label: z.string(),
  }),
})

export type Employee = z.infer<typeof EmployeeSchema>
