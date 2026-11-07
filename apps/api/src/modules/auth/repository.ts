import type { Knex } from 'knex'
import type { SafeUser } from '@digituck/contracts'
export interface UserRow { id: string; full_name: string; normalized_email: string; normalized_phone: string; password_hash: string; role: SafeUser['role']; status: string; auth_version: number }
export const findUser = (db: Knex, id: string): Promise<UserRow | undefined> => db<UserRow>('users').where({ id }).first()
export const findByEmail = (db: Knex, email: string): Promise<UserRow | undefined> => db<UserRow>('users').where({ normalized_email: email }).first()
export const safeUser = (row: UserRow): SafeUser => ({ id: row.id, fullName: row.full_name, email: row.normalized_email, phone: row.normalized_phone, role: row.role })

