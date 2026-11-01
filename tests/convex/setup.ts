import { convexTest } from 'convex-test';
import { api as apiRef } from '../../convex/_generated/api';
import schema from '../../convex/schema';

export const modules = import.meta.glob('../../convex/**/*.*s');

export const createTest = () => convexTest(schema, modules);
export type TestConvex = ReturnType<typeof createTest>;

export const identity = (key: string, name: string) => ({
  subject: key,
  issuer: 'https://clerk.test',
  tokenIdentifier: `https://clerk.test|${key}`,
  name,
  email: `${key}@example.com`,
  emailVerified: true,
});

// Signs in as `key`, creates the Convex user and returns the client.
export const signIn = async (
  t: TestConvex,
  key: string,
  name: string,
  role: 'user' | 'admin' = 'user',
) => {
  const as = t.withIdentity(identity(key, name));
  const userId = await as.mutation(apiRef.users.store, {});
  if (role === 'admin') {
    await t.run((ctx) => ctx.db.patch(userId, { role: 'admin' }));
  }
  return { as, userId };
};
