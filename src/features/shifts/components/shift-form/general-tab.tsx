import { useFormContext, useWatch } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  LOCAL_TIMEZONE,
  SHIFT_STATUS_OPTIONS,
  SHIFT_TIME_SLOT_TYPE_OPTIONS,
} from '../../data/data'
import { type ShiftFormValues } from '../../data/schema'
import { BadgeColorField } from './badge-color-field'
import { CategoryField } from './category-field'
import { IconPickerField } from './icon-picker-field'
import { ShiftTypeField } from './shift-type-field'
import { TimezoneField } from './timezone-field'

// "General" tab of `ShiftFormDialog` — name/look, type/category, status,
// time zone and active toggle. Hours live on their own "Shift times" tab
// (see `shift-times-tab.tsx`) and policy on its own "Shift policy" tab
// (see `shift-policy-tab.tsx`). Split out so the dialog itself only wires
// up the form and its tabs.
export function GeneralTab() {
  const form = useFormContext<ShiftFormValues>()

  const timezoneMode = useWatch({
    control: form.control,
    name: 'timezone_mode',
  })
  const timezone = useWatch({ control: form.control, name: 'timezone' })
  const category = useWatch({ control: form.control, name: 'category' })
  const customCategory = useWatch({
    control: form.control,
    name: 'custom_category',
  })

  return (
    <div className='space-y-4 px-0.5'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shift name</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g. Morning shift'
                  autoComplete='off'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='short_code'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short code</FormLabel>
              <FormControl>
                <Input
                  disabled
                  readOnly
                  placeholder='Auto filled from the first letters of the name'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='description'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder='Optional notes about this shift'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='grid gap-3 sm:grid-cols-2'>
        <FormField
          control={form.control}
          name='badge_color'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Badge color</FormLabel>
              <FormControl>
                <BadgeColorField
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='icon'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icon</FormLabel>
              <FormControl>
                <IconPickerField
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='shift_type'
        render={() => (
          <FormItem>
            <FormLabel>Shift type</FormLabel>
            <FormControl>
              <ShiftTypeField
                value={form.getValues('shift_type')}
                onChange={(value) =>
                  form.setValue('shift_type', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='category'
        render={() => (
          <FormItem>
            <FormLabel>Category</FormLabel>
            <FormControl>
              <CategoryField
                value={category}
                customValue={customCategory}
                onChange={(value) =>
                  form.setValue('category', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                onCustomChange={(value) =>
                  form.setValue('custom_category', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </FormControl>
            <FormMessage />
            {form.formState.errors.custom_category && (
              <p className='text-destructive text-sm'>
                {form.formState.errors.custom_category.message}
              </p>
            )}
          </FormItem>
        )}
      />

      {/* Not a real form field — just an indicator that the "Overnight"
          category forces every time range on the "Shift times" tab to
          cross midnight (see `ShiftTimesTab`'s `isOvernightCategory`). */}
      {category === 'overnight' && (
        <div className='flex flex-row items-center justify-between rounded-md border p-3'>
          <Label className='text-muted-foreground font-normal'>
            Check next day
          </Label>
          <Switch checked disabled />
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-2'>
        <FormField
          control={form.control}
          name='status'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a status' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SHIFT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='time_slot_type'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time slot type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a time slot type' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SHIFT_TIME_SLOT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='timezone_mode'
        render={() => (
          <FormItem>
            <FormLabel>Time zone</FormLabel>
            <FormControl>
              <TimezoneField
                mode={timezoneMode}
                value={timezone}
                onModeChange={(mode) =>
                  form.setValue('timezone_mode', mode, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                onValueChange={(value) =>
                  form.setValue('timezone', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </FormControl>
            {timezoneMode === 'local' && (
              <p className='text-muted-foreground text-xs'>
                Uses whichever local time zone this shift is viewed in —
                currently {LOCAL_TIMEZONE}.
              </p>
            )}
            {form.formState.errors.timezone && (
              <p className='text-destructive text-sm'>
                {form.formState.errors.timezone.message}
              </p>
            )}
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='is_active'
        render={({ field }) => (
          <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
            <FormLabel className='cursor-pointer'>Is Active</FormLabel>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  )
}
