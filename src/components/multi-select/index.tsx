import clsx from 'clsx'
import Select, { MenuPosition } from 'react-select'
import makeAnimated from 'react-select/animated'
import CreatableSelect from 'react-select/creatable'
import { COMPACT_HEIGHT_STYLES, Variant, VARIANT_STYLES } from './styles'

type SelectComponentProps = {
  options: any[]
  value?: any
  defaultValue?: any
  onChange?: (value: any) => void
  isMulti?: boolean
  isDisabled?: boolean
  isLoading?: boolean
  createAble?: boolean
  placeholder?: string
  tabIndex?: number
  isClearable?: boolean
  menuPortalTarget?: HTMLElement | null
  menuPosition?: MenuPosition
  onClick?: React.MouseEventHandler
  className?: string
  required?: boolean
  formatOptionLabel?: (option: any) => React.ReactNode
  variant?: Variant
  compactHeight?: boolean
  onCreateOption?: (inputValue: string) => void | Promise<void>
  styles?: object
  menuListClassName?: string
  autoFocus?: boolean
}

const animatedComponents = makeAnimated()

export const MultiSelect = ({
  options,
  value,
  onChange,
  defaultValue,
  isMulti,
  isDisabled,
  isLoading,
  createAble,
  placeholder,
  tabIndex,
  isClearable,
  menuPortalTarget,
  menuPosition,
  onClick,
  className,
  required,
  formatOptionLabel,
  variant = 'default',
  compactHeight = false,
  onCreateOption,
  styles,
  menuListClassName,
  autoFocus,
  ...props
}: SelectComponentProps) => {
  const Comp = createAble ? CreatableSelect : Select
  const s = VARIANT_STYLES[variant]

  return (
    <div onClick={onClick} className={`flex items-center gap-2 ${className}`}>
      <Comp
        className='w-full'
        unstyled
        isSearchable
        tabIndex={tabIndex}
        autoFocus={autoFocus}
        required={required}
        isClearable={isClearable}
        value={value}
        isDisabled={isDisabled}
        isMulti={isMulti}
        isLoading={isLoading}
        placeholder={placeholder}
        components={animatedComponents}
        defaultInputValue={defaultValue}
        defaultValue={value}
        options={options}
        noOptionsMessage={() => 'No data found !!'}
        onChange={onChange}
        onCreateOption={onCreateOption}
        formatOptionLabel={formatOptionLabel ?? ((option: any) => option.label)}
        menuPortalTarget={menuPortalTarget}
        menuPosition={menuPosition}
        styles={{
          ...(compactHeight ? COMPACT_HEIGHT_STYLES : {}),
          ...(variant === 'compact'
            ? {
                singleValue: (base: object) => ({
                  ...base,
                  marginLeft: '4px',
                }),
              }
            : {}),
          ...styles,
        }}
        classNames={{
          control: ({ isFocused }) =>
            clsx(
              s.control.base,
              isFocused ? s.control.focus : s.control.nonFocus
            ),

          placeholder: () => s.placeholder,
          input: () => s.input,
          valueContainer: () => s.valueContainer,
          singleValue: () => s.singleValue,

          // ✅ UPDATED: ensure consistent border theme in multi tags
          multiValue: () => s.multiValue,
          multiValueLabel: () => s.multiValueLabel,
          multiValueRemove: () => s.multiValueRemove,

          indicatorsContainer: () => s.indicatorsContainer,
          clearIndicator: () => s.clearIndicator,
          indicatorSeparator: () => s.indicatorSeparator,
          dropdownIndicator: () => s.dropdownIndicator,

          menu: () => s.menu,
          groupHeading: () => s?.groupHeading,
          noOptionsMessage: () => s?.noOptionsMessage,

          option: ({ data, isDisabled }: { data: any; isDisabled: boolean }) =>
            clsx(
              s.option,
              data?.type === 'button' &&
                'text-primary underline-offset-4 hover:underline',
              isDisabled && 'cursor-not-allowed opacity-40'
            ),
        }}
        {...props}
      />
    </div>
  )
}
