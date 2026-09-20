import React, { useState } from 'react';
import { Box, Toolbar, CssBaseline } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/common/ErrorBoundary';

export default function ERPLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', maxWidth: '100vw', backgroundColor: '#f8fafc' }}>
      <CssBaseline />

      {/* Top Navigation Header */}
      <Header onMobileToggle={handleDrawerToggle} user={user} />

      {/* Left Navigation Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleDrawerClose} />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 3.5 },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
        }}
      >
        {/* Spacer for fixed AppBar */}
        <Toolbar sx={{ minHeight: '64px !important' }} />

        {/* Page Content Rendered Here */}
        <Box sx={{ flexGrow: 1, width: '100%' }}>
          <ErrorBoundary key={location.pathname}>
            <Outlet context={{ user }} />
          </ErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}
