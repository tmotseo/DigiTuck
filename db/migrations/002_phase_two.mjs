export const config = { transaction: false }
export async function up(db) {
  await db.schema.alterTable('shops', table => { table.timestamp('suspended_at', { precision: 3 }).nullable(); table.string('suspension_reason', 1000).nullable() })
  await db.schema.createTable('security_locks', table => { table.string('name', 80).primary() })
  await db('security_locks').insert({ name: 'admin-status' })
  // This index lets account and IP buckets expire efficiently even when not blocked.
  await db.schema.alterTable('auth_rate_limits', table => { table.index('window_start', 'ix_rate_window') })
}
export async function down(db) {
  await db.schema.alterTable('auth_rate_limits', table => { table.dropIndex('window_start', 'ix_rate_window') })
  await db.schema.dropTable('security_locks')
  await db.schema.alterTable('shops', table => { table.dropColumn('suspended_at'); table.dropColumn('suspension_reason') })
}
