import React, { useState, useEffect } from 'react';
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
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useNavigate } from 'react-router-dom';
import ProfileMenu from './ProfileMenu';
import NotificationBell from '../components/common/NotificationBell';
import GlobalSearchDialog from '../components/common/GlobalSearchDialog';
import { DRAWER_WIDTH } from './Sidebar';
import { useCompany } from '../context/CompanyContext';
import { useThemeContext } from '../context/ThemeContext';

export default function Header({ onMobileToggle, user }) {
  const navigate = useNavigate();
  const { companies, activeCompany, setActiveCompany } = useCompany();
  const { mode, toggleTheme } = useThemeContext();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { md: `${DRAWER_WIDTH}px` },
        backgroundColor: 'background.paper',
        color: 'text.primary',
        boxShadow: 'none',
        borderBottom: 1,
        borderColor: 'divider',
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
          onClick={() => setSearchOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'background.subtle',
            borderRadius: 2,
            px: 1.5,
            py: 0.6,
            width: { xs: '100%', sm: 320, md: 400 },
            border: '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <SearchIcon sx={{ color: 'text.secondary', fontSize: 20, mr: 1 }} />
          <InputBase
            placeholder="Search companies, employees, leads..."
            fullWidth
            readOnly
            onClick={() => setSearchOpen(true)}
            inputProps={{ 'aria-label': 'search erp', style: { cursor: 'pointer' } }}
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
              backgroundColor: 'background.paper',
              border: 1,
              borderColor: 'divider',
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
                backgroundColor: 'background.subtle',
                borderRadius: 2,
                fontSize: '0.85rem',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
              }}
            >
              {companies.map((c) => (
                <MenuItem key={c.id} value={c.id} disabled={c.is_active === false}>
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

          {/* Theme Toggle */}
          <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <IconButton onClick={toggleTheme} color="inherit" sx={{ color: 'text.secondary' }}>
              {mode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <NotificationBell />

          {/* Profile Dropdown */}
          <ProfileMenu user={user} />
        </Box>
      </Toolbar>
      <GlobalSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        activeCompany={activeCompany}
      />
    </AppBar>
  );
}
