import { type Config } from 'drizzle-kit';

import { env } from '@/env';

export default {
  schema: './src/db/schema/index.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
} satisfies Config;
