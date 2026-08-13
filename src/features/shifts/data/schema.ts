import { z } from 'zod'

export const SHIFT_BADGE_COLORS = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
] as const
const shiftBadgeColorSchema = z.enum(SHIFT_BADGE_COLORS)

export const SHIFT_ICONS = [
  'briefcase',
  'clock',
  'sun',
  'moon',
  'sunrise',
  'sunset',
  'coffee',
  'zap',
  'calendar',
  'users',
  'shield',
  'star',
] as const
const shiftIconSchema = z.enum(SHIFT_ICONS)

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required')

// Shared shape for both the stored `Shift` record and the create/edit form
// (which fills in `id` separately — see `shifts/utils.ts#generateId`).
const shiftFieldsSchema = z
  .object({
    name: z.string().min(1, 'Shift name is required'),
    short_code: z.string().min(1, 'Required').max(6),
    badge_color: shiftBadgeColorSchema,
    icon: shiftIconSchema,
    from_time: timeStringSchema,
    to_time: timeStringSchema,
    // Lets the range cross midnight (e.g. 22:00 -> 06:00) instead of
    // failing the "end after start" check below.
    overnight: z.boolean().default(false),
    description: z.string().max(200).optional(),
  })
  .refine((val) => val.overnight || val.to_time > val.from_time, {
    message: 'End time must be after start time (or mark as overnight)',
    path: ['to_time'],
  })

export const shiftFormSchema = shiftFieldsSchema
export const shiftSchema = z.object({ id: z.string() }).and(shiftFieldsSchema)

export type Shift = z.infer<typeof shiftSchema>
export type ShiftFormValues = z.infer<typeof shiftFormSchema>
export type ShiftBadgeColor = (typeof SHIFT_BADGE_COLORS)[number]
export type ShiftIcon = (typeof SHIFT_ICONS)[number]
