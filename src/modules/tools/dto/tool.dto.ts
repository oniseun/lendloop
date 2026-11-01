import type { FunctionReturnType } from 'convex/server';
import type { toolApi } from '../api/tool.api';
import type { ToolCategory, ToolCondition } from '@convex/lib/constants';

export type BoardTool = FunctionReturnType<typeof toolApi.list>[number];
export type MyTool = FunctionReturnType<typeof toolApi.mine>[number];
export type PublicTool = FunctionReturnType<typeof toolApi.listPublic>[number];

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
