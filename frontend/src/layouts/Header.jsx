import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  InputBase,
  Badge,
  Tooltip,
  Chip,
  Button,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { useNavigate } from 'react-router-dom';
import ProfileMenu from './ProfileMenu';
import { DRAWER_WIDTH } from './Sidebar';
import { useCompany } from '../context/CompanyContext';

export default function Header({ onMobileToggle, user }) {
  const navigate = useNavigate();
  const { companies, activeCompany, setActiveCompany } = useCompany();

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { md: `${DRAWER_WIDTH}px` },
        backgroundColor: '#ffffff',
        color: 'text.primary',
        boxShadow: 'none',
        borderBottom: '1px solid #e2e8f0',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ height: 64, px: { xs: 2, sm: 3 } }}>
        {/* Mobile Hamburger Menu */}
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMobileToggle}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Global Search Input / Trigger */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            borderRadius: 2,
            px: 1.5,
            py: 0.6,
            width: { xs: '100%', sm: 320, md: 400 },
            border: '1px solid transparent',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: '#e2e8f0',
            },
            '&:focus-within': {
              backgroundColor: '#ffffff',
              borderColor: 'primary.main',
              boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
            },
          }}
        >
          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20, mr: 1 }} />
          <InputBase
            placeholder="Search companies, employees, leads..."
            fullWidth
            inputProps={{ 'aria-label': 'search erp' }}
            sx={{
              fontSize: '0.875rem',
              color: 'text.primary',
            }}
          />
          <Chip
            label="Ctrl+K"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 600,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: 'text.secondary',
              display: { xs: 'none', sm: 'inline-flex' },
            }}
          />
        </Box>

        {/* Active Company Selector */}
        {companies.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 180, ml: 2, display: { xs: 'none', md: 'inline-flex' } }}>
            <Select
              value={activeCompany ? activeCompany.id : ''}
              onChange={(e) => setActiveCompany(e.target.value)}
              displayEmpty
              renderValue={(selectedId) => {
                const c = companies.find((item) => item.id === selectedId);
                return (
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <BusinessOutlinedIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 130 }} noWrap>
                      {c ? c.name : 'Select Company'}
                    </Typography>
                  </Stack>
                );
              }}
              sx={{
                height: 36,
                backgroundColor: '#f8fafc',
                borderRadius: 2,
                fontSize: '0.85rem',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
              }}
            >
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                    {c.is_active === false && (
                      <Chip label="Inactive" size="small" color="error" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Right Action Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          {/* AI Assistant Shortcut */}
          <Tooltip title="AI Insights & Assistant">
            <Button
              variant="outlined"
              size="small"
              startIcon={<AutoAwesomeOutlinedIcon sx={{ color: '#2563eb' }} />}
              onClick={() => navigate('/ai-assistant')}
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderColor: '#bfdbfe',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                borderRadius: 2,
                '&:hover': {
                  borderColor: '#93c5fd',
                  backgroundColor: '#dbeafe',
                },
              }}
            >
              AI Assistant
            </Button>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              size="medium"
              color="inherit"
              onClick={() => navigate('/notifications')}
              sx={{
                color: 'text.secondary',
                '&:hover': { backgroundColor: '#f1f5f9', color: 'text.primary' },
              }}
            >
              <Badge badgeContent={2} color="error" variant="dot">
                <NotificationsNoneOutlinedIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Profile Dropdown */}
          <ProfileMenu user={user} />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
