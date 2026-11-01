'use client';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import type { ToolCategory } from '@convex/lib/constants';
import { categoryOptions } from '@/modules/common/utils/labels';

interface CategoryFilterProps {
  value: ToolCategory | null;
  onChange: (value: ToolCategory | null) => void;
}

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <Stack
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 1, mb: 3 }}
      role="group"
      aria-label="Filter by category"
    >
      <Chip
        label="All"
        color={value === null ? 'primary' : 'default'}
        onClick={() => onChange(null)}
      />
      {categoryOptions.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          color={value === option.value ? 'primary' : 'default'}
          onClick={() => onChange(option.value)}
        />
      ))}
    </Stack>
  );
}
