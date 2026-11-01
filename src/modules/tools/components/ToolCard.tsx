import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import type { ToolCategory, ToolCondition } from '@convex/lib/constants';
import {
  AvailabilityChip,
  TrustedLenderBadge,
} from '@/modules/common/components/StatusChips';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
} from '@/modules/common/utils/labels';

interface ToolCardProps {
  name: string;
  category: ToolCategory;
  condition?: ToolCondition;
  description?: string;
  availability?: 'available' | 'on_loan';
  owner?: { firstName: string; isTrustedLender: boolean } | null;
  footer?: ReactNode;
  actions?: ReactNode;
}

export function ToolCard({
  name,
  category,
  condition,
  description,
  availability,
  owner,
  footer,
  actions,
}: ToolCardProps) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'start', gap: 1 }}
        >
          <Typography variant="h3" component="h2">
            {name}
          </Typography>
          {availability && <AvailabilityChip availability={availability} />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {CATEGORY_LABELS[category]}
          {condition && ` · ${CONDITION_LABELS[condition]} condition`}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            {description}
          </Typography>
        )}
        {owner && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Lent by {owner.firstName}
            </Typography>
            {owner.isTrustedLender && <TrustedLenderBadge />}
          </Box>
        )}
        {footer}
      </CardContent>
      {actions && <CardActions sx={{ px: 2, pb: 2 }}>{actions}</CardActions>}
    </Card>
  );
}
