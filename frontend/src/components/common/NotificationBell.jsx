import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Box,
  Typography,
  Divider,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import notificationService from '../../services/notificationService';

export default function NotificationBell() {
  const { activeCompanyId } = useCompany();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const open = Boolean(anchorEl);

  const fetchUnreadCount = useCallback(async () => {
    if (!activeCompanyId) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await notificationService.getUnreadCount(activeCompanyId);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Graceful fallback
    }
  }, [activeCompanyId]);

  const fetchRecent = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      setLoading(true);
      const data = await notificationService.getNotifications(activeCompanyId, {
        page_size: 5,
      });
      setRecentNotifications(data.results || []);
    } catch (err) {
      console.error('Failed to load recent notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    fetchRecent();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read && activeCompanyId) {
      try {
        await notificationService.markAsRead(activeCompanyId, notif.id);
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (!activeCompanyId) return;
    try {
      await notificationService.markAllAsRead(activeCompanyId);
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/notifications');
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          size="medium"
          color="inherit"
          onClick={handleClick}
          sx={{
            color: 'text.secondary',
            '&:hover': { backgroundColor: '#f1f5f9', color: 'text.primary' },
          }}
          aria-controls={open ? 'notification-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        id="notification-menu"
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: {
            width: 360,
            maxHeight: 460,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            filter: 'drop-shadow(0px 6px 16px rgba(15, 23, 42, 0.12))',
            mt: 1.5,
            border: '1px solid #e2e8f0',
            borderRadius: 2.5,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.2,
                  bgcolor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: 1,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                }}
              >
                {unreadCount} new
              </Typography>
            )}
          </Box>

          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllOutlinedIcon sx={{ fontSize: '15px !important' }} />}
              onClick={handleMarkAllRead}
              sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, py: 0.2 }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Notification list */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 0.5 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : recentNotifications.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                No notifications right now
              </Typography>
            </Box>
          ) : (
            recentNotifications.map((notif) => (
              <MenuItem
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderRadius: 1.5,
                  mb: 0.5,
                  backgroundColor: notif.is_read ? 'transparent' : '#f8fafc',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  '&:hover': {
                    backgroundColor: notif.is_read ? '#f8fafc' : '#f1f5f9',
                  },
                }}
              >
                <CircleIcon
                  sx={{
                    fontSize: 8,
                    mt: 0.8,
                    color: notif.is_read ? 'transparent' : 'primary.main',
                  }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: notif.is_read ? 500 : 700,
                      color: 'text.primary',
                      fontSize: '0.85rem',
                      lineHeight: 1.3,
                    }}
                    noWrap
                  >
                    {notif.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.3,
                      mt: 0.2,
                    }}
                  >
                    {notif.message}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', mt: 0.5, display: 'block' }}>
                    {formatTime(notif.created_at)}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </Box>

        <Divider />

        {/* Footer */}
        <Box sx={{ p: 1, textAlign: 'center', bgcolor: '#f8fafc' }}>
          <Button
            fullWidth
            size="small"
            onClick={handleViewAll}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: 'primary.main',
            }}
          >
            View all notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
}
