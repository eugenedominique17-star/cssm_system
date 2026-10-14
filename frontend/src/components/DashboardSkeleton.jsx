import React from 'react';
import { Box, Skeleton } from '@mui/material';

export default function DashboardSkeleton() {
  return (
    <Box role="status" sx={{ width: '100%', py: 2 }}>
      <span className="sr-only">Loading dashboard</span>
      <Box aria-hidden="true">
        <Skeleton variant="rounded" height={110} sx={{ mb: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          {[0, 1, 2, 3].map(key => <Skeleton key={key} variant="rounded" height={120} />)}
        </Box>
        <Skeleton variant="rounded" height={170} />
      </Box>
    </Box>
  );
}
