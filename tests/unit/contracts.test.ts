import { describe, expect, it } from 'vitest'
import { bootstrapSchema, fromCents, lineTotal, moneySchema, toCents } from '@digituck/contracts'
describe('exact money', () => {
  it('calculates cents without binary floating-point rounding', () => {
    expect(toCents('0.29')).toBe(29)
    expect(lineTotal('0.29', 3)).toBe('0.87')
    expect(fromCents(10)).toBe('0.10')
    expect(lineTotal('999.99', 99)).toBe('98999.01')
  })
  it('rejects precision overflow and invalid quantities', () => {
    for (const value of ['01.00', '1.001', '-1.00', '100000000.00', 'NaN']) expect(moneySchema.safeParse(value).success).toBe(false)
    for (const quantity of [0, -1, 100, 1.5]) expect(() => lineTotal('1.00', quantity)).toThrow()
    expect(() => lineTotal('99999999.99', 2)).toThrow()
  })
})
describe('trusted bootstrap contract', () => {
  const input = { fullName: 'Initial Operator', email: 'ADMIN@example.com', phone: '+27821234567', password: 'a long secret passphrase' }
  it('normalizes email and rejects unknown writable fields', () => {
    expect(bootstrapSchema.parse(input).email).toBe('admin@example.com')
    expect(bootstrapSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(false)
  })
  it('checks bytes as well as character length', () => {
    expect(bootstrapSchema.safeParse({ ...input, password: 'é'.repeat(37) }).success).toBe(false)
    expect(bootstrapSchema.safeParse({ ...input, password: 'short' }).success).toBe(false)
  })
})

