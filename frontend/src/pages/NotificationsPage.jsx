import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Pagination,
} from '@mui/material';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CircleIcon from '@mui/icons-material/Circle';

import { useCompany } from '../context/CompanyContext';
import notificationService from '../services/notificationService';

export default function NotificationsPage() {
  const { activeCompanyId, activeCompany } = useCompany();

  const [notifications, setNotifications] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const [filterTab, setFilterTab] = useState('all'); // 'all', 'unread', 'read'
  const [moduleFilter, setModuleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const loadNotifications = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        page_size: 15,
      };

      if (filterTab === 'unread') params.unread_only = 'true';
      if (filterTab === 'read') params.unread_only = 'false';
      if (moduleFilter) params.module = moduleFilter;

      const [data, unreadData] = await Promise.all([
        notificationService.getNotifications(activeCompanyId, params),
        notificationService.getUnreadCount(activeCompanyId),
      ]);

      setNotifications(data.results || []);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || 1);
      setUnreadCount(unreadData.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Unable to retrieve notifications.');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, currentPage, filterTab, moduleFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id) => {
    if (!activeCompanyId) return;
    try {
      await notificationService.markAsRead(activeCompanyId, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      setActionSuccess('Notification marked as read.');
    } catch (err) {
      console.error('Failed to mark as read:', err);
      setError('Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    if (!activeCompanyId) return;
    try {
      await notificationService.markAllAsRead(activeCompanyId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setActionSuccess('All notifications marked as read.');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      setError('Failed to mark all notifications as read.');
    }
  };

  const getModuleIcon = (type) => {
    switch (type) {
      case 'member':
        return <BusinessOutlinedIcon sx={{ color: '#2563eb' }} />;
      case 'inventory':
        return <Inventory2OutlinedIcon sx={{ color: '#d97706' }} />;
      case 'sales':
        return <PointOfSaleOutlinedIcon sx={{ color: '#16a34a' }} />;
      case 'purchase':
        return <ShoppingCartOutlinedIcon sx={{ color: '#0284c7' }} />;
      case 'finance':
        return <AccountBalanceWalletOutlinedIcon sx={{ color: '#9333ea' }} />;
      case 'hr':
        return <BadgeOutlinedIcon sx={{ color: '#ea580c' }} />;
      default:
        return <NotificationsOutlinedIcon sx={{ color: '#64748b' }} />;
    }
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (!activeCompanyId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please select an active company from the header dropdown to view notifications.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} Unread`}
                size="small"
                color="error"
                sx={{ fontWeight: 700, fontSize: '0.75rem' }}
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Recent announcements, module updates, and activity alerts for {activeCompany?.name}.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={loadNotifications}
            disabled={loading}
          >
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<DoneAllOutlinedIcon />}
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
        </Stack>
      </Box>

      {/* Feedback alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {/* Filter Toolbar */}
      <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', mb: 3 }}>
        <Box
          sx={{
            p: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Tabs
            value={filterTab}
            onChange={(e, val) => {
              setFilterTab(val);
              setCurrentPage(1);
            }}
            sx={{ minHeight: 38 }}
          >
            <Tab label="All Notifications" value="all" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 38 }} />
            <Tab
              label={`Unread (${unreadCount})`}
              value="unread"
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 38 }}
            />
            <Tab label="Read" value="read" sx={{ textTransform: 'none', fontWeight: 600, minHeight: 38 }} />
          </Tabs>

          <FormControl size="small" sx={{ width: 180 }}>
            <InputLabel>Module Filter</InputLabel>
            <Select
              value={moduleFilter}
              label="Module Filter"
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <MenuItem value="">All Modules</MenuItem>
              <MenuItem value="member">Workspace / Member</MenuItem>
              <MenuItem value="inventory">Inventory</MenuItem>
              <MenuItem value="sales">Sales</MenuItem>
              <MenuItem value="purchase">Purchase</MenuItem>
              <MenuItem value="finance">Finance</MenuItem>
              <MenuItem value="hr">HR</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Notifications List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={36} />
        </Box>
      ) : notifications.length === 0 ? (
        <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', py: 8, textAlign: 'center' }}>
          <NotificationsOutlinedIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            No notifications found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {filterTab === 'unread'
              ? "You're all caught up! No unread notifications."
              : 'There are no notifications matching your current filter.'}
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {notifications.map((notif) => {
            const isUnread = !notif.is_read;
            return (
              <Card
                key={notif.id}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isUnread ? '#bfdbfe' : '#e2e8f0',
                  bgcolor: isUnread ? '#f8fafc' : '#ffffff',
                  boxShadow: 'none',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: isUnread ? '#eff6ff' : '#f8fafc',
                  },
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        bgcolor: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getModuleIcon(notif.notification_type)}
                    </Box>

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {isUnread && (
                          <CircleIcon sx={{ fontSize: 9, color: 'primary.main' }} />
                        )}
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: isUnread ? 700 : 600,
                            color: 'text.primary',
                            fontSize: '0.95rem',
                          }}
                        >
                          {notif.title}
                        </Typography>
                        <Chip
                          label={notif.notification_type}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            bgcolor: '#f1f5f9',
                            color: 'text.secondary',
                          }}
                        />
                      </Box>

                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.5, mb: 1 }}>
                        {notif.message}
                      </Typography>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {formatTimestamp(notif.created_at)}
                        </Typography>

                        {isUnread && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<CheckCircleOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
                            onClick={() => handleMarkAsRead(notif.id)}
                            sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            Mark as read
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(e, page) => setCurrentPage(page)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
