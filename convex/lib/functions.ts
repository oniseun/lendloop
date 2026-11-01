import {
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import { mutation, query } from '../_generated/server';
import { requireAdmin, requireUser } from './auth';

// Use these instead of the raw query/mutation builders for anything
// behind sign-in. The user is resolved server-side from the Clerk JWT,
// so a client can never pass its own id or role.

export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
);

export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
);

export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ user: await requireAdmin(ctx) })),
);

export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ user: await requireAdmin(ctx) })),
);
