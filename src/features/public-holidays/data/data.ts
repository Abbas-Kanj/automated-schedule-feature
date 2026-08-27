// The Fixed column stores a boolean but filters as a string pair, so the
// faceted filter and the column's `accessorFn` share this vocabulary.
export const FIXED_OPTIONS = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
] as const

export function getFixedLabel(fixed: boolean): string {
  return fixed ? 'Yes' : 'No'
}
