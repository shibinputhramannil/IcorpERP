import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProfileMenu({ user }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login');
  };

  const username = user?.username || 'User';
  const email = user?.email || '';
  const initial = username.charAt(0).toUpperCase();
  const primaryCompany = user?.companies?.[0];

  return (
    <>
      <Tooltip title="Account settings">
        <IconButton
          onClick={handleClick}
          size="small"
          aria-controls={open ? 'account-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{ ml: 1 }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: 'primary.main',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(30, 58, 138, 0.2)',
            }}
          >
            {initial}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 3,
          sx: {
            minWidth: 220,
            overflow: 'visible',
            filter: 'drop-shadow(0px 4px 12px rgba(15, 23, 42, 0.08))',
            mt: 1.5,
            border: '1px solid #e2e8f0',
            borderRadius: 2,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {username}
          </Typography>
          {email && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {email}
            </Typography>
          )}
          {primaryCompany && (
            <Typography
              variant="caption"
              sx={{
                display: 'inline-block',
                mt: 0.5,
                px: 1,
                py: 0.2,
                borderRadius: 1,
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            >
              {primaryCompany.role || 'Member'} • {primaryCompany.name}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={() => navigate('/settings')}>
          <ListItemIcon>
            <PersonOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="User Profile" primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>

        <MenuItem onClick={() => navigate('/companies')}>
          <ListItemIcon>
            <BusinessOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="My Companies" primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>

        <MenuItem onClick={() => navigate('/settings')}>
          <ListItemIcon>
            <SettingsOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Preferences" primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Sign out"
            primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
          />
        </MenuItem>
      </Menu>
    </>
  );
}
