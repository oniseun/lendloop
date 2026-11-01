import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { timeAgo } from '@/modules/common/utils/dates';
import type { LoanActivity } from '../dto/loan.dto';

const describe = (event: LoanActivity) => {
  const what = event.kind === 'overdue_reminder' ? 'Reminder' : 'Notification';
  if (event.status === 'queued') return `${what} queued`;
  if (event.status === 'failed') return `${what} failed`;
  return `${what} sent`;
};

// Recent automation activity on each loan.
export function AutomationActivity({ events }: { events: LoanActivity[] }) {
  if (events.length === 0) return null;
  return (
    <Stack spacing={0.25} sx={{ mt: 1.5 }} aria-label="Automation activity">
      {events.slice(0, 3).map((event, index) => (
        <Typography
          key={`${event.kind}-${event.updatedAt}-${index}`}
          variant="caption"
          color={event.status === 'failed' ? 'error' : 'text.secondary'}
        >
          {describe(event)} {timeAgo(event.updatedAt)}
        </Typography>
      ))}
    </Stack>
  );
}
