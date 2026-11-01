'use client';

import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { CardGrid } from '@/modules/common/components/CardGrid';
import { EmptyState } from '@/modules/common/components/EmptyState';
import { Loading } from '@/modules/common/components/Loading';
import { PageHeader } from '@/modules/common/components/PageHeader';
import { useRunMutation } from '@/modules/common/hooks/useRunMutation';
import { ToolCard } from '../components/ToolCard';
import { ToolFormDialog } from '../components/ToolFormDialog';
import { useMyTools, useToolMutations } from '../hooks';
import type { MyTool, ToolFormValues } from '../dto/tool.dto';

type Editing = { mode: 'create' } | { mode: 'edit'; tool: MyTool } | null;

export default function MyListingsView() {
  const tools = useMyTools();
  const { createTool, updateTool, removeTool } = useToolMutations();
  const form = useRunMutation();
  const remove = useRunMutation();
  const [editing, setEditing] = useState<Editing>(null);

  const handleSubmit = async (values: ToolFormValues) => {
    if (!editing) return;
    const result = await form.run(async () => {
      if (editing.mode === 'create') await createTool(values);
      else await updateTool({ toolId: editing.tool._id, ...values });
      return true;
    });
    if (result) setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="My listings"
        subtitle="Tools you're lending to the neighbourhood."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              form.clearError();
              setEditing({ mode: 'create' });
            }}
          >
            List a tool
          </Button>
        }
      />
      {remove.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {remove.error}
        </Alert>
      )}

      {tools === undefined ? (
        <Loading />
      ) : tools.length === 0 ? (
        <EmptyState message="You haven't listed anything yet." />
      ) : (
        <CardGrid>
          {tools.map((tool) => (
            <ToolCard
              key={tool._id}
              {...tool}
              footer={
                tool.pendingRequests > 0 && (
                  <Typography
                    variant="body2"
                    color="secondary"
                    sx={{ mt: 1.5 }}
                  >
                    {tool.pendingRequests} pending request
                    {tool.pendingRequests > 1 ? 's' : ''}
                  </Typography>
                )
              }
              actions={
                <>
                  <Button
                    size="small"
                    onClick={() => {
                      form.clearError();
                      setEditing({ mode: 'edit', tool });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={remove.pending}
                    onClick={() =>
                      window.confirm(`Delete "${tool.name}"?`) &&
                      remove.run(() => removeTool({ toolId: tool._id }))
                    }
                  >
                    Delete
                  </Button>
                </>
              }
            />
          ))}
        </CardGrid>
      )}

      {editing && (
        <ToolFormDialog
          open
          title={editing.mode === 'create' ? 'List a tool' : 'Edit listing'}
          initialValues={
            editing.mode === 'edit'
              ? {
                  name: editing.tool.name,
                  category: editing.tool.category,
                  condition: editing.tool.condition,
                  description: editing.tool.description,
                }
              : undefined
          }
          pending={form.pending}
          error={form.error}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}
