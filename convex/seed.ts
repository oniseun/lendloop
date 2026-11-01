import type { Id } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import { toIsoDate } from './lib/dates';
import { createLogger } from './lib/logger';

const logger = createLogger('seed');
const DAY_MS = 24 * 60 * 60 * 1000;

// Demo neighbours. They can't sign in (no Clerk account behind them);
// they exist so the board isn't empty and the overdue workflow has
// something to do. Sign in yourself to lend and borrow against them.
const USERS = [
  { key: 'amara', name: 'Amara Okafor', trusted: true },
  { key: 'tom', name: 'Tom Hughes', trusted: false },
  { key: 'priya', name: 'Priya Shah', trusted: false },
] as const;

const TOOLS = [
  {
    owner: 'amara',
    name: 'Cordless drill (18V)',
    category: 'power_tools',
    condition: 'good',
    description: 'Two batteries and a basic bit set.',
  },
  {
    owner: 'amara',
    name: 'Hedge trimmer',
    category: 'garden',
    condition: 'fair',
    description: 'Electric, 10m cable. Bring your own extension lead.',
  },
  {
    owner: 'tom',
    name: 'Pressure washer',
    category: 'cleaning',
    condition: 'good',
    description: 'Patio and car attachments included.',
  },
  {
    owner: 'tom',
    name: '4-person tent',
    category: 'camping',
    condition: 'worn',
    description: 'Dry and complete. One pole has tape on it but holds fine.',
  },
  {
    owner: 'priya',
    name: 'Stand mixer',
    category: 'kitchen',
    condition: 'new',
    description: 'Dough hook, whisk and paddle.',
  },
  {
    owner: 'priya',
    name: 'Socket set',
    category: 'hand_tools',
    condition: 'good',
    description: 'Metric, 1/4" and 3/8" drive.',
  },
  {
    owner: 'tom',
    name: 'Lawn aerator',
    category: 'garden',
    condition: 'good',
    description: 'Manual, foot-operated.',
  },
] as const;

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', 'seed|amara'))
      .unique();
    if (existing) {
      logger.info('already seeded');
      return { seeded: false };
    }

    const userIds: Record<string, Id<'users'>> = {};
    for (const user of USERS) {
      userIds[user.key] = await ctx.db.insert('users', {
        tokenIdentifier: `seed|${user.key}`,
        name: user.name,
        email: `${user.key}@example.com`,
        role: 'user',
        isTrustedLender: user.trusted,
      });
    }

    const toolIds: Id<'tools'>[] = [];
    for (const { owner, ...tool } of TOOLS) {
      toolIds.push(
        await ctx.db.insert('tools', { ...tool, ownerId: userIds[owner] }),
      );
    }

    const day = (offset: number) =>
      toIsoDate(new Date(Date.now() + offset * DAY_MS));
    const now = Date.now();

    // Overdue: drill, Tom borrowed it, due 3 days ago.
    await ctx.db.insert('loans', {
      toolId: toolIds[0],
      lenderId: userIds.amara,
      borrowerId: userIds.tom,
      startDate: day(-7),
      endDate: day(-3),
      status: 'approved',
      decidedAt: now,
    });
    // On loan, not yet due: pressure washer, Priya has it.
    await ctx.db.insert('loans', {
      toolId: toolIds[2],
      lenderId: userIds.tom,
      borrowerId: userIds.priya,
      startDate: day(-1),
      endDate: day(2),
      status: 'approved',
      decidedAt: now,
    });
    // Pending: Amara wants the tent next weekend.
    await ctx.db.insert('loans', {
      toolId: toolIds[3],
      lenderId: userIds.tom,
      borrowerId: userIds.amara,
      startDate: day(5),
      endDate: day(7),
      status: 'pending',
      message: 'For a weekend in the Lakes, back Sunday night.',
    });
    // Returned.
    await ctx.db.insert('loans', {
      toolId: toolIds[4],
      lenderId: userIds.priya,
      borrowerId: userIds.tom,
      startDate: day(-14),
      endDate: day(-12),
      status: 'returned',
      decidedAt: now,
      returnedAt: now,
    });

    logger.info('seeded', { users: USERS.length, tools: TOOLS.length });
    return { seeded: true };
  },
});
