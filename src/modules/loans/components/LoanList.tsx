import Stack from '@mui/material/Stack';
import { EmptyState } from '@/modules/common/components/EmptyState';
import { Loading } from '@/modules/common/components/Loading';
import type { LoanView } from '../dto/loan.dto';
import { LoanCard } from './LoanCard';

interface LoanListProps {
  loans: LoanView[] | undefined;
  emptyMessage: string;
  readOnly?: boolean;
}

export function LoanList({ loans, emptyMessage, readOnly }: LoanListProps) {
  if (loans === undefined) return <Loading />;
  if (loans.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <Stack spacing={2}>
      {loans.map((loan) => (
        <LoanCard key={loan._id} loan={loan} readOnly={readOnly} />
      ))}
    </Stack>
  );
}
