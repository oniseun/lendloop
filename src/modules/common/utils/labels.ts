import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type LoanStatus,
  type ToolCategory,
  type ToolCondition,
} from '@convex/lib/constants';

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  power_tools: 'Power tools',
  hand_tools: 'Hand tools',
  garden: 'Garden',
  kitchen: 'Kitchen',
  camping: 'Camping',
  cleaning: 'Cleaning',
  other: 'Other',
};

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  new: 'New',
  good: 'Good',
  fair: 'Fair',
  worn: 'Worn',
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

export const categoryOptions = TOOL_CATEGORIES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

export const conditionOptions = TOOL_CONDITIONS.map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));
