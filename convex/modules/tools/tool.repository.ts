import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import type { ToolCategory } from '../../lib/constants';

// Data access for the tools table. "Active" means not soft-deleted.

type NewTool = Omit<Doc<'tools'>, '_id' | '_creationTime'>;
type ToolPatch = Partial<Omit<NewTool, 'ownerId'>>;

const isActive = (tool: Doc<'tools'>) => !tool.removedAt;

export const toolRepository = {
  getById: (ctx: QueryCtx, toolId: Id<'tools'>) => ctx.db.get(toolId),

  getActiveById: async (ctx: QueryCtx, toolId: Id<'tools'>) => {
    const tool = await ctx.db.get(toolId);
    return tool && isActive(tool) ? tool : null;
  },

  listActive: async (ctx: QueryCtx, category?: ToolCategory) => {
    const tools = category
      ? await ctx.db
          .query('tools')
          .withIndex('by_category', (q) => q.eq('category', category))
          .order('desc')
          .collect()
      : await ctx.db.query('tools').order('desc').collect();
    return tools.filter(isActive);
  },

  listActiveByOwner: async (ctx: QueryCtx, ownerId: Id<'users'>) => {
    const tools = await ctx.db
      .query('tools')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .order('desc')
      .collect();
    return tools.filter(isActive);
  },

  insert: (ctx: MutationCtx, tool: NewTool) => ctx.db.insert('tools', tool),

  patch: (ctx: MutationCtx, toolId: Id<'tools'>, patch: ToolPatch) =>
    ctx.db.patch(toolId, patch),
};
