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
} from '@mui/material';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';

import { useAuth } from '../hooks/useAuth';
import { useCompany } from '../context/CompanyContext';
import settingsService from '../services/settingsService';
import AvatarDialog from '../components/profile/AvatarDialog';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { activeCompany, activeCompanyId, reloadCompanies } = useCompany();

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
        can_edit: Boolean(data.can_edit),
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
        system_notifications: data.system_notifications ?? true,
        email_notifications: data.email_notifications ?? true,
        low_stock_alerts: data.low_stock_alerts ?? true,
        sales_alerts: data.sales_alerts ?? true,
        purchase_alerts: data.purchase_alerts ?? true,
        finance_alerts: data.finance_alerts ?? true,
        hr_alerts: data.hr_alerts ?? true,
      });
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProfile(), loadCompanySettings(), loadPreferences()]).finally(() =>
      setLoading(false)
    );
  }, [loadProfile, loadCompanySettings, loadPreferences]);

  // Tab Switch Handler
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError(null);
    setSuccess(null);
  };

  // Profile Save
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await settingsService.updateProfile({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        email: profileForm.email,
        phone: profileForm.phone,
        designation: profileForm.designation,
        department: profileForm.department,
      });
      await refreshUser();
      setSuccess('Profile updated successfully.');
    } catch (err) {
      const errDetail = err.response?.data?.email?.[0] || err.response?.data?.detail || 'Failed to update profile.';
      setError(errDetail);
    } finally {
      setSaving(false);
    }
  };

  // Password Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match.');
      return;
    }
    if (passwordForm.new_password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await settingsService.changePassword(
        passwordForm.current_password,
        passwordForm.new_password,
        passwordForm.confirm_password
      );
      setSuccess('Password changed successfully.');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      const errDetail =
        err.response?.data?.current_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.detail ||
        'Failed to change password.';
      setError(errDetail);
    } finally {
      setSaving(false);
    }
  };

  // Company Settings Submit
  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    if (!activeCompanyId) return;
    try {
      setSaving(true);
      setError(null);
      await settingsService.updateCompanySettings(activeCompanyId, {
        name: companyForm.name,
        email: companyForm.email,
        phone: companyForm.phone,
        address: companyForm.address,
      });
      await reloadCompanies();
      setSuccess('Company settings updated successfully.');
    } catch (err) {
      const errDetail = err.response?.data?.email?.[0] || err.response?.data?.detail || 'Failed to update company settings.';
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

  const avatarSrc = user?.avatar || (user?.id ? localStorage.getItem(`user_avatar_${user.id}`) : null);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          Settings & Preferences
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Manage your personal profile, security credentials, organization details, and notifications.
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
            icon={<SecurityOutlinedIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Security"
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
            label="Notification Preferences"
            sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
          />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
            {/* TAB 0: PROFILE SETTINGS */}
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
                      sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                    >
                      Change Picture
                    </Button>
                  </Box>
                </Box>

                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Username"
                      value={profileForm.username}
                      fullWidth
                      disabled
                      size="small"
                      helperText="Username cannot be changed."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email Address"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="First Name"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Last Name"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Phone Number"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Designation / Role"
                      value={profileForm.designation}
                      onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Department"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                      fullWidth
                      size="small"
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

            {/* TAB 1: SECURITY & PASSWORD */}
            {activeTab === 1 && (
              <form onSubmit={handlePasswordSubmit}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Change Password
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Ensure your account uses a strong, unique password to maintain enterprise security.
                </Typography>

                <Grid container spacing={2.5} sx={{ maxWidth: 500 }}>
                  <Grid item xs={12}>
                    <TextField
                      label="Current Password"
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, current_password: e.target.value })
                      }
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="New Password"
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, new_password: e.target.value })
                      }
                      fullWidth
                      size="small"
                      required
                      helperText="Must be at least 4 characters long."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Confirm New Password"
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                      }
                      fullWidth
                      size="small"
                      required
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-start' }}>
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

            {/* TAB 2: COMPANY SETTINGS */}
            {activeTab === 2 && (
              <form onSubmit={handleCompanySubmit}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Company Configuration
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Profile and official records for {activeCompany?.name || 'current company'}.
                    </Typography>
                  </Box>
                  {!companyForm.can_edit && (
                    <Chip
                      label="Read Only (Admin Required)"
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </Box>

                {!companyForm.can_edit && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    You have view permissions. Only Company Admins or Super Admins can modify company configuration.
                  </Alert>
                )}

                <Grid container spacing={2.5}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Company Name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      fullWidth
                      size="small"
                      disabled={!companyForm.can_edit}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Company Email"
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      fullWidth
                      size="small"
                      disabled={!companyForm.can_edit}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Company Phone"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      fullWidth
                      size="small"
                      disabled={!companyForm.can_edit}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Physical Address"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      fullWidth
                      size="small"
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
                      Save Company Details
                    </Button>
                  </Box>
                )}
              </form>
            )}

            {/* TAB 3: NOTIFICATION PREFERENCES */}
            {activeTab === 3 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Notification Delivery & Channel Preferences
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                  Control which notification alerts you receive across email and in-app feeds.
                </Typography>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
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
                              Display bell badges and dropdown activity alerts
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
                              Email Notifications
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Receive critical transaction receipts and invites by email
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  </Grid>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>
                    Module-Specific Alerts
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
                              Inventory Low-Stock Alerts
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Notify when product stock drops below threshold
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
                              Sales & Orders
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Quotations converted, orders placed, and payments received
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
                              Purchases & Goods Receipts
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Purchase orders confirmed, receipts verified, and bills due
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
                              Payment vouchers posted and monthly accounting summaries
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
                              HR & Employees
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              New hires, role changes, and member invitations
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
                    Save Preferences
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
