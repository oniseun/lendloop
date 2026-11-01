import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import type { ToolCategory, ToolCondition } from '@convex/lib/constants';

export type BoardTool = FunctionReturnType<typeof api.tools.list>[number];
export type MyTool = FunctionReturnType<typeof api.tools.mine>[number];
export type PublicTool = FunctionReturnType<
  typeof api.tools.listPublic
>[number];

export interface ToolFormValues {
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
}

export const emptyToolForm: ToolFormValues = {
  name: '',
  category: 'power_tools',
  condition: 'good',
  description: '',
};
