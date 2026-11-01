import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { ToolCategory } from '../../lib/constants';
import { todayIso } from '../../lib/dates';
import { appError, ErrorCode } from '../../lib/errors';
import { createLogger } from '../../lib/logger';
import {
  canEditTool,
  canRemoveTool,
  isAdmin,
  type Actor,
} from '../../lib/permissions';
import { loanRepository } from '../loans/loan.repository';
import { availabilityFor, hasPendingRequestFrom } from '../loans/loan.rules';
import { declinePendingRequests } from '../loans/loan.service';
import { userRepository } from '../users/user.repository';
import {
  cleanToolInput,
  toBoardToolDto,
  toMyToolDto,
  toPublicToolDto,
  type ToolInput,
} from './tool.dto';
import { toolRepository } from './tool.repository';

const logger = createLogger('tools');

const requireActiveTool = async (ctx: QueryCtx, toolId: Id<'tools'>) => {
  const tool = await toolRepository.getActiveById(ctx, toolId);
  if (!tool) throw appError(ErrorCode.TOOL_NOT_FOUND, 'Tool not found');
  return tool;
};

export const listPublicTools = async (ctx: QueryCtx) =>
  (await toolRepository.listActive(ctx)).map(toPublicToolDto);

export const listBoardTools = async (
  ctx: QueryCtx,
  actor: Actor,
  category?: ToolCategory,
) => {
  const today = todayIso();
  const tools = await toolRepository.listActive(ctx, category);
  return Promise.all(
    tools.map(async (tool) => {
      const [owner, loans] = await Promise.all([
        userRepository.getById(ctx, tool.ownerId),
        loanRepository.listByTool(ctx, tool._id),
      ]);
      return toBoardToolDto({
        tool,
        owner,
        availability: availabilityFor(loans, today),
        viewerId: actor._id,
        hasMyPendingRequest: hasPendingRequestFrom(loans, actor._id),
      });
    }),
  );
};

export const listOwnTools = async (ctx: QueryCtx, actor: Actor) => {
  const today = todayIso();
  const tools = await toolRepository.listActiveByOwner(ctx, actor._id);
  return Promise.all(
    tools.map(async (tool) => {
      const loans = await loanRepository.listByTool(ctx, tool._id);
      return toMyToolDto({
        tool,
        availability: availabilityFor(loans, today),
        pendingRequests: loans.filter((loan) => loan.status === 'pending')
          .length,
      });
    }),
  );
};

export const createTool = async (
  ctx: MutationCtx,
  actor: Actor,
  input: ToolInput,
) => {
  const toolId = await toolRepository.insert(ctx, {
    ...cleanToolInput(input),
    ownerId: actor._id,
  });
  logger.info('tool created', { toolId, userId: actor._id });
  return toolId;
};

export const updateTool = async (
  ctx: MutationCtx,
  actor: Actor,
  toolId: Id<'tools'>,
  input: ToolInput,
) => {
  const tool = await requireActiveTool(ctx, toolId);
  if (!canEditTool(actor, tool)) {
    logger.warn('edit denied', { toolId, userId: actor._id });
    throw appError(ErrorCode.FORBIDDEN, 'You can only edit your own tools');
  }
  await toolRepository.patch(ctx, toolId, cleanToolInput(input));
  logger.info('tool updated', { toolId, userId: actor._id });
};

// Owners delete their own listings; admins can remove any listing.
// Soft delete so loan history and audit trail stay intact.
export const removeTool = async (
  ctx: MutationCtx,
  actor: Actor,
  toolId: Id<'tools'>,
) => {
  const tool = await requireActiveTool(ctx, toolId);
  if (!canRemoveTool(actor, tool)) {
    logger.warn('remove denied', { toolId, userId: actor._id });
    throw appError(ErrorCode.FORBIDDEN, 'You can only remove your own tools');
  }

  const loans = await loanRepository.listByTool(ctx, toolId);
  const isOwner = tool.ownerId === actor._id;
  const hasActiveLoan = loans.some((loan) => loan.status === 'approved');
  // An owner can't pull a listing that is out on loan. An admin can
  // (moderation), and the active loan stays so it can be returned.
  if (hasActiveLoan && isOwner && !isAdmin(actor)) {
    throw appError(
      ErrorCode.TOOL_HAS_ACTIVE_LOAN,
      'Mark the current loan as returned first',
    );
  }

  await toolRepository.patch(ctx, toolId, {
    removedAt: Date.now(),
    removedBy: actor._id,
  });
  await declinePendingRequests(ctx, loans);
  logger.info('tool removed', {
    toolId,
    userId: actor._id,
    byAdmin: !isOwner,
  });
};

export const countActiveListings = async (
  ctx: QueryCtx,
  ownerId: Id<'users'>,
) => (await toolRepository.listActiveByOwner(ctx, ownerId)).length;
