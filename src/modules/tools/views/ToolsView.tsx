'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { ToolCategory } from '@convex/lib/constants';
import { CardGrid } from '@/modules/common/components/CardGrid';
import { EmptyState } from '@/modules/common/components/EmptyState';
import { Loading } from '@/modules/common/components/Loading';
import { PageHeader } from '@/modules/common/components/PageHeader';
import { useCurrentUser } from '@/modules/common/context/CurrentUserContext';
import { useRunMutation } from '@/modules/common/hooks/useRunMutation';
import { BorrowDialog } from '../components/BorrowDialog';
import { CategoryFilter } from '../components/CategoryFilter';
import { ToolCard } from '../components/ToolCard';

export default function ToolsView() {
  const [category, setCategory] = useState<ToolCategory | null>(null);
  const [borrowing, setBorrowing] = useState<{
    _id: Id<'tools'>;
    name: string;
  } | null>(null);
  const tools = useQuery(api.tools.list, category ? { category } : {});
  const { user } = useCurrentUser();
  const removeTool = useMutation(api.tools.remove);
  const { run, pending, error } = useRunMutation();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <PageHeader
        title="The board"
        subtitle="Everything your neighbours are happy to lend."
      />
      <CategoryFilter value={category} onChange={setCategory} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {tools === undefined ? (
        <Loading />
      ) : tools.length === 0 ? (
        <EmptyState message="No tools in this category yet." />
      ) : (
        <CardGrid>
          {tools.map((tool) => (
            <ToolCard
              key={tool._id}
              {...tool}
              owner={tool.isMine ? null : tool.owner}
              footer={
                tool.isMine ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1.5 }}
                  >
                    Your listing
                  </Typography>
                ) : null
              }
              actions={
                <>
                  {!tool.isMine && (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={tool.hasMyPendingRequest}
                      onClick={() => setBorrowing(tool)}
                    >
                      {tool.hasMyPendingRequest
                        ? 'Requested'
                        : 'Request to borrow'}
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      size="small"
                      color="error"
                      disabled={pending}
                      onClick={() =>
                        window.confirm(
                          `Remove "${tool.name}" from the board?`,
                        ) && run(() => removeTool({ toolId: tool._id }))
                      }
                    >
                      Remove listing
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </CardGrid>
      )}

      <BorrowDialog
        key={borrowing?._id ?? 'none'}
        tool={borrowing}
        onClose={() => setBorrowing(null)}
      />
    </>
  );
}
