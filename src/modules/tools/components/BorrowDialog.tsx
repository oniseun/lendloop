'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState, type FormEvent } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { LOAN_MESSAGE_MAX } from '@convex/lib/constants';
import { useRunMutation } from '@/modules/common/hooks/useRunMutation';
import { todayInputValue } from '@/modules/common/utils/dates';
import { useRequestLoan } from '@/modules/loans/hooks';

interface BorrowDialogProps {
  tool: { _id: Id<'tools'>; name: string } | null;
  onClose: () => void;
}

export function BorrowDialog({ tool, onClose }: BorrowDialogProps) {
  const requestLoan = useRequestLoan();
  const { run, pending, error } = useRunMutation();
  const today = todayInputValue();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tool) return;
    const loanId = await run(() =>
      requestLoan({
        toolId: tool._id,
        startDate,
        endDate,
        message: message.trim() || undefined,
      }),
    );
    if (loanId) onClose();
  };

  return (
    <Dialog open={Boolean(tool)} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Borrow {tool?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              type="date"
              label="From"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: today },
              }}
            />
            <TextField
              type="date"
              label="Until"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: startDate },
              }}
            />
            <TextField
              label="Note to the owner (optional)"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: LOAN_MESSAGE_MAX } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" loading={pending}>
            Send request
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
