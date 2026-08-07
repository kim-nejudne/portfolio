import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://forme:forme@localhost:5434/forme',
  },
  strict: true,
  verbose: true,
} satisfies Config;
