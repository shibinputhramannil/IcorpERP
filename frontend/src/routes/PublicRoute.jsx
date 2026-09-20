import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export default function PublicRoute() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <CircularProgress size={40} thickness={4} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return <Outlet />;
}
