type SelectStyleSet = {
  control: {
    base: string
    focus: string
    nonFocus: string
  }
  placeholder: string
  input: string
  valueContainer: string
  singleValue: string
  multiValue: string
  multiValueLabel: string
  multiValueRemove: string
  indicatorsContainer: string
  clearIndicator: string
  indicatorSeparator: string
  dropdownIndicator: string
  menu: string
  option: string
  groupHeading: string
  noOptionsMessage: string
}

export const VARIANT_STYLES: Record<string, SelectStyleSet> = {
  default: {
    control: {
      base: 'border border-border rounded-lg bg-background hover:cursor-pointer hover:bg-secondary',
      focus: 'border-border ring-ring ring-primary-500',
      nonFocus: 'border-border',
    },

    placeholder: 'text-muted-foreground text-sm ml-1',
    input: 'text-foreground text-sm ml-1',
    valueContainer: 'text-foreground text-sm flex-wrap min-w-0',
    singleValue: 'ml-1 truncate max-w-full',

    multiValue:
      'ml-1 bg-background border border-border/60 rounded-md items-center py-0.5 pl-2 pr-2 gap-1.5 min-w-full',

    multiValueLabel: 'leading-6 py-0.5 truncate min-w-0',

    multiValueRemove:
      'flex-shrink-0 border border-border/40 bg-background hover:bg-red-50 hover:text-red-800 text-muted-foreground hover:border-red-300 rounded-md',

    indicatorsContainer: 'p-1 gap-1 bg-background rounded-lg',
    clearIndicator: 'text-gray-500 p-1 rounded-md hover:text-red-800',

    indicatorSeparator: 'bg-border/50',
    dropdownIndicator: 'p-1 hover:text-foreground text-gray-500',

    menu: 'mt-2 p-2 border border-border bg-background text-sm rounded-lg',

    groupHeading: 'ml-3 mt-2 mb-1 text-muted-foreground text-sm bg-background',

    noOptionsMessage: 'text-muted-foreground bg-background',

    option:
      'bg-background p-2 border-0 text-base hover:bg-secondary hover:cursor-pointer',
  },

  compact: {
    control: {
      base: 'border border-border rounded-sm bg-background hover:cursor-pointer hover:bg-accent/50 transition-colors min-h-[22px]',
      focus: 'border-primary ring-1 ring-primary/20',
      nonFocus: 'border-border',
    },

    placeholder: 'text-muted-foreground text-xs ml-0',
    input: 'text-foreground text-xs ml-0',
    valueContainer: 'text-foreground text-xs flex-wrap min-w-0 py-0 px-1.5',
    singleValue: 'ml-0 truncate max-w-full',

    multiValue:
      'ml-0.5 bg-background border border-border/60 rounded-sm items-center py-0 pl-1.5 pr-1 gap-1 min-w-full',

    multiValueLabel: 'leading-5 py-0 text-xs truncate min-w-0',

    multiValueRemove:
      'flex-shrink-0 border border-border/40 bg-background hover:bg-destructive/10 hover:text-destructive text-muted-foreground hover:border-destructive/30 rounded-sm text-xs',

    indicatorsContainer: 'pr-1 gap-0 bg-transparent',
    clearIndicator:
      'text-muted-foreground p-0 rounded-sm hover:text-destructive hover:bg-transparent',

    indicatorSeparator: 'hidden',
    dropdownIndicator:
      'p-0 hover:text-foreground text-muted-foreground transition-colors [&>svg]:size-3.5',

    menu: 'mt-1 p-1 border border-border bg-popover text-xs rounded-md shadow-md',

    groupHeading:
      'ml-2 mt-1.5 mb-0.5 text-muted-foreground text-xs bg-transparent font-medium',

    noOptionsMessage:
      'text-muted-foreground bg-transparent px-2 py-1.5 text-xs',

    option:
      'bg-transparent px-2 py-1.5 border-0 text-xs hover:bg-accent rounded-sm hover:cursor-pointer transition-colors',
  },
} as const
export type Variant = keyof typeof VARIANT_STYLES

export const COMPACT_HEIGHT_STYLES = {
  control: (base: object) => ({ ...base, minHeight: '24px', height: '24px' }),
  valueContainer: (base: object) => ({
    ...base,
    height: '24px',
    padding: '0 6px',
  }),
  input: (base: object) => ({ ...base, margin: '0', padding: '2px' }),
  indicatorsContainer: (base: object) => ({ ...base, height: '24px' }),
  menu: (base: object) => ({ ...base, width: 'max-content', minWidth: '100%' }),
  menuList: (base: object) => ({ ...base, padding: '0' }),
}
