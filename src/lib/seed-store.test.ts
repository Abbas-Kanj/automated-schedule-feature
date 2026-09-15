import { z } from 'zod'
import { beforeEach, describe, expect, it } from 'vitest'
import { readSeeded, SEED_VERSION, writeSeeded } from './seed-store'

const KEY = 'seed-store-test'
const STAMP = `${KEY}:seed`
const schema = z.array(z.string())
const defaults = ['a', 'b']

describe('readSeeded', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(STAMP)
  })

  it('seeds and persists defaults when nothing is stored', () => {
    expect(readSeeded(KEY, schema, defaults)).toEqual(defaults)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(defaults)
    expect(localStorage.getItem(STAMP)).toBe(SEED_VERSION)
  })

  it('returns stored records stamped with the current version', () => {
    writeSeeded(KEY, ['x'])
    expect(readSeeded(KEY, schema, defaults)).toEqual(['x'])
  })

  it('re-seeds records stamped with an older version', () => {
    localStorage.setItem(KEY, JSON.stringify(['x']))
    localStorage.setItem(STAMP, 'older')
    expect(readSeeded(KEY, schema, defaults)).toEqual(defaults)
    expect(localStorage.getItem(STAMP)).toBe(SEED_VERSION)
  })

  it('re-seeds unstamped records', () => {
    localStorage.setItem(KEY, JSON.stringify(['x']))
    expect(readSeeded(KEY, schema, defaults)).toEqual(defaults)
  })

  it('re-seeds when the stamp is current but the records are missing', () => {
    localStorage.setItem(STAMP, SEED_VERSION)
    expect(readSeeded(KEY, schema, defaults)).toEqual(defaults)
  })

  it('re-seeds records that are not valid JSON', () => {
    localStorage.setItem(KEY, '{not json')
    localStorage.setItem(STAMP, SEED_VERSION)
    expect(readSeeded(KEY, schema, defaults)).toEqual(defaults)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(defaults)
  })

  it('re-seeds records that no longer match the schema', () => {
    localStorage.setItem(KEY, JSON.stringify([1, 2]))
    localStorage.setItem(STAMP, SEED_VERSION)
    expect(readSeeded(KEY, schema, defaults)).toEqual(defaults)
  })
})
