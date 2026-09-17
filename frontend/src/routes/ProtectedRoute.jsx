import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          backgroundColor: '#f8fafc',
        }}
      >
        <CircularProgress size={40} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary">
          Authenticating session...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to /login preserving the requested path in location state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
