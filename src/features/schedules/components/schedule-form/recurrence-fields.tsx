import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecurrenceEndFields } from './recurrence-end-fields'
import { RecurrenceFrequencyFields } from './recurrence-frequency-fields'

const DEFAULT_RECURRENCE = {
  frequency: 'daily' as const,
  interval: 1,
  weekdays: [],
  end_type: 'never' as const,
  exceptions: { public_holiday: false, sick_leave: false },
}

type RecurrenceFieldsProps = {
  disabled?: boolean
}

export function RecurrenceFields({ disabled }: RecurrenceFieldsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, getValues, setValue } = useFormContext<any>()
  const recurrence = useWatch({ control, name: 'recurrence' })

  useEffect(() => {
    if (!getValues('recurrence')) {
      setValue('recurrence', DEFAULT_RECURRENCE)
    }
  }, [])

  if (!recurrence) return null

  return (
    <div className='space-y-4'>
      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-sm font-medium'>
            Frequency settings
          </CardTitle>
        </CardHeader>
        <CardContent className='px-4'>
          <RecurrenceFrequencyFields disabled={disabled} />
        </CardContent>
      </Card>

      <Card className='gap-3 py-4'>
        <CardHeader className='px-4'>
          <CardTitle className='text-sm font-medium'>
            End &amp; exception settings
          </CardTitle>
        </CardHeader>
        <CardContent className='px-4'>
          <RecurrenceEndFields disabled={disabled} />
        </CardContent>
      </Card>
    </div>
  )
}
