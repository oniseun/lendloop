import { ConvexError } from 'convex/values';

// Stable, uppercase codes so the UI (and tests) can branch on them
// without parsing messages.
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_HAS_ACTIVE_LOAN: 'TOOL_HAS_ACTIVE_LOAN',
  LOAN_NOT_FOUND: 'LOAN_NOT_FOUND',
  INVALID_LOAN_TRANSITION: 'INVALID_LOAN_TRANSITION',
  DATES_UNAVAILABLE: 'DATES_UNAVAILABLE',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type AppErrorData = {
  code: ErrorCode;
  message: string;
};

export const appError = (code: ErrorCode, message: string) =>
  new ConvexError<AppErrorData>({ code, message });
