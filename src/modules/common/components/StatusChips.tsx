import Chip from '@mui/material/Chip';
import VerifiedIcon from '@mui/icons-material/Verified';
import type { LoanStatus } from '@convex/lib/constants';
import { LOAN_STATUS_LABELS } from '../utils/labels';

const LOAN_COLORS: Record<
  LoanStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  pending: 'warning',
  approved: 'primary',
  declined: 'default',
  cancelled: 'default',
  returned: 'success',
};

export function LoanStatusChip({
  status,
  isOverdue,
}: {
  status: LoanStatus;
  isOverdue?: boolean;
}) {
  if (isOverdue) return <Chip size="small" color="error" label="Overdue" />;
  return (
    <Chip
      size="small"
      color={LOAN_COLORS[status]}
      label={LOAN_STATUS_LABELS[status]}
    />
  );
}

export function AvailabilityChip({
  availability,
}: {
  availability: 'available' | 'on_loan';
}) {
  return availability === 'available' ? (
    <Chip size="small" color="success" variant="outlined" label="Available" />
  ) : (
    <Chip size="small" color="warning" variant="outlined" label="On loan" />
  );
}

export function TrustedLenderBadge() {
  return (
    <Chip
      size="small"
      color="primary"
      variant="outlined"
      icon={<VerifiedIcon />}
      label="Trusted Lender"
    />
  );
}
