import { describe, expect, it } from 'vitest'
import { plural } from './plural'

describe('plural', () => {
  it('leaves a count of one singular', () => {
    expect(plural(1, 'crew')).toBe('1 crew')
  })

  it('adds an s to everything else, zero included', () => {
    expect(plural(0, 'crew')).toBe('0 crews')
    expect(plural(2, 'crew')).toBe('2 crews')
    expect(plural(14, 'cycle day')).toBe('14 cycle days')
  })
})
