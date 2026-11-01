import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';

// Data access for the users table. Services never call ctx.db for
// users directly; they go through here.

type NewUser = Omit<Doc<'users'>, '_id' | '_creationTime'>;
type UserPatch = Partial<Omit<NewUser, 'tokenIdentifier'>>;

export const userRepository = {
  getById: (ctx: QueryCtx, userId: Id<'users'>) => ctx.db.get(userId),

  findByToken: (ctx: QueryCtx, tokenIdentifier: string) =>
    ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', tokenIdentifier))
      .unique(),

  findByEmail: (ctx: QueryCtx, email: string) =>
    ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
      .unique(),

  listAll: (ctx: QueryCtx) => ctx.db.query('users').collect(),

  insert: (ctx: MutationCtx, user: NewUser) => ctx.db.insert('users', user),

  patch: (ctx: MutationCtx, userId: Id<'users'>, patch: UserPatch) =>
    ctx.db.patch(userId, patch),
};
