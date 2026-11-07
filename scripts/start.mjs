// Cross-platform production start; dotenv must not switch this back to development.
process.env.NODE_ENV = 'production'
await import('../apps/api/dist/server.js')
