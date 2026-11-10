import { z } from 'zod';

const ServerEnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_ASSETS_BUCKET: z.string().min(1),
  R2_CONTENT_BUCKET: z.string().min(1),
  // A generated 32-byte key, not a human password: guessing has to stay infeasible.
  EDIT_KEY: z.string().min(32),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | undefined;

/** Read lazily so `next build` can collect pages without every secret present. */
export const getServerEnv = (): ServerEnv => {
  if (cached) {
    return cached;
  }
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))];
    throw new Error(`Missing or invalid environment variables: ${names.join(', ')}`);
  }
  cached = parsed.data;
  return cached;
};
