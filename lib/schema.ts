import z from 'zod';

export const UserSchema = z.object({
  name: z.string(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  social: z
    .object({
      github: z.string().optional(),
    })
    .optional(),
});
