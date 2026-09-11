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
  // Optional — not collected by the create/edit form (only Personal
  // information is), but still present on the seeded records and shown in the
  // employees list.
  punch_code: z.string().trim().min(1).max(30).optional(),
  schedule: z.string().trim().min(1).optional(),
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
