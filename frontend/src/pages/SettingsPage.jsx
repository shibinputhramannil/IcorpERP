import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Alert,
  Avatar,
  Divider,
  CircularProgress,
  Paper,
  Chip,
  MenuItem,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';

import { useAuth } from '../hooks/useAuth';
import { useCompany } from '../context/CompanyContext';
import settingsService from '../services/settingsService';
import AvatarDialog from '../components/profile/AvatarDialog';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada) [UTC-5]' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada) [UTC-6]' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada) [UTC-8]' },
  { value: 'Europe/London', label: 'London, Edinburgh [UTC+0]' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome [UTC+1]' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi [UTC+4]' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) [UTC+5:30]' },
  { value: 'Asia/Singapore', label: 'Singapore, Hong Kong [UTC+8]' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Osaka [UTC+9]' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'AED', label: 'AED - UAE Dirham (AED)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { activeCompany, activeCompanyId, reloadCompanies, companies } = useCompany();

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Avatar Dialog
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    designation: '',
    department: '',
  });

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Company Form State
  const [companyForm, setCompanyForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    can_edit: false,
  });

  // Notification Preferences State
  const [preferences, setPreferences] = useState({
    system_notifications: true,
    email_notifications: true,
    low_stock_alerts: true,
    sales_alerts: true,
    purchase_alerts: true,
    finance_alerts: true,
    hr_alerts: true,
  });

  // Application Settings State (persisted in localStorage)
  const [appPreferences, setAppPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('app_preferences');
      return saved
        ? JSON.parse(saved)
        : {
            theme: 'light',
            date_format: 'YYYY-MM-DD',
            timezone: 'UTC',
            currency: 'USD',
            language: 'en',
          };
    } catch {
      return {
        theme: 'light',
        date_format: 'YYYY-MM-DD',
        timezone: 'UTC',
        currency: 'USD',
        language: 'en',
      };
    }
  });

  // Load user profile
  const loadProfile = useCallback(async () => {
    try {
      const data = await settingsService.getProfile();
      setProfileForm({
        username: data.username || '',
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        designation: data.designation || '',
        department: data.department || '',
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  // Load company settings
  const loadCompanySettings = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const data = await settingsService.getCompanySettings(activeCompanyId);
      setCompanyForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        can_edit: !!data.can_edit,
      });
    } catch (err) {
      console.error('Failed to load company settings:', err);
    }
  }, [activeCompanyId]);

  // Load notification preferences
  const loadPreferences = useCallback(async () => {
    try {
      const data = await settingsService.getNotificationPreferences(activeCompanyId);
      setPreferences({
        system_notifications: data.system_notifications !== false,
        email_notifications: data.email_notifications !== false,
        low_stock_alerts: data.low_stock_alerts !== false,
        sales_alerts: data.sales_alerts !== false,
        purchase_alerts: data.purchase_alerts !== false,
        finance_alerts: data.finance_alerts !== false,
        hr_alerts: data.hr_alerts !== false,
      });
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProfile(), loadCompanySettings(), loadPreferences()]).finally(() => {
      setLoading(false);
    });
  }, [loadProfile, loadCompanySettings, loadPreferences]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(null);
    setSuccess(null);
  };

  // Profile Form Change
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  // Profile Form Submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await settingsService.updateProfile(profileForm);
      setSuccess('Profile updated successfully.');
      if (refreshUser) refreshUser();
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile. Please verify your details.');
    } finally {
      setSaving(false);
    }
  };

  // Password Form Change
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  // Password Form Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match.');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await settingsService.changePassword(
        passwordForm.current_password,
        passwordForm.new_password
      );
      setSuccess('Password changed successfully.');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      console.error('Failed to change password:', err);
      const errDetail = err?.response?.data?.detail || err?.response?.data?.current_password?.[0] || 'Failed to change password. Verify your current password.';
      setError(errDetail);
    } finally {
      setSaving(false);
    }
  };

  // Company Form Change
  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  // Company Form Submit
  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    if (!activeCompanyId) return;

    try {
      setSaving(true);
      setError(null);
      await settingsService.updateCompanySettings(activeCompanyId, companyForm);
      setSuccess('Company details updated successfully.');
      if (reloadCompanies) reloadCompanies();
    } catch (err) {
      console.error('Failed to update company settings:', err);
      const errDetail = err?.response?.data?.detail || 'Failed to update company details. Admin privileges required.';
      setError(errDetail);
    } finally {
      setSaving(false);
    }
  };

  // Notification Preferences Submit
  const handlePreferenceToggle = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handlePreferencesSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      await settingsService.updateNotificationPreferences(preferences, activeCompanyId);
      setSuccess('Notification preferences saved successfully.');
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setError('Failed to save notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  // Application Preferences Save
  const handleSaveAppPreferences = () => {
    localStorage.setItem('app_preferences', JSON.stringify(appPreferences));
    setSuccess('Application preferences saved successfully.');
  };

  const avatarSrc = user?.avatar || (user?.id ? localStorage.getItem(`user_avatar_${user.id}`) : null);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Settings & Preferences
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Manage your personal profile, account credentials, organization details, notifications, and application settings.
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Tabs */}
      <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: '1px solid #e2e8f0', px: 2 }}
        >
          <Tab
            icon={<PersonOutlineOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Profile"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<ManageAccountsOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Account"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<BusinessOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Company Details"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<NotificationsActiveOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Notifications"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<SecurityOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Security"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
          <Tab
            icon={<TuneOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Application"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
            {/* ======================================================== */}
            {/* TAB 0: PROFILE SETTINGS */}
            {/* ======================================================== */}
            {activeTab === 0 && (
              <form onSubmit={handleProfileSubmit}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                  <Avatar
                    src={avatarSrc}
                    sx={{
                      width: 72,
                      height: 72,
                      bgcolor: 'primary.main',
                      fontSize: '1.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {profileForm.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {profileForm.first_name ? `${profileForm.first_name} ${profileForm.last_name}` : profileForm.username}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      @{profileForm.username}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setAvatarDialogOpen(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      Change Avatar
                    </Button>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      name="first_name"
                      value={profileForm.first_name}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      name="last_name"
                      value={profileForm.last_name}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email Address"
                      name="email"
                      type="email"
                      value={profileForm.email}
                      disabled
                      helperText="Contact administrator to change registered email."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Designation / Title"
                      name="designation"
                      value={profileForm.designation}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Department"
                      name="department"
                      value={profileForm.department}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
                    disabled={saving}
                  >
                    Save Changes
                  </Button>
                </Box>
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 1: ACCOUNT DETAILS */}
            {/* ======================================================== */}
            {activeTab === 1 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Account Overview
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Your system credentials, authentication status, and active company memberships.
                </Typography>

                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        USER IDENTIFIER
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                        {user?.username || profileForm.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: #{user?.id || '—'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        ACCOUNT ROLE
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={user?.is_superuser ? 'Super Administrator' : 'Standard Enterprise User'}
                          color={user?.is_superuser ? 'primary' : 'default'}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Verified Authentication
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Authorized Workspaces ({companies?.length || 0})
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2, mb: 4 }}>
                  <List disablePadding>
                    {(companies || []).map((comp, idx) => (
                      <React.Fragment key={comp.id}>
                        {idx > 0 && <Divider />}
                        <ListItem sx={{ py: 1.5 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  {comp.name}
                                </Typography>
                                {comp.id === activeCompanyId && (
                                  <Chip label="Active Context" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                                )}
                              </Stack>
                            }
                            secondary={`Email: ${comp.email || '—'} • Role: ${comp.role_name || (user?.is_superuser ? 'Superuser' : 'Member')}`}
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Session Security Status
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleOutlineIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      Active JSON Web Token (JWT) session valid with automated refresh token rotation.
                    </Typography>
                  </Stack>
                </Paper>
              </Box>
            )}

            {/* ======================================================== */}
            {/* TAB 2: COMPANY DETAILS */}
            {/* ======================================================== */}
            {activeTab === 2 && (
              <form onSubmit={handleCompanySubmit}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Active Organization: {activeCompany?.name || 'Workspace'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {companyForm.can_edit
                      ? 'You have administrative permissions to update company details.'
                      : 'You are viewing company details in read-only mode.'}
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Company Name"
                      name="name"
                      value={companyForm.name}
                      onChange={handleCompanyChange}
                      disabled={!companyForm.can_edit}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Corporate Email"
                      name="email"
                      type="email"
                      value={companyForm.email}
                      onChange={handleCompanyChange}
                      disabled={!companyForm.can_edit}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={companyForm.phone}
                      onChange={handleCompanyChange}
                      disabled={!companyForm.can_edit}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Headquarters Address"
                      name="address"
                      value={companyForm.address}
                      onChange={handleCompanyChange}
                      disabled={!companyForm.can_edit}
                    />
                  </Grid>
                </Grid>

                {companyForm.can_edit && (
                  <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
                      disabled={saving}
                    >
                      Save Organization Details
                    </Button>
                  </Box>
                )}
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 3: NOTIFICATIONS */}
            {/* ======================================================== */}
            {activeTab === 3 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Notification Delivery Channels
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Configure automated dispatch alerts and operational trigger thresholds.
                </Typography>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                    General Channels
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.system_notifications}
                            onChange={() => handlePreferenceToggle('system_notifications')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              In-App Notifications
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Header bell badge and banner notifications
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.email_notifications}
                            onChange={() => handlePreferenceToggle('email_notifications')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Email Alerts
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Dispatches email summaries for high-priority alerts
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  </Grid>
                </Paper>

                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                    Module Alerts & Triggers
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.low_stock_alerts}
                            onChange={() => handlePreferenceToggle('low_stock_alerts')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Inventory & Stockouts
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Notify when stock falls below reorder level
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.sales_alerts}
                            onChange={() => handlePreferenceToggle('sales_alerts')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Sales & Quotations
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              New sales orders fulfilled and quotations converted
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.purchase_alerts}
                            onChange={() => handlePreferenceToggle('purchase_alerts')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Procurement & Receiving
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Purchase orders placed and vendor shipments received
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.finance_alerts}
                            onChange={() => handlePreferenceToggle('finance_alerts')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Finance & Payments
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Payment vouchers posted and overdue invoices
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.hr_alerts}
                            onChange={() => handlePreferenceToggle('hr_alerts')}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              HR & Workspace
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Member invitations, role updates, and notes
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  </Grid>
                </Paper>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
                    onClick={handlePreferencesSubmit}
                    disabled={saving}
                  >
                    Save Notification Preferences
                  </Button>
                </Box>
              </Box>
            )}

            {/* ======================================================== */}
            {/* TAB 4: SECURITY */}
            {/* ======================================================== */}
            {activeTab === 4 && (
              <form onSubmit={handlePasswordSubmit}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Change Password
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Ensure your account is protected with a secure password containing at least 8 characters.
                  </Typography>
                </Box>

                <Grid container spacing={3} sx={{ maxWidth: 600 }}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      type="password"
                      label="Current Password"
                      name="current_password"
                      value={passwordForm.current_password}
                      onChange={handlePasswordChange}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      type="password"
                      label="New Password"
                      name="new_password"
                      value={passwordForm.new_password}
                      onChange={handlePasswordChange}
                      helperText="Minimum 8 characters with a mix of letters and numbers"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      type="password"
                      label="Confirm New Password"
                      name="confirm_password"
                      value={passwordForm.confirm_password}
                      onChange={handlePasswordChange}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={16} /> : <LockResetOutlinedIcon />}
                    disabled={saving}
                  >
                    Update Password
                  </Button>
                </Box>
              </form>
            )}

            {/* ======================================================== */}
            {/* TAB 5: APPLICATION PREFERENCES */}
            {/* ======================================================== */}
            {activeTab === 5 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Application Environment & Display
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Customize date formatting, timezones, currency display, and interface behavior.
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Date Format"
                      value={appPreferences.date_format}
                      onChange={(e) => setAppPreferences({ ...appPreferences, date_format: e.target.value })}
                    >
                      <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (Standard ISO)</MenuItem>
                      <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (European)</MenuItem>
                      <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (US Format)</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Default Display Currency"
                      value={appPreferences.currency}
                      onChange={(e) => setAppPreferences({ ...appPreferences, currency: e.target.value })}
                    >
                      {CURRENCIES.map((c) => (
                        <MenuItem key={c.value} value={c.value}>
                          {c.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="System Timezone"
                      value={appPreferences.timezone}
                      onChange={(e) => setAppPreferences({ ...appPreferences, timezone: e.target.value })}
                    >
                      {TIMEZONES.map((tz) => (
                        <MenuItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Language"
                      value={appPreferences.language}
                      onChange={(e) => setAppPreferences({ ...appPreferences, language: e.target.value })}
                    >
                      <MenuItem value="en">English (US)</MenuItem>
                      <MenuItem value="es">Español (Spanish)</MenuItem>
                      <MenuItem value="fr">Français (French)</MenuItem>
                      <MenuItem value="de">Deutsch (German)</MenuItem>
                      <MenuItem value="ar">العربية (Arabic)</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={handleSaveAppPreferences}
                  >
                    Save Application Preferences
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        )}
      </Card>

      <AvatarDialog
        open={avatarDialogOpen}
        onClose={() => setAvatarDialogOpen(false)}
        user={user}
      />
    </Box>
  );
}
