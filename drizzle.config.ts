import { type Config } from 'drizzle-kit';

import { env } from '@/env';

export default {
  schema: './src/db/schema/index.ts',
  driver: 'mysql2',
  dbCredentials: {
    uri: env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
} satisfies Config;
