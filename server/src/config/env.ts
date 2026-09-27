import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SEED_ADMIN_NAME: z.string().default('Super Admin'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@resort360.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@123456'),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    // Zod v4 uses .issues
    const issues = result.error.issues ?? [];
    issues.forEach((e) => {
      const path = e.path.map(String).join('.');
      console.error(`  - ${path}: ${e.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export type Env = z.infer<typeof envSchema>;
