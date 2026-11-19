import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load server/.env first, then fall back to a repo-root .env.
dotenv.config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')], quiet: true } as dotenv.DotenvConfigOptions);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (see server/.env.example)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse({
  ...process.env,
  // Tests inject their own in-memory URI/secret.
  ...(process.env.NODE_ENV === 'test'
    ? {
        MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://placeholder',
        JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret!!',
      }
    : {}),
});

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
