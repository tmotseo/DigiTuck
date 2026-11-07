import type { Knex } from 'knex'
import type { ShopProfile } from '@digituck/contracts'
export interface ShopRow { id: string; owner_id: string; slug: string; name: string; description: string; phone: string; address: string; area: string; timezone: string; hours_json: string | object; is_paused: number; approval_status: string; version: number; review_version: number; suspended_at: string | null; suspension_reason: string | null; rejection_reason: string | null }
export const jsonValue = (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value
export const profile = (row: ShopRow) => ({ name: row.name, description: row.description || '', phone: row.phone, address: row.address, area: row.area, hours: jsonValue(row.hours_json), isPaused: Boolean(row.is_paused) })
export const profileColumns = (input: ShopProfile) => ({ name: input.name, description: input.description, phone: input.phone, address: input.address, area: input.area, hours_json: JSON.stringify(input.hours), is_paused: input.isPaused })
export const ownShop = (db: Knex, owner: string) => db<ShopRow>('shops').where({ owner_id: owner }).first()
export const documentColumns = ['id', 'shop_id', 'submission_version', 'type', 'original_name', 'detected_mime', 'bytes', 'uploaded_at']

