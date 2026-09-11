type Option = { value: string; label: string }

// The create/edit form's only dropdown now that it collects Personal
// information only — the sex options.
export const SEX_OPTIONS: Option[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]
