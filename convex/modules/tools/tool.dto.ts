import { v } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import { TOOL_DESCRIPTION_MAX, TOOL_NAME_MAX } from '../../lib/constants';
import { cleanText } from '../../lib/text';
import { categoryValidator, conditionValidator } from '../../lib/validators';
import type { Availability } from '../loans/loan.rules';
import { toNeighbourDto } from '../users/user.dto';

// Request DTOs (Convex validators + normalisation) and response shapes
// for tools.

export const toolFields = {
  name: v.string(),
  category: categoryValidator,
  condition: conditionValidator,
  description: v.string(),
};

export const listToolsArgs = { category: v.optional(categoryValidator) };
export const toolIdArgs = { toolId: v.id('tools') };
export const updateToolArgs = { toolId: v.id('tools'), ...toolFields };

export type ToolInput = Pick<
  Doc<'tools'>,
  'name' | 'category' | 'condition' | 'description'
>;

// Trims, collapses whitespace and enforces lengths.
export const cleanToolInput = (input: ToolInput): ToolInput => ({
  ...input,
  name: cleanText(input.name, { field: 'Name', min: 2, max: TOOL_NAME_MAX }),
  description: cleanText(input.description, {
    field: 'Description',
    max: TOOL_DESCRIPTION_MAX,
  }),
});

// Public, no sign-in. Name and category only: nothing about the owner.
export const toPublicToolDto = (tool: Doc<'tools'>) => ({
  _id: tool._id,
  name: tool.name,
  category: tool.category,
});

const toToolDetails = (tool: Doc<'tools'>, availability: Availability) => ({
  _id: tool._id,
  name: tool.name,
  category: tool.category,
  condition: tool.condition,
  description: tool.description,
  availability,
});

export const toBoardToolDto = (input: {
  tool: Doc<'tools'>;
  owner: Doc<'users'> | null;
  availability: Availability;
  viewerId: Id<'users'>;
  hasMyPendingRequest: boolean;
}) => ({
  ...toToolDetails(input.tool, input.availability),
  owner: input.owner ? toNeighbourDto(input.owner) : null,
  isMine: input.tool.ownerId === input.viewerId,
  hasMyPendingRequest: input.hasMyPendingRequest,
});

export const toMyToolDto = (input: {
  tool: Doc<'tools'>;
  availability: Availability;
  pendingRequests: number;
}) => ({
  ...toToolDetails(input.tool, input.availability),
  pendingRequests: input.pendingRequests,
});
