'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState, type FormEvent } from 'react';
import {
  TOOL_DESCRIPTION_MAX,
  TOOL_NAME_MAX,
  type ToolCategory,
  type ToolCondition,
} from '@convex/lib/constants';
import {
  categoryOptions,
  conditionOptions,
} from '@/modules/common/utils/labels';
import { emptyToolForm, type ToolFormValues } from '../dto/tool.dto';

interface ToolFormDialogProps {
  open: boolean;
  title: string;
  initialValues?: ToolFormValues;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ToolFormValues) => void;
}

export function ToolFormDialog({
  open,
  title,
  initialValues = emptyToolForm,
  pending,
  error,
  onClose,
  onSubmit,
}: ToolFormDialogProps) {
  const [values, setValues] = useState(initialValues);

  const set = <K extends keyof ToolFormValues>(
    key: K,
    value: ToolFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Name"
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
              required
              slotProps={{
                htmlInput: { minLength: 2, maxLength: TOOL_NAME_MAX },
              }}
            />
            <TextField
              select
              label="Category"
              value={values.category}
              onChange={(event) =>
                set('category', event.target.value as ToolCategory)
              }
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Condition"
              value={values.condition}
              onChange={(event) =>
                set('condition', event.target.value as ToolCondition)
              }
            >
              {conditionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Short description"
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
              multiline
              minRows={2}
              helperText={`${values.description.length}/${TOOL_DESCRIPTION_MAX}`}
              slotProps={{ htmlInput: { maxLength: TOOL_DESCRIPTION_MAX } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" loading={pending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
