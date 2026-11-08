import { z } from 'zod'

export const roles = ['CUSTOMER', 'VENDOR', 'ADMIN'] as const
export const orderStates = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COLLECTED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const
export const roleSchema = z.enum(roles)
export const moneySchema = z.string().regex(/^(0|[1-9]\d{0,7})\.\d{2}$/, 'Use a ZAR decimal string, e.g. 25.00')
export const healthSchema = z.object({ data: z.object({ status: z.enum(['ok', 'ready']), service: z.literal('digituck-api') }), meta: z.object({ requestId: z.uuid() }) })
export type HealthResponse = z.infer<typeof healthSchema>
export type ApiError = { error: { code: string; message: string; fieldErrors: Record<string, string[]>; requestId: string } }

export const bootstrapSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase().max(254),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +27821234567'),
  password: z.string().min(12).refine(value => new TextEncoder().encode(value).length <= 72, 'Password must not exceed 72 UTF-8 bytes')
})
export type BootstrapInput = z.infer<typeof bootstrapSchema>

export function toCents(value: string): number {
  const valid = moneySchema.parse(value)
  const [whole, fraction] = valid.split('.')
  return Number(whole) * 100 + Number(fraction)
}
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 9_999_999_999) throw new RangeError('Amount exceeds DECIMAL(10,2)')
  return Math.floor(cents / 100) + '.' + String(cents % 100).padStart(2, '0')
}
export function lineTotal(price: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new RangeError('Quantity must be 1..99')
  return fromCents(toCents(price) * quantity)
}


export const passwordSchema = bootstrapSchema.shape.password
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email())
export const phoneSchema = z.string().trim().transform(value => value.replace(/[\s()-]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international phone format, e.g. +27821234567'))
export const registrationSchema = z.strictObject({ fullName: z.string().trim().min(2).max(120), email: emailSchema, phone: phoneSchema, password: passwordSchema, role: z.enum(['CUSTOMER', 'VENDOR']) })
export const loginSchema = z.strictObject({ email: emailSchema, password: passwordSchema })
export const accountSchema = registrationSchema.pick({ fullName: true, phone: true })
export const passwordChangeSchema = z.strictObject({ currentPassword: passwordSchema, newPassword: passwordSchema })
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const daySchema = z.strictObject({ day: z.number().int().min(0).max(6), open: timeSchema, close: timeSchema }).refine(value => value.open < value.close, 'Closing time must follow opening time')
export const hoursSchema = z.array(daySchema).max(7).refine(value => new Set(value.map(day => day.day)).size === value.length, 'Use one interval per weekday')
export const profileSchema = z.strictObject({ name: z.string().trim().min(2).max(160), description: z.string().trim().max(2000), phone: phoneSchema, address: z.string().trim().min(5).max(500), area: z.string().trim().min(2).max(120), hours: hoursSchema, isPaused: z.boolean(), expectedVersion: z.number().int().nonnegative() })
export const versionSchema = z.strictObject({ expectedVersion: z.number().int().positive() })
export const decisionSchema = versionSchema.extend({ submissionVersion: z.number().int().positive(), action: z.enum(['APPROVE','REJECT','SUSPEND']), reason: z.string().trim().min(5).max(1000) })
export const userStatusSchema = z.strictObject({ status: z.enum(['ACTIVE','INACTIVE']), reason: z.string().trim().min(5).max(1000) })
export const paginationSchema = z.strictObject({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
export type SafeUser = { id: string; fullName: string; email: string; phone: string; role: typeof roles[number] }
export type ShopProfile = z.infer<typeof profileSchema>

const stockQuantity = z.number().int().min(0).max(1_000_000)
export const productSchema = z.strictObject({
  name: z.string().trim().min(2).max(160), description: z.string().trim().max(2000),
  categoryId: z.uuid(), price: moneySchema.refine(value => toCents(value) > 0, 'Price must be positive'),
  lowStockThreshold: stockQuantity, isVisible: z.boolean()
})
export const createProductSchema = productSchema.extend({ initialQuantity: stockQuantity })
export const editProductSchema = productSchema.extend(versionSchema.shape)
export const stockAdjustmentSchema = versionSchema.extend({
  quantityDelta: z.number().int().min(-1_000_000).max(1_000_000).refine(value => value !== 0, 'Enter a non-zero adjustment'),
  reason: z.string().trim().min(3).max(1000)
})
export type ProductInput = z.infer<typeof productSchema>
export type Product = { id: string; name: string; description: string; categoryId: string; categoryName: string; price: string; availableQuantity: number; lowStockThreshold: number; isVisible: boolean; moderationHidden: boolean; version: number }
export type ProductList = { items: Product[]; total: number; availableUnits: number; page: number; limit: number }
export type Category = { id: string; name: string }
export type PublicShop = { id: string; slug: string; name: string; description: string; area: string; address: string; is_paused: boolean; productCount: number; availableUnits: number }
