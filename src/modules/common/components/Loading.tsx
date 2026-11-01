import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}
