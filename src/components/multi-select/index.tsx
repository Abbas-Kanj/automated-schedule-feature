import clsx from 'clsx'
import Select, { type MenuPosition } from 'react-select'
import makeAnimated from 'react-select/animated'
import CreatableSelect from 'react-select/creatable'
import { COMPACT_HEIGHT_STYLES, type Variant, VARIANT_STYLES } from './styles'

// Anything with a label — the default `formatOptionLabel` and the A-Z
// filter both read it. A `type: 'button'` option renders as a link-style row.
export type SelectOption = { label: string; type?: string }

type CommonProps<T extends SelectOption> = {
  options: readonly T[]
  // Pre-fills the search text, not the selection.
  defaultValue?: string
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
  formatOptionLabel?: (option: T) => React.ReactNode
  variant?: Variant
  compactHeight?: boolean
  onCreateOption?: (inputValue: string) => void | Promise<void>
  styles?: object
  menuListClassName?: string
  autoFocus?: boolean
}

// `isMulti` decides the shape of `value` and `onChange`, so the two modes
// are separate prop sets rather than one loose `any`.
type MultiProps<T extends SelectOption> = CommonProps<T> & {
  isMulti: true
  value?: readonly T[]
  onChange?: (value: T[]) => void
}

type SingleProps<T extends SelectOption> = CommonProps<T> & {
  isMulti?: false
  value?: T | null
  onChange?: (value: T | null) => void
}

export type MultiSelectProps<T extends SelectOption> =
  | MultiProps<T>
  | SingleProps<T>

const animatedComponents = makeAnimated()

export function MultiSelect<T extends SelectOption>({
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
}: MultiSelectProps<T>) {
  // react-select's own generics can't follow the isMulti union above, so the
  // boundary is typed once here; callers get the precise types.
  const Comp = (
    createAble ? CreatableSelect : Select
  ) as typeof CreatableSelect<T, boolean>
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
        onChange={onChange as (value: unknown) => void}
        onCreateOption={onCreateOption}
        formatOptionLabel={formatOptionLabel ?? ((option) => option.label)}
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

          multiValue: () => s.multiValue,
          multiValueLabel: () => s.multiValueLabel,
          multiValueRemove: () => s.multiValueRemove,

          indicatorsContainer: () => s.indicatorsContainer,
          clearIndicator: () => s.clearIndicator,
          indicatorSeparator: () => s.indicatorSeparator,
          dropdownIndicator: () => s.dropdownIndicator,

          menu: () => s.menu,
          // Tag the portaled menu so a host (e.g. a Radix Dialog) can tell a
          // click inside the dropdown apart from a real outside-click.
          menuPortal: () => 'multi-select-menu-portal',
          groupHeading: () => s?.groupHeading,
          noOptionsMessage: () => s?.noOptionsMessage,

          option: ({ data, isDisabled }) =>
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
