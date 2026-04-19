import { describe, it, expect } from 'vitest'
import { parseTasksFromString } from './tasks.js'

describe('parseTasksFromString', () => {
  it('counts unchecked / checked / capital-X', () => {
    const md = `
- [ ] task A
- [x] task B
- [X] task C
- [ ] task D
`
    expect(parseTasksFromString(md)).toEqual({ total: 4, done: 2 })
  })

  it('treats - (skipped) as not done but counts in total', () => {
    const md = `
- [x] done
- [-] skipped
- [ ] open
`
    expect(parseTasksFromString(md)).toEqual({ total: 3, done: 1 })
  })

  it('handles nested checkboxes', () => {
    const md = `
- [x] root
  - [x] sub 1
  - [ ] sub 2
    - [x] sub-sub
`
    expect(parseTasksFromString(md)).toEqual({ total: 4, done: 3 })
  })

  it('ignores non-checkbox lines', () => {
    const md = `
# Heading
some text
- not a checkbox
- [x] real one
`
    expect(parseTasksFromString(md)).toEqual({ total: 1, done: 1 })
  })

  it('returns 0/0 for empty content', () => {
    expect(parseTasksFromString('')).toEqual({ total: 0, done: 0 })
    expect(parseTasksFromString('# title only')).toEqual({ total: 0, done: 0 })
  })

  it('accepts *, +, - as bullet marker', () => {
    const md = `
- [x] a
* [x] b
+ [ ] c
`
    expect(parseTasksFromString(md)).toEqual({ total: 3, done: 2 })
  })
})
