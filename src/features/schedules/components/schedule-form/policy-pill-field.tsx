import { XIcon } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SelectDropdown } from '@/components/select-dropdown'
import { POLICY_DETAILS, POLICY_TYPE_OPTIONS } from '../../data/data'
import { type PolicyType } from '../../data/schema'

type PolicyPillFieldProps = {
  value: PolicyType | undefined
  onChange: (value: PolicyType | undefined) => void
  disabled?: boolean
}

export function PolicyPillField({
  value,
  onChange,
  disabled,
}: PolicyPillFieldProps) {
  const selected = POLICY_TYPE_OPTIONS.find((o) => o.value === value)

  if (!selected) {
    return (
      <SelectDropdown
        isControlled
        defaultValue={value}
        onValueChange={(v) => onChange(v as PolicyType)}
        placeholder='Select a policy'
        items={POLICY_TYPE_OPTIONS}
        disabled={disabled}
      />
    )
  }

  const detail = POLICY_DETAILS[selected.value]

  return (
    <div className='flex items-center gap-2'>
      <Badge variant='secondary' className='gap-1.5 py-1.5 ps-3 pe-1.5'>
        {selected.label}
        {!disabled && (
          <button
            type='button'
            onClick={() => onChange(undefined)}
            className='rounded-full hover:bg-black/10 dark:hover:bg-white/10'
          >
            <XIcon className='size-3.5' />
          </button>
        )}
      </Badge>
      <Sheet>
        <SheetTrigger asChild>
          <Button type='button' variant='outline' size='sm' disabled={disabled}>
            View
          </Button>
        </SheetTrigger>
        <SheetContent side='right' className='sm:max-w-md'>
          <SheetHeader>
            <SheetTitle>{selected.label} policy</SheetTitle>
            <SheetDescription>{detail.summary}</SheetDescription>
          </SheetHeader>
          <div className='overflow-y-auto px-4 pb-4'>
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
        </SheetContent>
      </Sheet>
    </div>
  )
}
