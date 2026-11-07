import knex from 'knex'
export function createDatabase(url: string) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'mysql:') throw new Error('MySQL is required')
  return knex({
    client: 'mysql2',
    connection: {
      host: parsed.hostname, port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password),
      database: decodeURIComponent(parsed.pathname.slice(1)), charset: 'utf8mb4',
      timezone: 'Z', dateStrings: true, decimalNumbers: false,
      connectTimeout: 3000, multipleStatements: false,
      ...(parsed.searchParams.get('ssl') === 'true' ? { ssl: { rejectUnauthorized: true } } : {})
    },
    pool: { min: 0, max: 10, afterCreate(connection: { query: (sql: string, done: (error: Error | null) => void) => void }, done: (error: Error | null, connection: unknown) => void) {
      connection.query("SET time_zone = '+00:00'", error => done(error, connection))
    } },
    acquireConnectionTimeout: 4000
  })
}

