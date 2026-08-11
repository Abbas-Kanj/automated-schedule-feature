import { FormItem, FormLabel } from '@/components/ui/form'
import { MultiSelect } from '@/components/multi-select'
import { REGULAR_TYPE_OPTIONS } from '../../data/data'
import { type RegularType } from '../../data/schema'

type ScheduleTypeSelectorProps = {
  value: RegularType | undefined
  onChange: (value: RegularType) => void
  disabled?: boolean
}

export function ScheduleTypeSelector({
  value,
  onChange,
  disabled,
}: ScheduleTypeSelectorProps) {
  const selected = REGULAR_TYPE_OPTIONS.find((o) => o.value === value)

  return (
    <FormItem>
      <FormLabel>Type</FormLabel>
      <MultiSelect
        options={REGULAR_TYPE_OPTIONS}
        value={selected ?? null}
        onChange={(opt: { value: RegularType } | null) =>
          opt && onChange(opt.value)
        }
        isDisabled={disabled}
        isClearable={false}
        placeholder='Select a type'
      />
      {selected && (
        <p className='text-sm text-muted-foreground'>{selected.description}</p>
      )}
    </FormItem>
  )
}
