'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { EmptyState } from '@/modules/common/components/EmptyState';
import { Loading } from '@/modules/common/components/Loading';
import { PageHeader } from '@/modules/common/components/PageHeader';
import { useRunMutation } from '@/modules/common/hooks/useRunMutation';
import { timeAgo } from '@/modules/common/utils/dates';
import { LoanList } from '@/modules/loans/components/LoanList';

type AdminTab = 'loans' | 'lenders' | 'automation';

export default function AdminView() {
  const [tab, setTab] = useState<AdminTab>('loans');
  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="Every loan, trusted lenders and failed automations. Remove listings from the board."
      />
      <Tabs
        value={tab}
        onChange={(_, value: AdminTab) => setTab(value)}
        sx={{ mb: 3 }}
      >
        <Tab value="loans" label="All loans" />
        <Tab value="lenders" label="Lenders" />
        <Tab value="automation" label="Failed automations" />
      </Tabs>
      {tab === 'loans' && <AllLoans />}
      {tab === 'lenders' && <Lenders />}
      {tab === 'automation' && <FailedDeliveries />}
    </>
  );
}

function AllLoans() {
  const loans = useQuery(api.admin.loans, {});
  return <LoanList loans={loans} emptyMessage="No loans yet." readOnly />;
}

function Lenders() {
  const users = useQuery(api.admin.users, {});
  const setTrusted = useMutation(api.admin.setTrustedLender);
  const { run, pending, error } = useRunMutation();

  if (users === undefined) return <Loading />;
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Listings</TableCell>
              <TableCell align="right">Trusted Lender</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell align="right">{user.listings}</TableCell>
                <TableCell align="right">
                  <Switch
                    checked={user.isTrustedLender}
                    disabled={pending}
                    slotProps={{
                      input: { 'aria-label': `Trusted lender: ${user.name}` },
                    }}
                    onChange={(event) =>
                      run(() =>
                        setTrusted({
                          userId: user._id,
                          trusted: event.target.checked,
                        }),
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </>
  );
}

function FailedDeliveries() {
  const failed = useQuery(api.admin.failedDeliveries, {});
  const retry = useMutation(api.admin.retryDelivery);
  const { run, pending, error } = useRunMutation();

  if (failed === undefined) return <Loading />;
  if (failed.length === 0) {
    return <EmptyState message="No failed webhook deliveries." />;
  }
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Event</TableCell>
              <TableCell>Attempts</TableCell>
              <TableCell>Last error</TableCell>
              <TableCell>Created</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {failed.map((delivery) => (
              <TableRow key={delivery._id}>
                <TableCell>{delivery.eventType}</TableCell>
                <TableCell>{delivery.attempts}</TableCell>
                <TableCell>{delivery.lastError}</TableCell>
                <TableCell>{timeAgo(delivery.createdAt)}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    disabled={pending}
                    onClick={() =>
                      run(() => retry({ deliveryId: delivery._id }))
                    }
                  >
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </>
  );
}
