import { query } from './_generated/server';
import { userMutation, userQuery } from './lib/functions';
import {
  listToolsArgs,
  toolFields,
  toolIdArgs,
  updateToolArgs,
} from './modules/tools/tool.dto';
import {
  createTool,
  listBoardTools,
  listOwnTools,
  listPublicTools,
  removeTool,
  updateTool,
} from './modules/tools/tool.service';

// Controller for tools. Validation via the DTO validators, auth via
// userQuery / userMutation, logic in modules/tools/tool.service.ts.

// Public, no sign-in.
export const listPublic = query({
  args: {},
  handler: (ctx) => listPublicTools(ctx),
});

export const list = userQuery({
  args: listToolsArgs,
  handler: (ctx, { category }) => listBoardTools(ctx, ctx.user, category),
});

export const mine = userQuery({
  args: {},
  handler: (ctx) => listOwnTools(ctx, ctx.user),
});

export const create = userMutation({
  args: toolFields,
  handler: (ctx, args) => createTool(ctx, ctx.user, args),
});

export const update = userMutation({
  args: updateToolArgs,
  handler: (ctx, { toolId, ...input }) =>
    updateTool(ctx, ctx.user, toolId, input),
});

export const remove = userMutation({
  args: toolIdArgs,
  handler: (ctx, { toolId }) => removeTool(ctx, ctx.user, toolId),
});
