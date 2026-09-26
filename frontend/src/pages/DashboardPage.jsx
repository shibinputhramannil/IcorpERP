import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Stack,
  Chip,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import employeeService from '../services/employeeService';
import crmService from '../services/crmService';
import notificationService from '../services/notificationService';
import aiService from '../services/aiService';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { companies, activeCompany, activeCompanyId } = useCompany();

  // ── Stat counts ──────────────────────────────────────────────
  const [employeeCount, setEmployeeCount] = useState(null);
  const [leadCount, setLeadCount] = useState(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // ── Notifications ─────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // ── AI Summary ────────────────────────────────────────────────
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // ── Fetch employees & leads when activeCompany changes ────────
  useEffect(() => {
    if (!activeCompanyId) {
      setEmployeeCount(null);
      setLeadCount(null);
      setNotifications([]);
      setAiSummary(null);
      return;
    }

    // Employees
    setLoadingEmployees(true);
    employeeService
      .getEmployees(activeCompanyId)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results ?? [];
        setEmployeeCount(list.length);
      })
      .catch((err) => {
        console.error('[Dashboard] Failed to fetch employees:', err);
        setEmployeeCount('--');
      })
      .finally(() => setLoadingEmployees(false));

    // Leads
    setLoadingLeads(true);
    crmService
      .getLeads(activeCompanyId)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results ?? [];
        setLeadCount(list.length);
      })
      .catch((err) => {
        console.error('[Dashboard] Failed to fetch leads:', err);
        setLeadCount('--');
      })
      .finally(() => setLoadingLeads(false));

    // Notifications (latest 3)
    setLoadingNotifications(true);
    notificationService
      .getNotifications(activeCompanyId, { page_size: 3 })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results ?? [];
        setNotifications(list.slice(0, 3));
      })
      .catch((err) => {
        console.error('[Dashboard] Failed to fetch notifications:', err);
        setNotifications([]);
      })
      .finally(() => setLoadingNotifications(false));

    // AI Summary
    setLoadingAi(true);
    aiService
      .getSummary(activeCompanyId)
      .then((data) => setAiSummary(data))
      .catch((err) => {
        console.error('[Dashboard] Failed to fetch AI summary:', err);
        setAiSummary(null);
      })
      .finally(() => setLoadingAi(false));
  }, [activeCompanyId]);

  // ── Helper: render a stat value or spinner ────────────────────
  const statValue = (loading, value, fallback = '0') => {
    if (loading) return <CircularProgress size={20} thickness={5} />;
    if (value === null || value === undefined) return fallback;
    return String(value);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Page Header */}
      <PageHeader
        title="Enterprise Overview"
        subtitle="Real-time operational visibility across companies, teams, and workflows."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Dashboard' }]}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<BusinessOutlinedIcon />}
              onClick={() => navigate('/companies')}
            >
              Manage Companies
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => navigate('/crm')}
            >
              New Lead
            </Button>
          </Stack>
        }
      />

      {/* KPI Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Connected Companies"
            value={companies.length > 0 ? String(companies.length) : '0'}
            subtitle="Multi-tenant tenant isolation"
            icon={BusinessOutlinedIcon}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Employees"
            value={
              loadingEmployees
                ? '--'
                : employeeCount !== null
                ? String(employeeCount)
                : activeCompanyId
                ? '0'
                : '--'
            }
            subtitle="Assigned across departments"
            icon={BadgeOutlinedIcon}
            color="secondary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Leads"
            value={
              loadingLeads
                ? '--'
                : leadCount !== null
                ? String(leadCount)
                : activeCompanyId
                ? '0'
                : '--'
            }
            subtitle="CRM pipeline tracking"
            icon={PeopleAltOutlinedIcon}
            color="success.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Workflow Velocity"
            value="Active"
            subtitle="ERP system operational"
            icon={TrendingUpOutlinedIcon}
            color="warning.main"
          />
        </Grid>
      </Grid>

      {/* Main Grid: CRM & ERP Overview + AI Insights */}
      <Grid container spacing={2.5}>
        {/* Left Column: CRM & Operational Status */}
        <Grid item xs={12} md={8}>
          <Stack spacing={2.5}>
            {/* Real Data Status Card */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Backend Integration &amp; Data Status
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Showing status of currently connected Django REST APIs
                    </Typography>
                  </Box>
                  <Chip
                    label="Phase 1 Ready"
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.subtle', border: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        Company Management
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Backend: Active (/api/companies/)
                      </Typography>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon fontSize="inherit" />}
                        onClick={() => navigate('/companies')}
                        sx={{ mt: 1, p: 0 }}
                      >
                        View Companies
                      </Button>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.subtle', border: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        Employee Profiles
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Backend: Active (/api/.../employees/)
                      </Typography>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon fontSize="inherit" />}
                        onClick={() => navigate('/employees')}
                        sx={{ mt: 1, p: 0 }}
                      >
                        View Employees
                      </Button>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.subtle', border: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        CRM Contacts &amp; Leads
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Backend: Active (/api/.../leads/)
                      </Typography>
                      <Button
                        size="small"
                        endIcon={<ArrowForwardIcon fontSize="inherit" />}
                        onClick={() => navigate('/crm')}
                        sx={{ mt: 1, p: 0 }}
                      >
                        Open CRM
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Recent Activity / Notifications Section */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Recent Enterprise Activity
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      Latest notifications from your active company.
                    </Typography>
                  </Box>
                  {notifications.length > 0 && (
                    <Button
                      size="small"
                      endIcon={<ArrowForwardIcon fontSize="inherit" />}
                      onClick={() => navigate('/notifications')}
                    >
                      View All
                    </Button>
                  )}
                </Stack>

                {loadingNotifications ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : notifications.length > 0 ? (
                  <List disablePadding>
                    {notifications.map((n, idx) => (
                      <React.Fragment key={n.id ?? idx}>
                        {idx > 0 && <Divider component="li" />}
                        <ListItem alignItems="flex-start" sx={{ px: 0, py: 1.25 }}>
                          <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
                            <FiberManualRecordIcon
                              sx={{
                                fontSize: 10,
                                color: n.is_read ? 'text.disabled' : 'primary.main',
                              }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 600 }}>
                                {n.title ?? n.message ?? 'Notification'}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {n.created_at
                                  ? new Date(n.created_at).toLocaleString()
                                  : n.timestamp
                                  ? new Date(n.timestamp).toLocaleString()
                                  : ''}
                              </Typography>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <EmptyState
                    title="No Recent Activity Logged"
                    description={
                      activeCompanyId
                        ? 'When you create or update companies, members, employees, or leads, real-time activity logs will be tracked here.'
                        : 'Select an active company to see recent activity.'
                    }
                  />
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right Column: AI Insights & Quick Reminders */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            {/* AI Insights Card */}
            <Card
              sx={(theme) => ({
                background: theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                borderColor: theme.palette.mode === 'dark' ? '#0369a1' : '#bae6fd',
              })}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AutoAwesomeOutlinedIcon sx={{ color: 'secondary.main' }} />
                  <Typography variant="h6" sx={(theme) => ({ fontWeight: 700, color: theme.palette.mode === 'dark' ? 'secondary.light' : '#0369a1' })}>
                    AI Operational Insights
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Antigravity AI analyzes connected ERP records to highlight bottlenecks and
                  optimization opportunities.
                </Typography>
                <Box
                  sx={(theme) => ({
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px dashed',
                    borderColor: theme.palette.mode === 'dark' ? '#0284c7' : '#7dd3fc',
                    mb: 2,
                  })}
                >
                  {loadingAi ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                      <CircularProgress size={20} />
                    </Box>
                  ) : aiSummary ? (
                    <>
                      <Typography
                        variant="caption"
                        sx={(theme) => ({ fontWeight: 600, color: theme.palette.mode === 'dark' ? 'secondary.light' : '#0369a1', display: 'block' })}
                      >
                        {aiSummary.title ?? 'AI Summary'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {aiSummary.summary ?? aiSummary.description ?? JSON.stringify(aiSummary).slice(0, 120)}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography
                        variant="caption"
                        sx={(theme) => ({ fontWeight: 600, color: theme.palette.mode === 'dark' ? 'secondary.light' : '#0369a1', display: 'block' })}
                      >
                        Awaiting Active Telemetry
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        AI summaries will populate dynamically based on actual ERP records rather
                        than simulated placeholders.
                      </Typography>
                    </>
                  )}
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/ai')}
                  color="secondary"
                  sx={{ borderWidth: 1 }}
                >
                  Explore AI Assistant
                </Button>
              </CardContent>
            </Card>

            {/* Notifications & System Health */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <NotificationsActiveOutlinedIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Notifications &amp; Reminders
                  </Typography>
                </Stack>
                <Box sx={{ py: 1 }}>
                  {loadingNotifications ? (
                    <CircularProgress size={18} />
                  ) : notifications.length > 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      You have{' '}
                      <strong>
                        {notifications.filter((n) => !n.is_read).length}
                      </strong>{' '}
                      unread notification
                      {notifications.filter((n) => !n.is_read).length !== 1 ? 's' : ''}.{' '}
                      <Button
                        variant="text"
                        size="small"
                        sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}
                        onClick={() => navigate('/notifications')}
                      >
                        View all
                      </Button>
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No urgent notifications. System services and PostgreSQL connection are standby.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
