import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { query } from './_generated/server';
import { TOOL_DESCRIPTION_MAX, TOOL_NAME_MAX } from './lib/constants';
import { todayIso } from './lib/dates';
import { appError, ErrorCode } from './lib/errors';
import { userMutation, userQuery } from './lib/functions';
import { createLogger } from './lib/logger';
import { canEditTool, canRemoveTool, isAdmin } from './lib/permissions';
import { cleanText, firstName } from './lib/text';
import { categoryValidator, conditionValidator } from './lib/validators';
import { availabilityFor } from './model/availability';
import { loansForTool, setLoanStatus } from './model/loans';

const logger = createLogger('tools');

const toolFields = {
  name: v.string(),
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
};

const cleanToolInput = (input: { name: string; description: string }) => ({
  name: cleanText(input.name, { field: 'Name', min: 2, max: TOOL_NAME_MAX }),
  description: cleanText(input.description, {
    field: 'Description',
    max: TOOL_DESCRIPTION_MAX,
  }),
});

// Public, no sign-in. Name and category only: nothing about the owner.
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db.query('tools').order('desc').collect();
    return tools
      .filter((tool) => !tool.removedAt)
      .map((tool) => ({
        _id: tool._id,
        name: tool.name,
        category: tool.category,
      }));
  },
});

export const list = userQuery({
  args: { category: v.optional(categoryValidator) },
  handler: async (ctx, { category }) => {
    const today = todayIso();
    const tools = category
      ? await ctx.db
          .query('tools')
          .withIndex('by_category', (q) => q.eq('category', category))
          .order('desc')
          .collect()
      : await ctx.db.query('tools').order('desc').collect();

    const visible = tools.filter((tool) => !tool.removedAt);
    return Promise.all(
      visible.map(async (tool) => {
        const [owner, loans] = await Promise.all([
          ctx.db.get(tool.ownerId),
          loansForTool(ctx, tool._id),
        ]);
        const myPending = loans.some(
          (loan) =>
            loan.borrowerId === ctx.user._id && loan.status === 'pending',
        );
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          availability: availabilityFor(loans, today),
          owner: owner
            ? {
                firstName: firstName(owner.name),
                isTrustedLender: owner.isTrustedLender,
              }
            : null,
          isMine: tool.ownerId === ctx.user._id,
          hasMyPendingRequest: myPending,
        };
      }),
    );
  },
});

export const mine = userQuery({
  args: {},
  handler: async (ctx) => {
    const today = todayIso();
    const tools = await ctx.db
      .query('tools')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.user._id))
      .order('desc')
      .collect();
    return Promise.all(
      tools
        .filter((tool) => !tool.removedAt)
        .map(async (tool) => {
          const loans = await loansForTool(ctx, tool._id);
          return {
            _id: tool._id,
            name: tool.name,
            category: tool.category,
            condition: tool.condition,
            description: tool.description,
            availability: availabilityFor(loans, today),
            pendingRequests: loans.filter((loan) => loan.status === 'pending')
              .length,
          };
        }),
    );
  },
});

export const create = userMutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const toolId = await ctx.db.insert('tools', {
      ...args,
      ...cleanToolInput(args),
      ownerId: ctx.user._id,
    });
    logger.info('tool created', { toolId, userId: ctx.user._id });
    return toolId;
  },
});

export const update = userMutation({
  args: { toolId: v.id('tools'), ...toolFields },
  handler: async (ctx, { toolId, ...args }) => {
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt) {
      throw appError(ErrorCode.TOOL_NOT_FOUND, 'Tool not found');
    }
    if (!canEditTool(ctx.user, tool)) {
      logger.warn('edit denied', { toolId, userId: ctx.user._id });
      throw appError(ErrorCode.FORBIDDEN, 'You can only edit your own tools');
    }
    await ctx.db.patch(toolId, { ...args, ...cleanToolInput(args) });
    logger.info('tool updated', { toolId, userId: ctx.user._id });
  },
});

// Owners delete their own listings; admins can remove any listing.
// Soft delete so loan history and audit trail stay intact.
export const remove = userMutation({
  args: { toolId: v.id('tools') },
  handler: async (ctx, { toolId }) => {
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt) {
      throw appError(ErrorCode.TOOL_NOT_FOUND, 'Tool not found');
    }
    if (!canRemoveTool(ctx.user, tool)) {
      logger.warn('remove denied', { toolId, userId: ctx.user._id });
      throw appError(ErrorCode.FORBIDDEN, 'You can only remove your own tools');
    }

    const loans = await loansForTool(ctx, toolId);
    const isOwner = tool.ownerId === ctx.user._id;
    const hasActiveLoan = loans.some((loan) => loan.status === 'approved');
    // An owner can't pull a listing that is out on loan. An admin can
    // (moderation), and the active loan stays so it can be returned.
    if (hasActiveLoan && isOwner && !isAdmin(ctx.user)) {
      throw appError(
        ErrorCode.TOOL_HAS_ACTIVE_LOAN,
        'Mark the current loan as returned first',
      );
    }

    await ctx.db.patch(toolId, {
      removedAt: Date.now(),
      removedBy: ctx.user._id,
    });
    await declinePendingRequests(ctx, loans);
    logger.info('tool removed', {
      toolId,
      userId: ctx.user._id,
      byAdmin: !isOwner,
    });
  },
});

const declinePendingRequests = async (
  ctx: Parameters<typeof setLoanStatus>[0],
  loans: Doc<'loans'>[],
) => {
  for (const loan of loans.filter((item) => item.status === 'pending')) {
    await setLoanStatus(ctx, loan, 'declined');
  }
};
