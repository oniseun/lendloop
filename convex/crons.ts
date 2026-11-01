import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

// Housekeeping only. Business scheduling (overdue reminders) is owned by
// n8n.
const crons = cronJobs();

crons.interval(
  'prune webhook receipts',
  { hours: 1 },
  internal.automation.pruneReceipts,
);

export default crons;
