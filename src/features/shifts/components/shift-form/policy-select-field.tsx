import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SHIFT_POLICY_DETAILS, SHIFT_POLICY_TYPE_OPTIONS } from '../../data/data'
import { type ShiftPolicyType } from '../../data/schema'

type PolicySelectFieldProps = {
  value: ShiftPolicyType | undefined
  onChange: (value: ShiftPolicyType | undefined) => void
  disabled?: boolean
}

// Policy picker for the "Shift policy" tab — a plain dropdown (matching
// every other enum field on this form) with the selected policy's detail
// sections rendered inline underneath, instead of behind a "View" button
// that opened a side drawer. `PolicyPillField` (the badge + drawer version
// this replaces here) is kept around unused, for reuse elsewhere later.
export function PolicySelectField({
  value,
  onChange,
  disabled,
}: PolicySelectFieldProps) {
  const detail = value ? SHIFT_POLICY_DETAILS[value] : undefined

  return (
    <div className='space-y-3'>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ShiftPolicyType)}
        disabled={disabled}
      >
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='Select a policy' />
        </SelectTrigger>
        <SelectContent>
          {SHIFT_POLICY_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {detail && (
        <div className='space-y-2 rounded-md border p-3'>
          <p className='text-muted-foreground text-sm'>{detail.summary}</p>
          <Accordion type='multiple' defaultValue={['0']}>
            {detail.sections.map((section, i) => (
              <AccordionItem key={section.title} value={String(i)}>
                <AccordionTrigger>{section.title}</AccordionTrigger>
                <AccordionContent className='text-muted-foreground'>
                  {section.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  )
}
