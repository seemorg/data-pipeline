import dotenv from 'dotenv';
dotenv.config();

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    TYPESENSE_URL: z.string().url().min(1),
    TYPESENSE_API_KEY: z.string().min(1),
    DATABASE_URL: z.string().url().min(1),
    REPLICATE_API_TOKEN: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_KEY: z.string().min(1),
    R2_ENDPOINT: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    CLOUDFLARE_IMAGES_TOKEN: z.string().min(1),
  },
  client: {},
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    TYPESENSE_URL: process.env.TYPESENSE_URL,
    TYPESENSE_API_KEY: process.env.TYPESENSE_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_KEY: process.env.R2_SECRET_KEY,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_BUCKET: process.env.R2_BUCKET,
    CLOUDFLARE_IMAGES_TOKEN: process.env.CLOUDFLARE_IMAGES_TOKEN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
