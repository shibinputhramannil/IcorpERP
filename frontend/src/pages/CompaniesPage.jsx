import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import StatCard from '../components/common/StatCard';
import companyService from '../services/companyService';
import { useCompany } from '../context/CompanyContext';

export default function CompaniesPage() {
  const { reloadCompanies } = useCompany();

  // Company state
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState(0); // 0 = All, 1 = Active, 2 = Inactive

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Members management state
  const [companyMembers, setCompanyMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addMemberData, setAddMemberData] = useState({ username: '', role: 'Employee' });
  const [submittingMember, setSubmittingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Action Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuCompany, setMenuCompany] = useState(null);

  // Feedback Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await companyService.getCompanies();
      setCompanies(data);
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError('Unable to load companies. Please ensure the Django API is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleMenuOpen = (event, comp) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuCompany(comp);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Company name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Valid email address is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create Company Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      await companyService.createCompany(formData);
      showSnackbar('Company created successfully!');
      setCreateDialogOpen(false);
      setFormData({ name: '', email: '', phone: '', address: '' });
      fetchCompanies();
      reloadCompanies();
    } catch (err) {
      console.error('Error creating company:', err);
      const resData = err.response?.data;
      if (resData) {
        if (typeof resData === 'object') {
          setFormErrors(resData);
        } else {
          showSnackbar(String(resData), 'error');
        }
      } else {
        showSnackbar('Failed to create company.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (comp) => {
    handleMenuClose();
    setSelectedCompany(comp);
    setFormData({
      name: comp.name || '',
      email: comp.email || '',
      phone: comp.phone || '',
      address: comp.address || '',
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  // Edit Company Handler
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      await companyService.updateCompany(selectedCompany.id, formData);
      showSnackbar('Company updated successfully!');
      setEditDialogOpen(false);
      fetchCompanies();
      reloadCompanies();
    } catch (err) {
      console.error('Error updating company:', err);
      if (err.response?.data && typeof err.response.data === 'object') {
        setFormErrors(err.response.data);
      } else {
        showSnackbar('Failed to update company.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Deactivate / Delete Dialog
  const handleOpenDelete = (comp) => {
    handleMenuClose();
    setSelectedCompany(comp);
    setDeleteDialogOpen(true);
  };

  // Deactivate Company Handler
  const handleDeleteSubmit = async () => {
    try {
      setSubmitting(true);
      await companyService.deleteCompany(selectedCompany.id);
      showSnackbar(`Company "${selectedCompany.name}" deactivated successfully.`);
      setDeleteDialogOpen(false);
      fetchCompanies();
      reloadCompanies();
    } catch (err) {
      console.error('Error deactivating company:', err);
      showSnackbar('Failed to deactivate company.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reactivate Company Handler
  const handleReactivate = async (comp) => {
    handleMenuClose();
    try {
      await companyService.updateCompany(comp.id, { is_active: true });
      showSnackbar(`Company "${comp.name}" reactivated successfully.`);
      fetchCompanies();
      reloadCompanies();
    } catch (err) {
      console.error('Error reactivating company:', err);
      showSnackbar('Failed to reactivate company.', 'error');
    }
  };

  // Open Members Dialog
  const handleOpenMembers = async (comp) => {
    handleMenuClose();
    setSelectedCompany(comp);
    setMembersDialogOpen(true);
    setMemberError('');
    setAddMemberData({ username: '', role: 'Employee' });

    try {
      setLoadingMembers(true);
      const members = await companyService.getCompanyMembers(comp.id);
      setCompanyMembers(members);
    } catch (err) {
      console.error('Error fetching members:', err);
      setMemberError('Could not load company members.');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Add Member to Company
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!addMemberData.username.trim()) {
      setMemberError('Username or email is required.');
      return;
    }

    try {
      setSubmittingMember(true);
      setMemberError('');
      await companyService.addCompanyMember(selectedCompany.id, addMemberData);
      showSnackbar('Member added successfully!');
      setAddMemberData({ username: '', role: 'Employee' });
      const updated = await companyService.getCompanyMembers(selectedCompany.id);
      setCompanyMembers(updated);
      fetchCompanies();
    } catch (err) {
      console.error('Error adding member:', err);
      const res = err.response?.data;
      if (res?.detail) {
        setMemberError(res.detail);
      } else if (res?.non_field_errors) {
        setMemberError(res.non_field_errors.join(' '));
      } else if (typeof res === 'object') {
        const msg = Object.entries(res).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ');
        setMemberError(msg);
      } else {
        setMemberError('Failed to add member.');
      }
    } finally {
      setSubmittingMember(false);
    }
  };

  // Remove Member
  const handleRemoveMember = async (membershipId) => {
    try {
      await companyService.removeMember(selectedCompany.id, membershipId);
      showSnackbar('Member removed successfully.');
      setCompanyMembers((prev) => prev.filter((m) => m.id !== membershipId));
      fetchCompanies();
    } catch (err) {
      console.error('Error removing member:', err);
      showSnackbar('Failed to remove member.', 'error');
    }
  };

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery));

    if (statusTab === 1) return matchesSearch && c.is_active;
    if (statusTab === 2) return matchesSearch && !c.is_active;
    return matchesSearch;
  });

  const totalCount = companies.length;
  const activeCount = companies.filter((c) => c.is_active).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <Box>
      <PageHeader
        title="Companies"
        subtitle="Manage multi-tenant company entities, organizational hierarchies, and memberships."
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Companies' }]}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={fetchCompanies}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => {
                setFormData({ name: '', email: '', phone: '', address: '' });
                setFormErrors({});
                setCreateDialogOpen(true);
              }}
            >
              Create Company
            </Button>
          </Stack>
        }
      />

      {/* KPI Stats */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Total Companies"
            value={totalCount}
            subtitle="Registered ERP tenants"
            icon={BusinessOutlinedIcon}
            color="#1e3a8a"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Active Companies"
            value={activeCount}
            subtitle="Operational organizations"
            icon={CheckCircleOutlinedIcon}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Inactive Companies"
            value={inactiveCount}
            subtitle="Deactivated / Suspended"
            icon={BlockOutlinedIcon}
            color="#ef4444"
          />
        </Grid>
      </Grid>

      {/* Main Content Card */}
      <Card sx={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' }}>
        <CardContent sx={{ p: 3 }}>
          {/* Search and Filter Toolbar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Tabs
              value={statusTab}
              onChange={(e, val) => setStatusTab(val)}
              sx={{
                minHeight: 38,
                '& .MuiTab-root': { minHeight: 38, py: 0.5, px: 2, fontSize: '0.85rem', textTransform: 'none', fontWeight: 600 },
              }}
            >
              <Tab label={`All (${totalCount})`} />
              <Tab label={`Active (${activeCount})`} />
              <Tab label={`Inactive (${inactiveCount})`} />
            </Tabs>

            <TextField
              placeholder="Search companies by name, email, phone..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 300 } }}
            />
          </Stack>

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} action={
              <Button color="inherit" size="small" onClick={fetchCompanies}>Retry</Button>
            }>
              {error}
            </Alert>
          )}

          {/* Loading State */}
          {loading ? (
            <LoadingState message="Loading registered companies from PostgreSQL..." />
          ) : filteredCompanies.length === 0 ? (
            /* Empty State */
            <EmptyState
              icon={BusinessOutlinedIcon}
              title={searchQuery ? 'No Matching Companies' : 'No Companies Found'}
              description={
                searchQuery
                  ? `No companies matched your search query "${searchQuery}".`
                  : 'Get started by creating your first organizational company tenant.'
              }
              actionLabel="Create Company"
              onAction={() => {
                setFormData({ name: '', email: '', phone: '', address: '' });
                setFormErrors({});
                setCreateDialogOpen(true);
              }}
            />
          ) : (
            /* Companies Table */
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>COMPANY NAME</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>CONTACT INFO</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>ADDRESS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="center">MEMBERS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="center">EMPLOYEES</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="center">STATUS</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="right">ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCompanies.map((comp) => (
                    <TableRow key={comp.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 1.5,
                              backgroundColor: comp.is_active ? '#eff6ff' : '#f1f5f9',
                              color: comp.is_active ? '#2563eb' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                            }}
                          >
                            {comp.name.charAt(0).toUpperCase()}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                              {comp.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: #{comp.id} • Created {new Date(comp.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#334155' }}>
                          {comp.email || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {comp.phone || 'No phone'}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#475569', maxWidth: 200 }} noWrap>
                          {comp.address || '—'}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          icon={<PeopleAltOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                          label={comp.member_count ?? 0}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => handleOpenMembers(comp)}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={comp.employee_count ?? 0}
                          size="small"
                          sx={{ backgroundColor: '#f1f5f9', fontWeight: 600 }}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          label={comp.is_active ? 'Active' : 'Inactive'}
                          color={comp.is_active ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.75rem', height: 24 }}
                        />
                      </TableCell>

                      <TableCell align="right">
                        <Tooltip title="Actions">
                          <IconButton size="small" onClick={(e) => handleMenuOpen(e, comp)}>
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Row Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { width: 180, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' } }}
      >
        <MenuItem onClick={() => handleOpenEdit(menuCompany)}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Edit Details" />
        </MenuItem>

        <MenuItem onClick={() => handleOpenMembers(menuCompany)}>
          <ListItemIcon><PeopleAltOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Manage Members" />
        </MenuItem>

        {menuCompany?.is_active ? (
          <MenuItem onClick={() => handleOpenDelete(menuCompany)} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineOutlinedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText primary="Deactivate" />
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleReactivate(menuCompany)} sx={{ color: 'success.main' }}>
            <ListItemIcon><CheckCircleOutlineIcon fontSize="small" color="success" /></ListItemIcon>
            <ListItemText primary="Reactivate" />
          </MenuItem>
        )}
      </Menu>

      {/* CREATE COMPANY DIALOG */}
      <Dialog open={createDialogOpen} onClose={() => !submitting && setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Company</DialogTitle>
        <form onSubmit={handleCreateSubmit}>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField
                label="Company Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name}
                placeholder="e.g. Apex Industrial Systems"
              />
              <TextField
                label="Corporate Email"
                type="email"
                fullWidth
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={Boolean(formErrors.email)}
                helperText={formErrors.email}
                placeholder="e.g. contact@apexindustrial.com"
              />
              <TextField
                label="Phone Number"
                fullWidth
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={Boolean(formErrors.phone)}
                helperText={formErrors.phone}
                placeholder="e.g. +1-555-0182"
              />
              <TextField
                label="Headquarters Address"
                multiline
                rows={3}
                fullWidth
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                error={Boolean(formErrors.address)}
                helperText={formErrors.address}
                placeholder="e.g. 100 Innovation Parkway, Dallas, TX 75001"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={submitting} startIcon={submitting && <CircularProgress size={16} />}>
              {submitting ? 'Creating...' : 'Create Company'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* EDIT COMPANY DIALOG */}
      <Dialog open={editDialogOpen} onClose={() => !submitting && setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Company Details</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent dividers>
            <Stack spacing={2.5}>
              <TextField
                label="Company Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name}
              />
              <TextField
                label="Corporate Email"
                type="email"
                fullWidth
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={Boolean(formErrors.email)}
                helperText={formErrors.email}
              />
              <TextField
                label="Phone Number"
                fullWidth
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={Boolean(formErrors.phone)}
                helperText={formErrors.phone}
              />
              <TextField
                label="Headquarters Address"
                multiline
                rows={3}
                fullWidth
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                error={Boolean(formErrors.address)}
                helperText={formErrors.address}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setEditDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={submitting} startIcon={submitting && <CircularProgress size={16} />}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DEACTIVATE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onClose={() => !submitting && setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Deactivate Company?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Are you sure you want to deactivate <strong>{selectedCompany?.name}</strong>?
            Deactivating will prevent non-admin users from accessing this company tenant until reactivated.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleDeleteSubmit} variant="contained" color="error" disabled={submitting} startIcon={submitting && <CircularProgress size={16} />}>
            {submitting ? 'Deactivating...' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MEMBERS MANAGEMENT DIALOG */}
      <Dialog open={membersDialogOpen} onClose={() => setMembersDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Manage Members — {selectedCompany?.name}
        </DialogTitle>
        <DialogContent dividers>
          {/* Add Member Subform */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Add New Company Member
            </Typography>
            {memberError && <Alert severity="error" sx={{ mb: 2 }}>{memberError}</Alert>}
            <form onSubmit={handleAddMember}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <TextField
                    size="small"
                    label="Username or Email"
                    fullWidth
                    required
                    value={addMemberData.username}
                    onChange={(e) => setAddMemberData({ ...addMemberData, username: e.target.value })}
                    placeholder="Enter existing username or email"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    size="small"
                    label="Role"
                    fullWidth
                    value={addMemberData.role}
                    onChange={(e) => setAddMemberData({ ...addMemberData, role: e.target.value })}
                  >
                    <MenuItem value="Employee">Employee</MenuItem>
                    <MenuItem value="Company Admin">Company Admin</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={submittingMember ? <CircularProgress size={16} /> : <PersonAddOutlinedIcon />}
                    disabled={submittingMember}
                  >
                    {submittingMember ? 'Adding...' : 'Add Member'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>

          {/* Members List Table */}
          {loadingMembers ? (
            <LoadingState message="Loading company members..." />
          ) : companyMembers.length === 0 ? (
            <EmptyState
              icon={PeopleAltOutlinedIcon}
              title="No Members"
              description="No members are currently assigned to this company."
            />
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>USERNAME</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ASSIGNED ROLE</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>JOINED DATE</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">REMOVE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companyMembers.map((mem) => (
                    <TableRow key={mem.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{mem.username}</TableCell>
                      <TableCell>
                        <Chip
                          label={mem.role_name || 'Member'}
                          color={mem.role_name === 'Company Admin' ? 'primary' : 'default'}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>{new Date(mem.created_at).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveMember(mem.id)}
                          title="Remove from company"
                        >
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setMembersDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
