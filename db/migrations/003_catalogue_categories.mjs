// Real catalogue defaults, independent of optional demo accounts/data.
export async function up(knex) {
  await knex('categories').insert([
    { id: 'ca000000-0000-4000-8000-000000000001', name: 'Food', slug: 'food' },
    { id: 'ca000000-0000-4000-8000-000000000002', name: 'Drinks', slug: 'drinks' },
    { id: 'ca000000-0000-4000-8000-000000000003', name: 'Groceries', slug: 'groceries' },
    { id: 'ca000000-0000-4000-8000-000000000004', name: 'Other', slug: 'other' }
  ]).onConflict('slug').ignore()
}
export async function down() { /* Preserve categories referenced by products. */ }
