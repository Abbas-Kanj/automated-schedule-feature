import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  type TimeFormat,
  useDisplayPreferencesStore,
} from '@/stores/display-preferences-store'

const items = [
  {
    id: 'recents',
    label: 'Recents',
  },
  {
    id: 'home',
    label: 'Home',
  },
  {
    id: 'applications',
    label: 'Applications',
  },
  {
    id: 'desktop',
    label: 'Desktop',
  },
  {
    id: 'downloads',
    label: 'Downloads',
  },
  {
    id: 'documents',
    label: 'Documents',
  },
] as const

const displayFormSchema = z.object({
  items: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one item.',
  }),
})

type DisplayFormValues = z.infer<typeof displayFormSchema>

// This can come from your database or API.
const defaultValues: Partial<DisplayFormValues> = {
  items: ['recents', 'home'],
}

export function DisplayForm() {
  const form = useForm<DisplayFormValues>({
    resolver: zodResolver(displayFormSchema),
    defaultValues,
  })

  const timeFormat = useDisplayPreferencesStore((s) => s.time_format)
  const setTimeFormat = useDisplayPreferencesStore((s) => s.setTimeFormat)

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => showSubmittedData(data))}
        className='space-y-8'
      >
        <div className='space-y-3'>
          <div className='mb-4'>
            <Label className='text-base'>Time format</Label>
            <FormDescription>
              Choose how times are shown across the app — in 12-hour form
              with am/pm or 24-hour form. Time inputs themselves stay the
              same either way.
            </FormDescription>
          </div>
          <RadioGroup
            value={timeFormat}
            onValueChange={(value) => setTimeFormat(value as TimeFormat)}
            className='gap-2'
          >
            <Label className='flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal'>
              <RadioGroupItem value='12h' />
              12-hour (e.g. 3:30 pm)
            </Label>
            <Label className='flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal'>
              <RadioGroupItem value='24h' />
              24-hour (e.g. 15:30)
            </Label>
          </RadioGroup>
        </div>

        <FormField
          control={form.control}
          name='items'
          render={() => (
            <FormItem>
              <div className='mb-4'>
                <FormLabel className='text-base'>Sidebar</FormLabel>
                <FormDescription>
                  Select the items you want to display in the sidebar.
                </FormDescription>
              </div>
              {items.map((item) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name='items'
                  render={({ field }) => {
                    return (
                      <FormItem
                        key={item.id}
                        className='flex flex-row items-start'
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, item.id])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== item.id
                                    )
                                  )
                            }}
                          />
                        </FormControl>
                        <FormLabel className='font-normal'>
                          {item.label}
                        </FormLabel>
                      </FormItem>
                    )
                  }}
                />
              ))}
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit'>Update display</Button>
      </form>
    </Form>
  )
}
