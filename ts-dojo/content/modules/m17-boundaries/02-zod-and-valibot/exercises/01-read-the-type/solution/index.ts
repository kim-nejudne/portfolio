import { z } from 'zod';

export const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
  email: z.email().optional(),
});

export type User = z.infer<typeof UserSchema>;

/** Greets a user; anything else gets the first issue's message. */
export function greet(input: unknown): string {
  const result = UserSchema.safeParse(input);
  if (!result.success) {
    return `Not a user: ${result.error.issues[0].message}`;
  }
  const user = result.data;
  if (user.email === undefined) {
    return `Hello, ${user.name}`;
  }
  return `Hello, ${user.name} <${user.email}>`;
}
