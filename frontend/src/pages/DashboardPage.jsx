import React from 'react';
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
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <Box>
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
            value="--"
            subtitle="Multi-tenant tenant isolation"
            icon={BusinessOutlinedIcon}
            color="#1e3a8a"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Employees"
            value="--"
            subtitle="Assigned across departments"
            icon={BadgeOutlinedIcon}
            color="#0284c7"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Leads"
            value="--"
            subtitle="CRM pipeline tracking"
            icon={PeopleAltOutlinedIcon}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Workflow Velocity"
            value="Active"
            subtitle="ERP system operational"
            icon={TrendingUpOutlinedIcon}
            color="#f59e0b"
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
                      Backend Integration & Data Status
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
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
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
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
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
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        CRM Contacts & Leads
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

            {/* Recent Activity Timeline Section */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Recent Enterprise Activity
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  System and user audit events will appear here once authenticated.
                </Typography>

                <EmptyState
                  title="No Recent Activity Logged"
                  description="When you create or update companies, members, employees, or leads, real-time activity logs will be tracked here."
                />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right Column: AI Insights & Quick Reminders */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            {/* AI Insights Card */}
            <Card
              sx={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
                borderColor: '#bae6fd',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AutoAwesomeOutlinedIcon sx={{ color: '#0284c7' }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0369a1' }}>
                    AI Operational Insights
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Antigravity AI analyzes connected ERP records to highlight bottlenecks and optimization opportunities.
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#ffffff',
                    border: '1px dashed #7dd3fc',
                    mb: 2,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#0369a1', display: 'block' }}>
                    Awaiting Active Telemetry
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI summaries will populate dynamically based on actual ERP records rather than simulated placeholders.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/ai-assistant')}
                  sx={{ borderColor: '#38bdf8', color: '#0284c7' }}
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
                    Notifications & Reminders
                  </Typography>
                </Stack>
                <Box sx={{ py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No urgent notifications. System services and PostgreSQL connection are standby.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
