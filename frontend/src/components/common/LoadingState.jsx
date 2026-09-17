import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function LoadingState({ message = 'Loading data...' }) {
  return (
    <Box
      sx={{
        py: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress size={36} thickness={4} sx={{ color: 'primary.main' }} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}
