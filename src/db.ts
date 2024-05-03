import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';
import { env } from './env';

const isDev = env.DATABASE_URL.includes('localhost');

export let db: PrismaClient;

if (isDev) {
  db = new PrismaClient();
} else {
  neonConfig.webSocketConstructor = ws;

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);

  db = new PrismaClient({ adapter });
}
