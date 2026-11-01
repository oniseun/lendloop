'use client';

import { useMutation, useQuery } from 'convex/react';
import type { ToolCategory } from '@convex/lib/constants';
import { toolApi } from '../api/tool.api';

export const usePublicTools = () => useQuery(toolApi.listPublic, {});

export const useBoardTools = (category: ToolCategory | null) =>
  useQuery(toolApi.list, category ? { category } : {});

export const useMyTools = () => useQuery(toolApi.mine, {});

export const useToolMutations = () => ({
  createTool: useMutation(toolApi.create),
  updateTool: useMutation(toolApi.update),
  removeTool: useMutation(toolApi.remove),
});
