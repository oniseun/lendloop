export const TOOL_CATEGORIES = [
  'power_tools',
  'hand_tools',
  'garden',
  'kitchen',
  'camping',
  'cleaning',
  'other',
] as const;

export const TOOL_CONDITIONS = ['new', 'good', 'fair', 'worn'] as const;

export const USER_ROLES = ['admin', 'user'] as const;

export const LOAN_STATUSES = [
  'pending',
  'approved',
  'declined',
  'cancelled',
  'returned',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const TOOL_NAME_MAX = 80;
export const TOOL_DESCRIPTION_MAX = 500;
export const LOAN_MAX_DAYS = 30;
export const LOAN_MESSAGE_MAX = 280;

// Signed requests older than this are rejected (replay window).
export const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

// Outbound webhook retries: 3 attempts total, backoff 30s, 2m.
export const WEBHOOK_MAX_ATTEMPTS = 3;
export const WEBHOOK_BACKOFF_MS = [30_000, 120_000];
