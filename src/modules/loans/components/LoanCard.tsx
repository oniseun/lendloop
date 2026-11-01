'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  LoanStatusChip,
  TrustedLenderBadge,
} from '@/modules/common/components/StatusChips';
import { useRunMutation } from '@/modules/common/hooks/useRunMutation';
import { formatRange } from '@/modules/common/utils/dates';
import type { LoanView } from '../dto/loan.dto';
import { useLoanActions } from '../hooks';
import { AutomationActivity } from './AutomationActivity';

interface LoanCardProps {
  loan: LoanView;
  // Admin view is read-only: admins see everything but act on nothing.
  readOnly?: boolean;
}

export function LoanCard({ loan, readOnly = false }: LoanCardProps) {
  const { approve, decline, cancel, markReturned } = useLoanActions();
  const { run, pending, error } = useRunMutation();

  const counterpart = loan.viewerIsLender
    ? `Requested by ${loan.borrower?.firstName ?? 'a neighbour'}`
    : loan.viewerIsBorrower
      ? `From ${loan.lender?.firstName ?? 'a neighbour'}`
      : `${loan.borrower?.firstName} borrowing from ${loan.lender?.firstName}`;

  const canAct = !readOnly;
  const isPending = loan.status === 'pending';

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'start', gap: 1 }}
        >
          <Typography variant="h3" component="h2">
            {loan.tool?.name ?? 'Removed tool'}
          </Typography>
          <LoanStatusChip status={loan.status} isOverdue={loan.isOverdue} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {formatRange(loan.startDate, loan.endDate)}
        </Typography>
        <Stack direction="row" sx={{ mt: 1, gap: 1, alignItems: 'center' }}>
          <Typography variant="body2">{counterpart}</Typography>
          {loan.viewerIsBorrower && loan.lender?.isTrustedLender && (
            <TrustedLenderBadge />
          )}
        </Stack>
        {loan.message && loan.viewerIsLender && (
          <Typography
            variant="body2"
            sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}
          >
            &ldquo;{loan.message}&rdquo;
          </Typography>
        )}
        <AutomationActivity events={loan.activity} />
        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}
      </CardContent>

      {canAct && (
        <CardActions sx={{ px: 2, pb: 2 }}>
          {loan.viewerIsLender && isPending && (
            <>
              <Button
                variant="contained"
                size="small"
                disabled={pending}
                onClick={() => run(() => approve({ loanId: loan._id }))}
              >
                Approve
              </Button>
              <Button
                size="small"
                disabled={pending}
                onClick={() => run(() => decline({ loanId: loan._id }))}
              >
                Decline
              </Button>
            </>
          )}
          {loan.viewerIsLender && loan.status === 'approved' && (
            <Button
              variant="contained"
              size="small"
              disabled={pending}
              onClick={() => run(() => markReturned({ loanId: loan._id }))}
            >
              Mark returned
            </Button>
          )}
          {loan.viewerIsBorrower && isPending && (
            <Button
              size="small"
              disabled={pending}
              onClick={() => run(() => cancel({ loanId: loan._id }))}
            >
              Cancel request
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
}
