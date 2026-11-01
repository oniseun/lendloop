import { ConvexError } from 'convex/values';
import type { AppErrorData } from '@convex/lib/errors';

export const getErrorMessage = (error: unknown) => {
  if (error instanceof ConvexError) {
    const data = error.data as Partial<AppErrorData>;
    if (data?.message) return data.message;
  }
  return 'Something went wrong. Please try again.';
};
