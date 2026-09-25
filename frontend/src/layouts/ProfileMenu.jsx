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
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AvatarDialog from '../components/profile/AvatarDialog';

export default function ProfileMenu({ user }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
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

  // Resolve user avatar from user profile or cached local storage
  const avatarSrc = user?.avatar || (user?.id ? localStorage.getItem(`user_avatar_${user.id}`) : null);

  return (
    <>
      <Tooltip title="Account settings">
        <IconButton
          onClick={handleClick}
          size="small"
          aria-controls={open ? 'account-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{ ml: 1, p: 0.25 }}
        >
          <Avatar
            src={avatarSrc}
            alt={username}
            sx={{
              width: 38,
              height: 38,
              bgcolor: 'primary.main',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              boxShadow: '0 2px 5px rgba(30, 58, 138, 0.25)',
              border: '2px solid #e2e8f0',
              transition: 'transform 0.15s ease',
              '&:hover': {
                transform: 'scale(1.05)',
              },
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
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: {
            minWidth: 240,
            overflow: 'visible',
            filter: 'drop-shadow(0px 6px 16px rgba(15, 23, 42, 0.1))',
            mt: 1.5,
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={avatarSrc}
                alt={username}
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: 'primary.main',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                {initial}
              </Avatar>
              <Tooltip title="Change profile picture">
                <IconButton
                  size="small"
                  onClick={() => {
                    handleClose();
                    setAvatarDialogOpen(true);
                  }}
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    bgcolor: '#ffffff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    p: 0.3,
                    '&:hover': { bgcolor: '#eff6ff' },
                  }}
                >
                  <PhotoCameraOutlinedIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }} noWrap>
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : username}
              </Typography>
              {email && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                  {email}
                </Typography>
              )}
            </Box>
          </Box>

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

        <MenuItem
          onClick={() => {
            handleClose();
            setAvatarDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <AddPhotoAlternateOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
          </ListItemIcon>
          <ListItemText
            primary="Change Profile Picture"
            primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600, color: 'primary.main' }}
          />
        </MenuItem>

        <MenuItem onClick={() => { handleClose(); navigate('/settings'); }}>
          <ListItemIcon>
            <PersonOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="User Profile" primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>

        <MenuItem onClick={() => { handleClose(); navigate('/companies'); }}>
          <ListItemIcon>
            <BusinessOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="My Companies" primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>

        <MenuItem onClick={() => { handleClose(); navigate('/settings'); }}>
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

      {/* Profile Picture Dialog */}
      <AvatarDialog
        open={avatarDialogOpen}
        onClose={() => setAvatarDialogOpen(false)}
        user={user}
      />
    </>
  );
}
